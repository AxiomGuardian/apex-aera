import Foundation
import Observation
import SwiftUI

enum AppTab: String, Hashable { case dashboard, clients, brand, content, queue, aera }

/// Where the app is, and what AERA is pointing at. Shared through the environment.
@Observable
final class AppNav {
    var tab: AppTab = .dashboard
    var highlight: (kind: String, id: String)? = nil
    var refreshTick = 0

    func apply(_ d: Repo.ActResponse.UIDirective, role: Role) {
        switch d.type {
        case "navigate":
            var t = AppTab(rawValue: d.tab ?? "") ?? .dashboard
            if !role.seesClients, t == .dashboard || t == .clients { t = .brand }
            if role.seesClients, t == .brand { t = .clients }
            withAnimation(.easeInOut(duration: 0.35)) { tab = t }
        case "highlight":
            if let id = d.id { highlight = (d.kind ?? "post", id) }
            Task { try? await Task.sleep(for: .seconds(6)); if highlight?.id == d.id { highlight = nil } }
        case "refresh": refreshTick += 1
        default: break
        }
    }
}

/// The voice layer: a presence above the tabs. Listen, think, act, speak, listen again.
@Observable
final class AeraVoice {
    enum State { case idle, listening, thinking, speaking }
    var active = false
    var state: State = .idle
    var heard = ""
    var said = ""
    var error: String?
    var pendingConfirm: String?
    /// What she is doing this second, when she is doing something.
    var doing: String?

    let ears = SpeechEngine()
    let mouth = VoiceOut()
    let live = XaiRealtime()
    /// True while the real-time xAI socket is carrying the conversation.
    private(set) var realtime = false
    private var history: [ChatMessage] = []
    weak var nav: AppNav?
    var role: Role = .client

    init() {
        mouth.enabled = true
        ears.onFinal = { [weak self] text in self?.heardFinal(text) }
        mouth.onFinished = { [weak self] in self?.afterSpeaking() }

        live.onState = { [weak self] s in
            guard let self, self.realtime else { return }
            switch s {
            case .idle: self.state = .idle
            case .connecting, .thinking: self.state = .thinking
            case .listening: self.state = .listening
            case .speaking: self.state = .speaking
            }
            self.heard = self.live.heard
            self.said = self.live.said
            self.doing = self.live.doing
        }
        live.onDirective = { [weak self] d in
            guard let self else { return }
            self.nav?.apply(d, role: self.role)
        }
        live.onExchange = { [weak self] u, a in
            guard let self else { return }
            self.heard = u; self.said = a
            if !u.isEmpty { self.history.append(ChatMessage(kind: .user, text: u)) }
            if !a.isEmpty { self.history.append(ChatMessage(kind: .aera, text: a)) }
            self.onExchange?(u, a)
        }
        live.onClosed = { [weak self] reason in
            Log.failure("voice.rt.dropped", nil, area: "voice", label: "Realtime voice dropped: " + reason)
            // The socket dropped mid-conversation: keep her talking on the Deepgram loop.
            guard let self, self.active, self.realtime else { return }
            self.realtime = false
            self.error = "Live voice dropped (\(reason)). Switched to the standard voice."
            self.listen()
        }
    }

    /// A finished spoken turn, so the chat screen can keep the transcript.
    var onExchange: ((String, String) -> Void)?

    private var openedAt = Date()

    func open() {
        active = true; error = nil
        state = .thinking
        openedAt = Date()
        Log.event("voice.open", area: "voice", label: "Opened the voice layer")
        Task { @MainActor in
            // Real time first. If it cannot open, fall back to listen, think, speak.
            let ok = await live.start()
            guard self.active else { if ok { self.live.stop() }; return }
            self.realtime = ok
            if ok {
                self.state = .listening
            } else {
                Log.event("voice.fallback", area: "voice", label: "Realtime unavailable, using the Deepgram loop")
                self.listen()
            }
        }
    }

    func close() {
        if active {
            Log.event("voice.close", area: "voice", label: "Closed the voice layer",
                      ms: Int(Date().timeIntervalSince(openedAt) * 1000),
                      detail: ["engine": realtime ? "xai" : "deepgram"])
            Log.flush()
        }
        active = false
        realtime = false
        live.stop()
        ears.stop(); mouth.stop()
        state = .idle
    }

    var muted: Bool { realtime ? live.muted : ears.muted }
    func toggleMute() {
        if realtime { live.toggleMute() } else { ears.muted.toggle() }
        Log.event("voice.mute", area: "voice", label: muted ? "Muted the mic" : "Unmuted the mic")
    }

    /// Tap while she is talking: interrupt and listen.
    func interrupt() {
        Log.event("voice.interrupt", area: "voice", label: "Interrupted AERA")
        if realtime { live.interrupt(); return }
        mouth.stop()
        listen()
    }

    /// Mic level for the waveform, whichever engine is live.
    var level: CGFloat { realtime ? live.level : ears.level }

    private func listen() {
        guard active else { return }
        heard = ""
        state = .listening
        ears.start()
    }

    private func heardFinal(_ text: String) {
        guard active, state == .listening else { return }
        heard = Self.fixName(text)
        ears.stop()
        state = .thinking
        let confirmed = pendingConfirm != nil && Self.isYes(text)
        if pendingConfirm != nil && Self.isNo(text) {
            pendingConfirm = nil
            speak("Okay, leaving it as is.")
            return
        }
        history.append(ChatMessage(kind: .user, text: heard))
        Task { await respond(confirm: confirmed) }
    }

    private func respond(confirm: Bool) async {
        let t0 = Date()
        do {
            let r = try await Repo.shared.act(history, confirm: confirm)
            Log.event("voice.turn", area: "voice", label: String(heard.prefix(200)),
                      ms: Int(Date().timeIntervalSince(t0) * 1000),
                      detail: ["engine": "deepgram", "reply": String((r.say ?? "").prefix(200))])
            pendingConfirm = nil
            for d in r.ui ?? [] { await MainActor.run { nav?.apply(d, role: role) } }
            if let c = r.needsConfirm { pendingConfirm = c.tool }
            let text = r.say ?? "Done."
            history.append(ChatMessage(kind: .aera, text: text))
            await MainActor.run { speak(text) }
        } catch {
            Log.failure("voice.turn", error, area: "voice", label: String(heard.prefix(200)), ms: Int(Date().timeIntervalSince(t0) * 1000), detail: ["engine": "deepgram"])
            await MainActor.run {
                self.error = error.localizedDescription
                speak("I could not reach the server just now.")
            }
        }
    }

    private func speak(_ text: String) {
        said = text
        state = .speaking
        Task { await mouth.say(text) }
    }

    private func afterSpeaking() {
        guard active else { return }
        listen()
    }

    /// Speech engines hear "era", "arrow", "ara", "aira" for AERA. Fix it before it is shown or sent.
    static func fixName(_ t: String) -> String {
        var out = t
        for pat in ["\\b[Aa]rrow\\b", "\\b[Ee]ra\\b", "\\b[Aa]ra\\b", "\\b[Aa]ira\\b", "\\b[Aa]yra\\b", "\\b[Ee]rra\\b", "\\b[Aa]era\\b"] {
            out = out.replacingOccurrences(of: pat, with: "AERA", options: .regularExpression)
        }
        return out
    }

    static func isYes(_ t: String) -> Bool {
        let s = t.lowercased()
        return ["yes", "yeah", "yep", "do it", "go ahead", "confirm", "sure", "publish it", "send it"].contains { s.contains($0) }
    }
    static func isNo(_ t: String) -> Bool {
        let s = t.lowercased()
        return ["no", "nope", "cancel", "stop", "never mind", "hold on"].contains { s.contains($0) }
    }
}
