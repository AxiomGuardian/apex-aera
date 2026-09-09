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
    /// The tool she is running this second, in plain words, for the capsule.
    var doing: String?

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
    /// Buffers handed to the speaker that have not finished playing.
    private var outstanding = 0
    private let outLock = NSLock()
    /// True between the server hearing speech and the transcript landing.
    private var userSpeaking = false

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
            Log.failure("voice.rt.open", nil, area: "voice", label: "Microphone permission is off")
            await MainActor.run { self.error = "Microphone permission is off. Enable it in Settings."; self.state = .idle }
            return false
        }
        let openedAt = Date()

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
                  let t = obj["token"] as? String else {
                Log.failure("voice.rt.open", nil, area: "voice", label: "No realtime token from the server", detail: ["engine": "xai"])
                return false
            }
            token = t
            model = (obj["model"] as? String) ?? model
            sessionConfig = (obj["session"] as? [String: Any]) ?? [:]
        } catch {
            Log.failure("voice.rt.open", error, area: "voice", label: "Could not reach the token route", detail: ["engine": "xai"])
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
        guard opened else {
            Log.failure("voice.rt.open", nil, area: "voice", label: "The xAI socket would not open", detail: ["engine": "xai", "model": model])
            teardown()
            return false
        }

        running = true
        receiveLoop()
        send(["type": "session.update", "session": sessionConfig])

        // 3. Mic and speaker on one engine.
        let ok = await MainActor.run { self.startAudio() }
        guard ok else {
            Log.failure("voice.rt.open", nil, area: "voice", label: "Could not start the audio engine", detail: ["engine": "xai"])
            teardown()
            return false
        }

        set(.listening)
        Log.event("voice.rt.open", area: "voice", label: "Realtime voice is live", ms: Int(Date().timeIntervalSince(openedAt) * 1000), detail: ["engine": "xai", "model": model])
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

            let input = engine.inputNode
            // Echo cancellation. Without it the mic hears her own voice out of the
            // speaker, the server thinks she is the person talking, and the next
            // turn takes forever. This also brings automatic gain, so normal
            // speaking volume is enough and nobody has to raise their voice.
            do {
                try input.setVoiceProcessingEnabled(true)
                try engine.outputNode.setVoiceProcessingEnabled(true)
            } catch {
                // Older or unusual hardware: carry on without it.
            }

            engine.attach(player)
            engine.connect(player, to: engine.mainMixerNode, format: voiceFormat)
            engine.mainMixerNode.outputVolume = 1.0
            player.volume = 1.0

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
            userSpeaking = true
            if state == .speaking { send(["type": "response.cancel"]) }
            stopPlayback()
            set(.listening)

        case "input_audio_buffer.speech_stopped":
            userSpeaking = false

        case "conversation.item.input_audio_transcription.completed":
            userSpeaking = false
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
            doing = ToolWords.label(name, args)
            set(.thinking)
            onState?(state)
            Task { await self.runTool(name: name, callId: callId, args: args) }

        case "response.done":
            if !heard.isEmpty || !said.isEmpty {
                onExchange?(heard, said)
                Log.event("voice.turn", area: "voice", label: String(heard.prefix(200)), detail: ["engine": "xai", "reply": String(said.prefix(200))])
            }
            outLock.lock(); let left = outstanding; outLock.unlock()
            // Her audio usually outlives the model's last token. Stay in speaking
            // until the speaker is actually quiet, or the turn ends too early and
            // the next thing the person says lands in the gap.
            if left <= 0 { set(.listening) }

        case "error":
            let m = ((e["error"] as? [String: Any])?["message"] as? String) ?? "Voice error"
            // Cancelling when she had already finished is normal, not worth showing.
            if m.lowercased().contains("cancel") || m.lowercased().contains("no active response") {
                Log.event("voice.rt.notice", area: "voice", label: m, detail: ["engine": "xai"])
            } else {
                error = m
                Log.failure("voice.rt.error", nil, area: "voice", label: m, detail: ["engine": "xai"])
            }

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
        await MainActor.run { self.doing = nil; self.onState?(self.state) }
        Log.event("voice.tool", area: "voice", label: name, ok: !output.contains("\"ok\":false"), detail: ["tool": name, "args": String(String(describing: args).prefix(300))])
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
        outLock.lock(); outstanding += 1; outLock.unlock()
        player.scheduleBuffer(buf, completionCallbackType: .dataPlayedBack) { [weak self] _ in
            guard let self else { return }
            self.outLock.lock(); self.outstanding -= 1; let left = self.outstanding; self.outLock.unlock()
            if left <= 0 { DispatchQueue.main.async { self.playbackDrained() } }
        }
    }

    /// Her last word has actually left the speaker. Only now is it her turn to listen.
    private func playbackDrained() {
        guard running, state == .speaking else { return }
        set(.listening)
        // Drop whatever leaked into the buffer while she was talking, unless the
        // person is mid sentence right now.
        if !userSpeaking { send(["type": "input_audio_buffer.clear"]) }
    }

    private func stopPlayback() {
        player.stop()
        outLock.lock(); outstanding = 0; outLock.unlock()
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


/// The same plain words the portal uses for AERA's steps.
enum ToolWords {
    static func label(_ tool: String, _ args: [String: Any] = [:]) -> String {
        let s: (String) -> String = { args[$0] as? String ?? "" }
        switch tool {
        case "navigate":        return "Opening " + (s("tab").isEmpty ? "the app" : s("tab"))
        case "highlight":       return "Pointing at " + (s("kind").isEmpty ? "an item" : s("kind"))
        case "list_queue":      return "Reading the queue"
        case "list_content":    return "Reading recent uploads"
        case "brand_summary":   return "Reading the brand"
        case "look_at_content": return "Looking at the content"
        case "social_search":   return "Searching " + (s("platform").isEmpty ? "the web" : s("platform"))
        case "remember":        return "Remembering that"
        case "reschedule_post": return "Moving the post"
        case "retitle_post":    return "Renaming the post"
        case "approve_post":    return "Approving the post"
        case "cancel_post":     return "Pulling the post"
        case "set_autopilot":   return "Turning autopilot " + ((args["on"] as? Bool) == false ? "off" : "on")
        case "update_voice":    return "Updating the brand voice"
        case "read_voice":      return "Re-reading the brand voice"
        case "publish_now":     return "Publishing now"
        default:                return tool.replacingOccurrences(of: "_", with: " ")
        }
    }
}
