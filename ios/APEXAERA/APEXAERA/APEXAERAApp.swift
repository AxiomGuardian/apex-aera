import SwiftUI

@main
struct APEXAERAApp: App {
    @State private var session = Session()
    @State private var nav = AppNav()
    @State private var aera = AeraVoice()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(nav)
                .environment(aera)
                .preferredColorScheme(.dark)
                .tint(Theme.cyan)
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .background, .inactive:
                // Whatever happened right before they put the phone down still lands.
                Log.event("app.background", area: "system", label: "Left the app")
                Log.flush()
            case .active:
                Log.event("app.foreground", area: "system", label: "Came back to the app")
            @unknown default:
                break
            }
        }
    }
}
