import Foundation
import AVFoundation
import Observation

/// One audio session for the whole voice layer: mic and speaker together, routed to the loudspeaker.
/// Configured once per use so the input format never changes under a live tap.
enum AudioSessionConfig {
    static func activate() throws {
        let s = AVAudioSession.sharedInstance()
        // .default mode keeps full output gain (voiceChat mode quietly attenuates playback).
        try s.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth, .duckOthers])
        try s.setActive(true, options: [])
        try? s.overrideOutputAudioPort(.speaker)
    }
}

/// APEX speech engine on iOS: the same Deepgram pipeline as the web portal.
///  1. Short-lived credential from /api/voice/deepgram-token (the real key never leaves the server).
///  2. Live socket to Deepgram nova-2 with interim results; PCM16 at 16 kHz streamed from the mic.
///  3. If the socket cannot open, record and send to /api/voice/transcribe (batch) instead.
@Observable
final class SpeechEngine {
    var transcript = ""
    var level: CGFloat = 0
    var listening = false
    var error: String?
    /// Called when Deepgram hears the end of an utterance (hands-free mode).
    var onFinal: ((String) -> Void)?

    private var audio = AVAudioEngine()
    private var socket: URLSessionWebSocketTask?
    private var converter: AVAudioConverter?
    private var pcmFallback = Data()
    private var finalText = ""
    private var liveOK = false
    private let outFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16000, channels: 1, interleaved: true)!

    private struct Cred: Decodable { let mode: String; let access_token: String }
    private struct DGResult: Decodable {
        let is_final: Bool?
        let speech_final: Bool?
        let channel: Ch?
        struct Ch: Decodable { let alternatives: [Alt]? }
        struct Alt: Decodable { let transcript: String? }
    }

    func toggle() { listening ? stop() : start() }

    func start() {
        error = nil; transcript = ""; finalText = ""; pcmFallback = Data(); liveOK = false
        AVAudioApplication.requestRecordPermission { [weak self] ok in
            guard let self else { return }
            guard ok else { DispatchQueue.main.async { self.error = "Microphone permission is off. Enable it in Settings." }; return }
            Task { await self.begin() }
        }
    }

    private func begin() async {
        // Credential from our server, same as the web dictation button.
        var cred: Cred?
        var credError: String?
        do { cred = try await SupabaseClient.shared.api("api/voice/deepgram-token", method: "GET", as: Cred.self) } catch { cred = nil; credError = error.localizedDescription }

        await MainActor.run { self.startMic() }

        guard let cred else {
            await MainActor.run { self.error = "Live speech unavailable (\(credError ?? "no credential")). Recording for batch transcription instead." }
            return
        }
        var req = URLRequest(url: URL(string: "wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&interim_results=true&endpointing=300&encoding=linear16&sample_rate=16000&channels=1&keywords=AERA:5&keywords=APEX:3")!)
        req.setValue((cred.mode == "bearer" ? "Bearer " : "Token ") + cred.access_token, forHTTPHeaderField: "Authorization")
        let task = URLSession.shared.webSocketTask(with: req)
        socket = task
        task.resume()
        liveOK = true
        receiveLoop()
    }

    @MainActor private func startMic() {
        do {
            // Session first, then a fresh engine, then read the REAL hardware format.
            // Asking the engine before the session is ready returns a stale rate and the tap crashes.
            try AudioSessionConfig.activate()
            audio.stop()
            audio = AVAudioEngine()
            let input = audio.inputNode
            let inFormat = input.inputFormat(forBus: 0)
            guard inFormat.sampleRate > 0, inFormat.channelCount > 0 else {
                error = "Microphone is not available right now."; return
            }
            converter = AVAudioConverter(from: inFormat, to: outFormat)
            let ratio = outFormat.sampleRate / inFormat.sampleRate
            input.installTap(onBus: 0, bufferSize: 2048, format: inFormat) { [weak self] buf, _ in
                guard let self else { return }
                self.meter(buf)
                guard let converter = self.converter else { return }
                let cap = AVAudioFrameCount(Double(buf.frameLength) * ratio + 32)
                guard let out = AVAudioPCMBuffer(pcmFormat: self.outFormat, frameCapacity: cap) else { return }
                var consumed = false
                var err: NSError?
                converter.convert(to: out, error: &err) { _, status in
                    if consumed { status.pointee = .noDataNow; return nil }
                    consumed = true; status.pointee = .haveData; return buf
                }
                guard err == nil, out.frameLength > 0, let ch = out.int16ChannelData?[0] else { return }
                let data = Data(bytes: ch, count: Int(out.frameLength) * 2)
                if self.liveOK, let socket = self.socket {
                    socket.send(.data(data)) { _ in }
                } else {
                    self.pcmFallback.append(data)
                }
            }
            audio.prepare()
            try audio.start()
            listening = true
        } catch {
            self.error = "Could not start the microphone: \(error.localizedDescription)"
            stop()
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

    private func receiveLoop() {
        socket?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let e):
                // Socket died: keep the mic running and fall back to batch on stop.
                DispatchQueue.main.async {
                    if self.listening { self.error = "Live speech dropped (\(e.localizedDescription)). Recording for batch transcription." }
                    self.liveOK = false
                }
            case .success(let msg):
                if case .string(let text) = msg, let d = text.data(using: .utf8), let r = try? JSONDecoder().decode(DGResult.self, from: d) {
                    let piece = r.channel?.alternatives?.first?.transcript ?? ""
                    DispatchQueue.main.async {
                        if r.is_final == true {
                            if !piece.isEmpty { self.finalText = (self.finalText + " " + piece).trimmingCharacters(in: .whitespaces) }
                            self.transcript = self.finalText
                            if r.speech_final == true, !self.finalText.isEmpty, let cb = self.onFinal {
                                let done = self.finalText
                                self.finalText = ""
                                cb(done)
                            }
                        } else {
                            self.transcript = (self.finalText + " " + piece).trimmingCharacters(in: .whitespaces)
                        }
                    }
                }
                self.receiveLoop()
            }
        }
    }

    /// Stops the mic. If live transcription never connected, sends the recording to the batch endpoint.
    func stop() {
        audio.inputNode.removeTap(onBus: 0)
        audio.stop()
        listening = false
        level = 0
        if let s = socket {
            s.send(.string("{\"type\":\"CloseStream\"}")) { _ in }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { s.cancel(with: .normalClosure, reason: nil) }
        }
        socket = nil
        if !liveOK, pcmFallback.count > 3200 {
            let wav = Self.wav(pcm16: pcmFallback, sampleRate: 16000)
            pcmFallback = Data()
            Task { await self.batch(wav) }
        }
    }

    private struct Batch: Decodable { let transcript: String? }
    private func batch(_ wav: Data) async {
        do {
            let s = try await SupabaseClient.shared.refreshIfNeeded()
            var req = URLRequest(url: Config.apiBase.appending(path: "api/voice/transcribe"))
            req.httpMethod = "POST"
            req.setValue("Bearer " + s.accessToken, forHTTPHeaderField: "Authorization")
            req.setValue("audio/wav", forHTTPHeaderField: "Content-Type")
            req.httpBody = wav
            let (data, resp) = try await URLSession.shared.data(for: req)
            let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
            guard code == 200 else {
                let msg = (try? JSONDecoder().decode([String: String].self, from: data))?["error"] ?? "HTTP \(code)"
                await MainActor.run { self.error = "Transcription failed: \(msg)" }
                return
            }
            let b = try JSONDecoder().decode(Batch.self, from: data)
            await MainActor.run { self.transcript = b.transcript ?? "" }
        } catch {
            await MainActor.run { self.error = "Transcription failed: \(error.localizedDescription)" }
        }
    }

    private static func wav(pcm16: Data, sampleRate: Int) -> Data {
        var d = Data()
        func u32(_ v: UInt32) { var x = v.littleEndian; d.append(Data(bytes: &x, count: 4)) }
        func u16(_ v: UInt16) { var x = v.littleEndian; d.append(Data(bytes: &x, count: 2)) }
        d.append("RIFF".data(using: .ascii)!); u32(UInt32(36 + pcm16.count)); d.append("WAVE".data(using: .ascii)!)
        d.append("fmt ".data(using: .ascii)!); u32(16); u16(1); u16(1); u32(UInt32(sampleRate)); u32(UInt32(sampleRate * 2)); u16(2); u16(16)
        d.append("data".data(using: .ascii)!); u32(UInt32(pcm16.count)); d.append(pcm16)
        return d
    }
}

/// AERA speaks: fetches Deepgram Aura audio from our server and plays it.
@Observable
final class VoiceOut: NSObject, AVAudioPlayerDelegate {
    var speaking = false
    var enabled = false
    var onFinished: (() -> Void)?
    private var player: AVAudioPlayer?

    func say(_ text: String) async {
        guard enabled else { return }
        do {
            let s = try await SupabaseClient.shared.refreshIfNeeded()
            var req = URLRequest(url: Config.apiBase.appending(path: "api/voice/speak"))
            req.httpMethod = "POST"
            req.setValue("Bearer " + s.accessToken, forHTTPHeaderField: "Authorization")
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let voice = UserDefaults.standard.string(forKey: "aera.voice") ?? AeraVoices.all[0].id
            req.httpBody = try JSONSerialization.data(withJSONObject: ["text": text, "voice": voice])
            let (data, resp) = try await URLSession.shared.data(for: req)
            guard (resp as? HTTPURLResponse)?.statusCode == 200 else { return }
            try AudioSessionConfig.activate()
            let p = try AVAudioPlayer(data: data)
            p.volume = 1.0
            p.delegate = self
            player = p
            await MainActor.run { speaking = true }
            p.play()
        } catch { await MainActor.run { speaking = false; onFinished?() } }
    }

    func stop() { player?.stop(); player = nil; speaking = false }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        DispatchQueue.main.async { self.speaking = false; self.onFinished?() }
    }
}


/// Deepgram Aura voices AERA can speak with. Stored under "aera.voice".
enum AeraVoices {
    struct V: Identifiable { let id: String; let name: String; let note: String }
    static let all: [V] = [
        V(id: "aura-2-thalia-en", name: "Thalia", note: "Clear, confident, warm. The default."),
        V(id: "aura-2-athena-en", name: "Athena", note: "Calm and measured, a little lower."),
        V(id: "aura-2-luna-en", name: "Luna", note: "Soft, poetic, unhurried."),
        V(id: "aura-2-asteria-en", name: "Asteria", note: "Bright and energetic."),
        V(id: "aura-2-hera-en", name: "Hera", note: "Mature, authoritative."),
        V(id: "aura-2-orion-en", name: "Orion", note: "Male. Smooth and grounded."),
        V(id: "aura-2-arcas-en", name: "Arcas", note: "Male. Natural, conversational."),
    ]
}
