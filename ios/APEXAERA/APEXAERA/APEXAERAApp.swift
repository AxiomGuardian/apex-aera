import SwiftUI

@main
struct APEXAERAApp: App {
    @State private var session = Session()
    @State private var nav = AppNav()
    @State private var aera = AeraVoice()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(nav)
                .environment(aera)
                .preferredColorScheme(.dark)
                .tint(Theme.cyan)
        }
    }
}
