import SwiftUI

/// Cold-open: the mark lands, the name tracks in, a line sweeps, then the app fades up underneath.
struct LaunchView: View {
    @State private var mark = false
    @State private var glow = false
    @State private var title = false
    @State private var line: CGFloat = 0
    @State private var out = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            ApexBackground().opacity(glow ? 1 : 0)
            Circle().fill(RadialGradient(colors: [Theme.cyan.opacity(0.35), .clear], center: .center, startRadius: 0, endRadius: 260))
                .frame(width: 520, height: 520).blur(radius: 10).scaleEffect(glow ? 1 : 0.4).opacity(glow ? 1 : 0)
            VStack(spacing: 22) {
                Image("ApexMark").resizable().scaledToFit().frame(width: 96)
                    .shadow(color: Theme.cyan.opacity(0.7), radius: glow ? 40 : 0)
                    .scaleEffect(mark ? 1 : 1.06).opacity(mark ? 1 : 0)
                Text("APEX AERA")
                    .font(.system(size: 30, weight: .black)).tracking(title ? 9 : 22)
                    .foregroundStyle(Theme.text).opacity(title ? 1 : 0)
                Rectangle().fill(LinearGradient(colors: [.clear, Theme.cyan, .white, Theme.cyan, .clear], startPoint: .leading, endPoint: .trailing))
                    .frame(width: 200, height: 1.5).scaleEffect(x: line, y: 1, anchor: .center)
            }
        }
        .opacity(out ? 0 : 1)
        .scaleEffect(out ? 1.06 : 1)
        .allowsHitTesting(!out)
        .task {
            // Same beats, about half the running time. A cold open should feel like
            // a signature, not a loading screen.
            withAnimation(.easeOut(duration: 0.55)) { mark = true }
            try? await Task.sleep(for: .seconds(0.14))
            withAnimation(.easeOut(duration: 0.5)) { glow = true }
            try? await Task.sleep(for: .seconds(0.12))
            withAnimation(.easeOut(duration: 0.45)) { title = true }
            try? await Task.sleep(for: .seconds(0.1))
            withAnimation(.easeInOut(duration: 0.45)) { line = 1 }
            try? await Task.sleep(for: .seconds(0.35))
            withAnimation(.easeInOut(duration: 0.4)) { out = true }
        }
    }
}
