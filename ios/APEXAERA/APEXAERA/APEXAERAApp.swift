import SwiftUI

@main
struct APEXAERAApp: App {
    @State private var session = Session()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .preferredColorScheme(.dark)
                .tint(Theme.cyan)
        }
    }
}
