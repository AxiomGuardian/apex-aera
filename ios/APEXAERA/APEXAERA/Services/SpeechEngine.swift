import Foundation
import Speech
import AVFoundation
import Observation

/// On-device speech to text with a live level meter for the waveform.
/// Apple's recognizer: free, fast, works offline. Deepgram plugs in later for full voice mode.
@Observable
final class SpeechEngine {
    var transcript = ""
    var level: CGFloat = 0
    var listening = false
    var error: String?

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let audio = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    func toggle() { listening ? stop() : start() }

    func start() {
        error = nil
        SFSpeechRecognizer.requestAuthorization { [weak self] auth in
            guard let self else { return }
            guard auth == .authorized else { DispatchQueue.main.async { self.error = "Speech permission is off. Enable it in Settings." }; return }
            AVAudioApplication.requestRecordPermission { ok in
                guard ok else { DispatchQueue.main.async { self.error = "Microphone permission is off. Enable it in Settings." }; return }
                DispatchQueue.main.async { self.begin() }
            }
        }
    }

    private func begin() {
        guard let recognizer, recognizer.isAvailable else { error = "Speech recognition is not available right now."; return }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
            let req = SFSpeechAudioBufferRecognitionRequest()
            req.shouldReportPartialResults = true
            if recognizer.supportsOnDeviceRecognition { req.requiresOnDeviceRecognition = false }
            request = req
            transcript = ""
            let input = audio.inputNode
            let fmt = input.outputFormat(forBus: 0)
            input.removeTap(onBus: 0)
            input.installTap(onBus: 0, bufferSize: 1024, format: fmt) { [weak self] buf, _ in
                req.append(buf)
                // RMS level for the waveform
                guard let self, let ch = buf.floatChannelData?[0] else { return }
                let n = Int(buf.frameLength)
                var sum: Float = 0
                for i in 0..<n { sum += ch[i] * ch[i] }
                let rms = sqrt(sum / Float(max(n, 1)))
                let lvl = CGFloat(min(1, rms * 12))
                DispatchQueue.main.async { self.level = self.level * 0.6 + lvl * 0.4 }
            }
            audio.prepare()
            try audio.start()
            listening = true
            task = recognizer.recognitionTask(with: req) { [weak self] result, err in
                guard let self else { return }
                if let result { DispatchQueue.main.async { self.transcript = result.bestTranscription.formattedString } }
                if err != nil || (result?.isFinal ?? false) { DispatchQueue.main.async { self.stop() } }
            }
        } catch {
            self.error = "Could not start the microphone: \(error.localizedDescription)"
            stop()
        }
    }

    func stop() {
        audio.inputNode.removeTap(onBus: 0)
        audio.stop()
        request?.endAudio()
        task?.cancel()
        task = nil; request = nil
        listening = false
        level = 0
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
