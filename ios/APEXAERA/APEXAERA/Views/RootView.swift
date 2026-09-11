import SwiftUI

struct RootView: View {
    @Environment(Session.self) private var session
    @State private var launching = true

    var body: some View {
        ZStack {
            switch session.phase {
            case .booting:
                BootingView()
            case .intro:
                IntroView()
            case .signedOut:
                LoginView()
            case .welcomeBack:
                WelcomeBackView()
            case .ready:
                MainTabs()
            case .signingOut:
                SignOutView()
            }
            if launching { LaunchView().zIndex(10) }
        }
        .animation(.easeInOut(duration: 0.55), value: phaseKey)
        .task {
            // The film is a floor, not a wait. It used to hold for a flat 3.9 seconds
            // and, worse, waited for boot() to finish, so a slow network meant staring
            // at a frozen screen. Now it shows for one beat, leaves as soon as the
            // session is known, and never holds past the cap whatever the network does.
            let boot = Task { await session.boot() }

            try? await Task.sleep(for: .seconds(1.25))

            await withTaskGroup(of: Void.self) { group in
                group.addTask { await boot.value }
                group.addTask { try? await Task.sleep(for: .seconds(1.75)) }
                await group.next()
                group.cancelAll()
            }

            withAnimation(.easeOut(duration: 0.35)) { launching = false }
        }
        .onChange(of: session.isDemo, initial: true) { _, v in Repo.shared.demo = v }
    }
    private var phaseKey: Int {
        switch session.phase { case .booting: 0; case .intro: 1; case .signedOut: 2; case .welcomeBack: 3; case .ready: 4; case .signingOut: 5 }
    }
}


/// Shown while the app is working out who is signed in. If that takes longer than
/// a few seconds something is wrong with the connection, so say so and offer a way out
/// instead of sitting on a blank screen.
struct BootingView: View {
    @Environment(Session.self) private var session
    @State private var slow = false

    var body: some View {
        ZStack {
            ApexBackground()
            VStack(spacing: 16) {
                ProgressView().tint(Theme.cyan)
                if slow {
                    Text(session.error ?? "This is taking longer than it should.")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.text3)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                    Button("Go to sign in") { session.giveUpBooting() }
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.cyan)
                }
            }
        }
        .task {
            try? await Task.sleep(for: .seconds(6))
            withAnimation { slow = true }
        }
    }
}
