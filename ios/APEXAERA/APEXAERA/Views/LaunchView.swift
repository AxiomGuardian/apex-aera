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
                    .scaleEffect(mark ? 1 : 1.9).opacity(mark ? 1 : 0)
                    .rotation3DEffect(.degrees(mark ? 0 : 35), axis: (x: 1, y: 0, z: 0))
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
            withAnimation(.spring(duration: 0.9, bounce: 0.25)) { mark = true }
            try? await Task.sleep(for: .seconds(0.35))
            withAnimation(.easeOut(duration: 1.0)) { glow = true }
            try? await Task.sleep(for: .seconds(0.3))
            withAnimation(.easeOut(duration: 0.9)) { title = true }
            try? await Task.sleep(for: .seconds(0.25))
            withAnimation(.easeInOut(duration: 0.8)) { line = 1 }
            try? await Task.sleep(for: .seconds(1.2))
            withAnimation(.easeInOut(duration: 0.7)) { out = true }
        }
    }
}
