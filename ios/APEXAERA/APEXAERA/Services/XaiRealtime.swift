import Foundation
import AVFoundation
import Observation

/// AERA's real-time voice: a live socket to xAI, mic in and her voice out, with her tools attached.
///
///  1. Our server mints a short-lived client secret at /api/voice/xai-token and hands back the
///     session config (voice, instructions, her tools). The real key never leaves the server.
///  2. Socket to wss://api.x.ai/v1/realtime, credential in the WebSocket subprotocol.
///  3. Mic streams PCM16 at 16 kHz; her voice comes back as PCM at 24 kHz and plays as it arrives.
///  4. When she calls a tool, we run it through /api/aera/tools under the signed-in person and
///     hand the result straight back into the conversation.
///
/// If any of that fails, start() returns false and the voice layer falls back to the
/// Deepgram listen, think, speak loop.
@Observable
final class XaiRealtime {
    enum State { case idle, connecting, listening, thinking, speaking }

    var state: State = .idle
    var heard = ""
    var said = ""
    var error: String?
    var level: CGFloat = 0
    var muted = false { didSet { if muted { level = 0 } } }

    /// Told to the app so she can move the screen while she talks.
    var onDirective: ((Repo.ActResponse.UIDirective) -> Void)?
    /// A finished turn: what the person said, and what she answered.
    var onExchange: ((String, String) -> Void)?
    var onState: ((State) -> Void)?
    var onClosed: ((String) -> Void)?

    private var socket: URLSessionWebSocketTask?
    private var events: SocketEvents?
    private var engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private var converter: AVAudioConverter?
    private var sessionConfig: [String: Any] = [:]
    private var running = false
    private var turnText = ""

    private let micFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16000, channels: 1, interleaved: true)!
    private let voiceFormat = AVAudioFormat(standardFormatWithSampleRate: 24000, channels: 1)!

    // MARK: Open

    /// Returns true when the socket is up and the mic is streaming.
    @discardableResult
    func start() async -> Bool {
        guard !running else { return true }
        await MainActor.run { self.error = nil }
        set(.connecting)

        guard await micPermission() else {
            await MainActor.run { self.error = "Microphone permission is off. Enable it in Settings."; self.state = .idle }
            return false
        }

        // 1. Token and session config from our server.
        var token = ""
        var model = "grok-voice-latest"
        do {
            let s = try await SupabaseClient.shared.refreshIfNeeded()
            var req = URLRequest(url: Config.apiBase.appending(path: "api/voice/xai-token"))
            req.setValue("Bearer " + s.accessToken, forHTTPHeaderField: "Authorization")
            req.timeoutInterval = 15
            let (data, resp) = try await URLSession.shared.data(for: req)
            guard (resp as? HTTPURLResponse)?.statusCode == 200,
                  let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let t = obj["token"] as? String else { return false }
            token = t
            model = (obj["model"] as? String) ?? model
            sessionConfig = (obj["session"] as? [String: Any]) ?? [:]
        } catch {
            return false
        }

        // 2. The socket.
        guard let url = URL(string: "wss://api.x.ai/v1/realtime?model=" + model) else { return false }
        var req = URLRequest(url: url)
        req.setValue("xai-client-secret." + token, forHTTPHeaderField: "Sec-WebSocket-Protocol")
        req.timeoutInterval = 20

        let opened = await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
            var resumed = false
            let delegate = SocketEvents(
                onOpen: { if !resumed { resumed = true; cont.resume(returning: true) } },
                onClose: { [weak self] reason in
                    if !resumed { resumed = true; cont.resume(returning: false) }
                    guard let self else { return }
                    DispatchQueue.main.async {
                        if self.running { self.onClosed?(reason) }
                        self.teardown()
                    }
                }
            )
            self.events = delegate
            let session = URLSession(configuration: .default, delegate: delegate, delegateQueue: nil)
            let task = session.webSocketTask(with: req)
            self.socket = task
            task.resume()
            // Do not hang forever on a silent socket.
            DispatchQueue.main.asyncAfter(deadline: .now() + 12) { if !resumed { resumed = true; cont.resume(returning: false) } }
        }
        guard opened else { teardown(); return false }

        running = true
        receiveLoop()
        send(["type": "session.update", "session": sessionConfig])

        // 3. Mic and speaker on one engine.
        let ok = await MainActor.run { self.startAudio() }
        guard ok else { teardown(); return false }

        set(.listening)
        return true
    }

    private func micPermission() async -> Bool {
        await withCheckedContinuation { cont in
            AVAudioApplication.requestRecordPermission { ok in cont.resume(returning: ok) }
        }
    }

    @MainActor private func startAudio() -> Bool {
        do {
            // Session first, then a fresh engine, then the real hardware format.
            try AudioSessionConfig.activate()
            engine.stop()
            engine = AVAudioEngine()
            engine.attach(player)
            engine.connect(player, to: engine.mainMixerNode, format: voiceFormat)

            let input = engine.inputNode
            let inFormat = input.inputFormat(forBus: 0)
            guard inFormat.sampleRate > 0, inFormat.channelCount > 0 else {
                error = "Microphone is not available right now."
                return false
            }
            converter = AVAudioConverter(from: inFormat, to: micFormat)
            let ratio = micFormat.sampleRate / inFormat.sampleRate

            input.installTap(onBus: 0, bufferSize: 2048, format: inFormat) { [weak self] buf, _ in
                guard let self, self.running else { return }
                if self.muted { return }
                self.meter(buf)
                guard let converter = self.converter else { return }
                let cap = AVAudioFrameCount(Double(buf.frameLength) * ratio + 32)
                guard let out = AVAudioPCMBuffer(pcmFormat: self.micFormat, frameCapacity: cap) else { return }
                var consumed = false
                var err: NSError?
                converter.convert(to: out, error: &err) { _, status in
                    if consumed { status.pointee = .noDataNow; return nil }
                    consumed = true; status.pointee = .haveData; return buf
                }
                guard err == nil, out.frameLength > 0, let ch = out.int16ChannelData?[0] else { return }
                let pcm = Data(bytes: ch, count: Int(out.frameLength) * 2)
                self.send(["type": "input_audio_buffer.append", "audio": pcm.base64EncodedString()])
            }

            engine.prepare()
            try engine.start()
            player.play()
            return true
        } catch {
            self.error = "Could not start the microphone: \(error.localizedDescription)"
            return false
        }
    }

    private func meter(_ buf: AVAudioPCMBuffer) {
        guard let ch = buf.floatChannelData?[0] else { return }
        let n = Int(buf.frameLength)
        var sum: Float = 0
        for i in 0..<n { sum += ch[i] * ch[i] }
        let lvl = CGFloat(min(1, sqrt(sum / Float(max(n, 1))) * 12))
        DispatchQueue.main.async { self.level = self.level * 0.6 + lvl * 0.4 }
    }

    // MARK: Talking to the socket

    private func send(_ payload: [String: Any]) {
        guard let socket, let data = try? JSONSerialization.data(withJSONObject: payload),
              let text = String(data: data, encoding: .utf8) else { return }
        socket.send(.string(text)) { _ in }
    }

    private func receiveLoop() {
        socket?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let e):
                DispatchQueue.main.async {
                    if self.running { self.onClosed?(e.localizedDescription) }
                    self.teardown()
                }
            case .success(let msg):
                if case .string(let text) = msg, let d = text.data(using: .utf8),
                   let obj = try? JSONSerialization.jsonObject(with: d) as? [String: Any] {
                    DispatchQueue.main.async { self.handle(obj) }
                }
                self.receiveLoop()
            }
        }
    }

    private func handle(_ e: [String: Any]) {
        let type = (e["type"] as? String) ?? ""
        switch type {
        case "input_audio_buffer.speech_started":
            // Barge in: she stops the moment the person starts talking.
            stopPlayback()
            set(.listening)

        case "conversation.item.input_audio_transcription.completed":
            if let t = e["transcript"] as? String, !t.trimmingCharacters(in: .whitespaces).isEmpty {
                heard = AeraVoice.fixName(t)
                onState?(state)
            }

        case "response.created":
            turnText = ""
            set(.thinking)

        case "response.output_audio.delta", "response.audio.delta":
            if let b64 = e["delta"] as? String, let pcm = Data(base64Encoded: b64) {
                play(pcm)
                if state != .speaking { set(.speaking) }
            }

        case "response.output_audio_transcript.delta", "response.audio_transcript.delta":
            if let piece = e["delta"] as? String { turnText += piece; said = AeraVoice.fixName(turnText); onState?(state) }

        case "response.output_audio_transcript.done", "response.audio_transcript.done":
            if let t = e["transcript"] as? String { turnText = t; said = AeraVoice.fixName(t); onState?(state) }

        case "response.function_call_arguments.done":
            let name = (e["name"] as? String) ?? ""
            let callId = (e["call_id"] as? String) ?? ""
            let argText = (e["arguments"] as? String) ?? "{}"
            let args = (try? JSONSerialization.jsonObject(with: Data(argText.utf8))) as? [String: Any] ?? [:]
            Task { await self.runTool(name: name, callId: callId, args: args) }

        case "response.done":
            if !heard.isEmpty || !said.isEmpty { onExchange?(heard, said) }
            set(.listening)

        case "error":
            let m = ((e["error"] as? [String: Any])?["message"] as? String) ?? "Voice error"
            error = m

        default:
            break
        }
    }

    /// Runs one of her tools on our server, under the signed-in person's own permissions.
    private func runTool(name: String, callId: String, args: [String: Any]) async {
        var output = "{\"ok\":false,\"error\":\"tool failed\"}"
        do {
            let s = try await SupabaseClient.shared.refreshIfNeeded()
            var req = URLRequest(url: Config.apiBase.appending(path: "api/aera/tools"))
            req.httpMethod = "POST"
            req.setValue("Bearer " + s.accessToken, forHTTPHeaderField: "Authorization")
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: ["name": name, "args": args])
            req.timeoutInterval = 45
            let (data, _) = try await URLSession.shared.data(for: req)
            if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                if let ui = obj["ui"] as? [[String: Any]] {
                    let directives = ui.compactMap { d -> Repo.ActResponse.UIDirective? in
                        guard let t = d["type"] as? String else { return nil }
                        return Repo.ActResponse.UIDirective(type: t, tab: d["tab"] as? String, kind: d["kind"] as? String, id: d["id"] as? String)
                    }
                    await MainActor.run { for d in directives { self.onDirective?(d) } }
                }
                if let result = obj["result"],
                   let out = try? JSONSerialization.data(withJSONObject: ["result": result]),
                   let text = String(data: out, encoding: .utf8) {
                    output = text
                }
            }
        } catch {
            output = "{\"ok\":false,\"error\":\"\(error.localizedDescription)\"}"
        }
        send([
            "type": "conversation.item.create",
            "item": ["type": "function_call_output", "call_id": callId, "output": output],
        ])
        send(["type": "response.create"])
    }

    // MARK: Her voice

    private func play(_ pcm16: Data) {
        let frames = pcm16.count / 2
        guard frames > 0, let buf = AVAudioPCMBuffer(pcmFormat: voiceFormat, frameCapacity: AVAudioFrameCount(frames)) else { return }
        buf.frameLength = AVAudioFrameCount(frames)
        guard let out = buf.floatChannelData?[0] else { return }
        pcm16.withUnsafeBytes { raw in
            let src = raw.bindMemory(to: Int16.self)
            for i in 0..<frames { out[i] = Float(Int16(littleEndian: src[i])) / 32768.0 }
        }
        if !player.isPlaying { player.play() }
        player.scheduleBuffer(buf, completionHandler: nil)
    }

    private func stopPlayback() {
        player.stop()
        player.play()
    }

    /// Tap while she is talking.
    func interrupt() {
        stopPlayback()
        send(["type": "response.cancel"])
        set(.listening)
    }

    func toggleMute() { muted.toggle() }

    func stop() {
        guard running || socket != nil else { return }
        send(["type": "session.close"])
        teardown()
    }

    private func teardown() {
        running = false
        engine.inputNode.removeTap(onBus: 0)
        player.stop()
        engine.stop()
        socket?.cancel(with: .normalClosure, reason: nil)
        socket = nil
        events = nil
        level = 0
        set(.idle)
    }

    /// Always lands on the main thread; the views watch these.
    private func set(_ s: State) {
        if Thread.isMainThread {
            guard state != s else { return }
            state = s
            onState?(s)
        } else {
            DispatchQueue.main.async { self.set(s) }
        }
    }
}
