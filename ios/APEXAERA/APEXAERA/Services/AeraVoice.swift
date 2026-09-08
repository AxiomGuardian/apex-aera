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

    let ears = SpeechEngine()
    let mouth = VoiceOut()
    private var history: [ChatMessage] = []
    weak var nav: AppNav?
    var role: Role = .client

    init() {
        mouth.enabled = true
        ears.onFinal = { [weak self] text in self?.heardFinal(text) }
        mouth.onFinished = { [weak self] in self?.afterSpeaking() }
    }

    func open() {
        active = true; error = nil
        listen()
    }

    func close() {
        active = false
        ears.stop(); mouth.stop()
        state = .idle
    }

    /// Tap while she is talking: interrupt and listen.
    func interrupt() {
        mouth.stop()
        listen()
    }

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
        do {
            let r = try await Repo.shared.act(history, confirm: confirm)
            pendingConfirm = nil
            for d in r.ui ?? [] { await MainActor.run { nav?.apply(d, role: role) } }
            if let c = r.needsConfirm { pendingConfirm = c.tool }
            let text = r.say ?? "Done."
            history.append(ChatMessage(kind: .aera, text: text))
            await MainActor.run { speak(text) }
        } catch {
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
