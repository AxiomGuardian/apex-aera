import Foundation
import Observation

/// App-wide state: who is signed in, their role, and whether we are in demo mode.
@Observable
final class Session {
    enum Phase { case booting, intro, signedOut, welcomeBack, ready, signingOut }

    var phase: Phase = .booting
    var profile: Profile?
    var isDemo = false
    var lastSeen: Date?
    var error: String?

    var role: Role { profile?.role ?? .client }
    var firstName: String { profile?.firstName ?? "there" }

    private let introKey = "apex.intro.seen"
    private let lastSeenKey = "apex.last.seen"

    func boot() async {
        if let s = await SupabaseClient.shared.session {
            do {
                _ = try await SupabaseClient.shared.refreshIfNeeded()
                profile = try await Repo.shared.profile(userId: s.userId, email: s.email)
                lastSeen = UserDefaults.standard.object(forKey: lastSeenKey) as? Date
                phase = .welcomeBack
                return
            } catch { /* fall through to sign in */ }
        }
        phase = UserDefaults.standard.bool(forKey: introKey) ? .signedOut : .intro
    }

    func finishIntro() { UserDefaults.standard.set(true, forKey: introKey); phase = .signedOut }

    func signIn(email: String, password: String) async {
        error = nil
        do {
            let s = try await SupabaseClient.shared.signIn(email: email, password: password)
            profile = try await Repo.shared.profile(userId: s.userId, email: s.email)
            isDemo = false
            lastSeen = UserDefaults.standard.object(forKey: lastSeenKey) as? Date
            phase = .welcomeBack
        } catch { self.error = error.localizedDescription }
    }

    func enterDemo() {
        isDemo = true
        profile = MockData.profile
        lastSeen = Date().addingTimeInterval(-3600 * 14)
        phase = .welcomeBack
    }

    func enter() {
        UserDefaults.standard.set(Date(), forKey: lastSeenKey)
        phase = .ready
    }

    /// Farewell first, then the actual sign-out underneath it.
    func signOut() async {
        phase = .signingOut
        try? await Task.sleep(for: .seconds(3.2))
        if !isDemo { await SupabaseClient.shared.signOut() }
        isDemo = false; profile = nil; phase = .signedOut
    }
}
