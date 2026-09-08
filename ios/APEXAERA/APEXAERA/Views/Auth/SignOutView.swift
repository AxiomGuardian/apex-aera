import SwiftUI

/// Farewell curtain. Solid the whole time so nothing flashes behind it.
struct SignOutView: View {
    @Environment(Session.self) private var session
    @State private var step = 0

    var body: some View {
        ZStack {
            ApexBackground()
            VStack(spacing: 14) {
                AuthMark(size: 72).opacity(step >= 1 ? 1 : 0).scaleEffect(step >= 1 ? 1 : 0.8)
                Text("UNTIL NEXT TIME").font(.system(size: 11, weight: .bold)).tracking(4).foregroundStyle(Theme.cyanSoft).opacity(step >= 1 ? 1 : 0)
                Text("See you soon, \(session.firstName).")
                    .font(.system(size: 30, weight: .heavy)).foregroundStyle(Theme.text).multilineTextAlignment(.center)
                    .opacity(step >= 1 ? 1 : 0).offset(y: step >= 1 ? 0 : 10)
                Text("AERA keeps working while you are away.")
                    .font(.system(size: 14)).foregroundStyle(Theme.text3)
                    .opacity(step >= 2 ? 1 : 0)
            }
            .opacity(step >= 3 ? 0 : 1)
        }
        .task {
            withAnimation(.easeOut(duration: 0.8)) { step = 1 }
            try? await Task.sleep(for: .seconds(0.7))
            withAnimation(.easeOut(duration: 0.6)) { step = 2 }
            try? await Task.sleep(for: .seconds(1.7))
            withAnimation(.easeIn(duration: 0.6)) { step = 3 }
        }
    }
}
