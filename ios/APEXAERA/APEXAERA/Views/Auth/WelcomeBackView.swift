import SwiftUI

/// The sign-in sequence: how long you were gone and what AERA did meanwhile.
/// Layered glow and staggered reveals give it depth.
struct WelcomeBackView: View {
    @Environment(Session.self) private var session
    @State private var step = 0
    @State private var counts = PipelineCounts()
    @State private var drift: CGFloat = 0
    @State private var brief: String?
    @State private var loadingBrief = true

    private var gone: String {
        guard let l = session.lastSeen else { return "" }
        let s = Int(Date().timeIntervalSince(l))
        if s < 3600 { return "Gone \(max(1, s / 60)) min" }
        if s < 86400 { return "Gone \(s / 3600) hours" }
        return "Gone \(s / 86400) days"
    }

    var body: some View {
        ZStack {
            ApexBackground()
            // Depth: two drifting halos behind the mark
            Circle().fill(RadialGradient(colors: [Theme.cyan.opacity(0.22), .clear], center: .center, startRadius: 0, endRadius: 220))
                .frame(width: 440, height: 440).offset(y: -140 + drift * 12).blur(radius: 6)
            Circle().fill(RadialGradient(colors: [Theme.violet.opacity(0.12), .clear], center: .center, startRadius: 0, endRadius: 200))
                .frame(width: 400, height: 400).offset(x: 90, y: 120 - drift * 18).blur(radius: 8)

            VStack(spacing: 18) {
                Spacer()
                AuthMark(size: 84)
                    .opacity(step >= 1 ? 1 : 0).scaleEffect(step >= 1 ? 1 : 0.7)
                    .rotation3DEffect(.degrees(Double(drift) * 4), axis: (x: 1, y: 0, z: 0))
                Text(gone.uppercased()).font(.system(size: 11, weight: .bold)).tracking(3).foregroundStyle(Theme.cyanSoft)
                    .opacity(step >= 1 && !gone.isEmpty ? 1 : 0)
                Text("Welcome back, \(session.firstName).")
                    .font(.system(size: 32, weight: .heavy)).foregroundStyle(Theme.text).multilineTextAlignment(.center)
                    .opacity(step >= 1 ? 1 : 0).offset(y: step >= 1 ? 0 : 14)
                    .shadow(color: Theme.cyan.opacity(0.25), radius: 24)
                VStack(alignment: .leading, spacing: 10) {
                    if let brief {
                        Text(brief).font(.system(size: 15.5)).foregroundStyle(Theme.text2).multilineTextAlignment(.center).lineSpacing(4).padding(.horizontal, 28)
                            .transition(.opacity)
                    } else if loadingBrief {
                        Text("Catching up on what happened.")
                            .font(.system(size: 15)).foregroundStyle(Theme.text4)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .transition(.opacity)
                    } else if counts.published + counts.scheduled + counts.analyzed == 0 {
                        line("AERA kept watch. Nothing needed you.", delay: 0)
                    } else {
                        if counts.published > 0 { line("\(counts.published) published while you were away", delay: 0) }
                        if counts.scheduled > 0 { line("\(counts.scheduled) scheduled and waiting for their window", delay: 0.15) }
                        if counts.analyzed > 0 { line("\(counts.analyzed) analyzed and ready for captions", delay: 0.3) }
                    }
                }
                .frame(minHeight: 110)
                .opacity(step >= 2 ? 1 : 0)
                Spacer()
                PrimaryButton(title: "Enter your workspace", icon: "arrow.right") { session.enter() }
                    .padding(.horizontal, 32)
                    .opacity(step >= 2 ? 1 : 0).offset(y: step >= 2 ? 0 : 20)
                Spacer().frame(height: 40)
            }
        }
        .task {
            withAnimation(.easeInOut(duration: 6).repeatForever(autoreverses: true)) { drift = 1 }

            // Show the screen first. This used to wait on the pipeline count and on
            // AERA writing the brief, which is a live model call, so the app sat on a
            // blank background for ten or twenty seconds before anything appeared.
            withAnimation(.spring(duration: 0.7, bounce: 0.2)) { step = 1 }
            try? await Task.sleep(for: .seconds(0.45))
            withAnimation(.easeOut(duration: 0.5)) { step = 2 }

            // The brief arrives when it arrives and fades in behind the reveal.
            Task {
                let c = (try? await Repo.shared.pipeline()) ?? PipelineCounts()
                await MainActor.run { withAnimation(.easeOut(duration: 0.4)) { counts = c } }
            }
            Task {
                let b = try? await Repo.shared.brief()
                await MainActor.run {
                    withAnimation(.easeOut(duration: 0.5)) { brief = b; loadingBrief = false }
                }
            }
            // Do not hold someone on a greeting. Tapping anywhere still skips it.
            try? await Task.sleep(for: .seconds(4.5))
            if session.phase == .welcomeBack { session.enter() }
        }
        .contentShape(Rectangle()).onTapGesture { session.enter() }
    }

    private func line(_ t: String, delay: Double) -> some View {
        HStack(spacing: 10) {
            Circle().fill(Theme.cyan).frame(width: 5, height: 5).shadow(color: Theme.cyan, radius: 4)
            Text(t).font(.system(size: 15)).foregroundStyle(Theme.text2)
        }
        .transition(.opacity)
        .animation(.easeOut(duration: 0.5).delay(delay), value: step)
    }
}
