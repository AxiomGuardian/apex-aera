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
                // Hard ceiling. Reopening the app is exactly when the network is
                // half awake, and without this the whole app waits on it.
                try await withThrowingTaskGroup(of: Void.self) { group in
                    group.addTask {
                        _ = try await SupabaseClient.shared.refreshIfNeeded()
                        let p = try await Repo.shared.profile(userId: s.userId, email: s.email)
                        await MainActor.run { self.profile = p }
                    }
                    group.addTask {
                        try await Task.sleep(for: .seconds(12))
                        throw SupabaseError.decoding("Timed out reaching the server")
                    }
                    try await group.next()
                    group.cancelAll()
                }
                lastSeen = UserDefaults.standard.object(forKey: lastSeenKey) as? Date
                error = nil
                phase = .welcomeBack
                return
            } catch {
                // Signed in but unreachable. Say why rather than sitting on a blank screen.
                self.error = "Could not reach APEX. Check your connection and try again."
            }
        }
        phase = UserDefaults.standard.bool(forKey: introKey) ? .signedOut : .intro
    }

    /// The booting screen's escape hatch.
    func giveUpBooting() {
        error = nil
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
            Log.event("auth.signin", area: "auth", label: "Signed in on the phone", detail: ["email": email])
        } catch {
            self.error = error.localizedDescription
            Log.failure("auth.signin", error, area: "auth", label: "Sign in refused on the phone", detail: ["email": email])
        }
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
        Log.event("auth.signout", area: "auth", label: "Signed out on the phone")
        Log.flush()
        phase = .signingOut
        try? await Task.sleep(for: .seconds(3.2))
        if !isDemo { await SupabaseClient.shared.signOut() }
        isDemo = false; profile = nil; phase = .signedOut
    }
}
