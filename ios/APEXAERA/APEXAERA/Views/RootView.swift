import SwiftUI

struct RootView: View {
    @Environment(Session.self) private var session
    @State private var launching = true

    var body: some View {
        ZStack {
            switch session.phase {
            case .booting:
                ApexBackground().overlay(ProgressView().tint(Theme.cyan))
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
            async let boot: () = session.boot()
            try? await Task.sleep(for: .seconds(3.9))
            _ = await boot
            launching = false
        }
        .onChange(of: session.isDemo, initial: true) { _, v in Repo.shared.demo = v }
    }
    private var phaseKey: Int {
        switch session.phase { case .booting: 0; case .intro: 1; case .signedOut: 2; case .welcomeBack: 3; case .ready: 4; case .signingOut: 5 }
    }
}
