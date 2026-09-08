import SwiftUI

/// First-run intro: title, welcome, three beats. Tap to skip ahead.
struct IntroView: View {
    @Environment(Session.self) private var session
    @State private var beat = 0
    @State private var show = false

    private let lines = [
        ("APEX AERA", "Your marketing, running itself."),
        ("One brand companion.", "AERA studies your brand, watches your content, researches your market, and runs the posting."),
        ("Everything in your pocket.", "Upload from your camera roll, approve posts with a tap, and talk to AERA anywhere."),
    ]

    var body: some View {
        ZStack {
            ApexBackground()
            VStack(spacing: 18) {
                Spacer()
                if beat == 0 { AuthMark(size: 92).transition(.scale.combined(with: .opacity)) }
                Text(lines[beat].0)
                    .font(.system(size: beat == 0 ? 40 : 30, weight: .black)).tracking(beat == 0 ? 6 : -0.5)
                    .foregroundStyle(Theme.text).multilineTextAlignment(.center)
                    .id("t\(beat)").transition(.opacity.combined(with: .move(edge: .bottom)))
                Rectangle().fill(LinearGradient(colors: [.clear, Theme.cyan, .clear], startPoint: .leading, endPoint: .trailing)).frame(width: 140, height: 1)
                Text(lines[beat].1)
                    .font(.system(size: 16)).foregroundStyle(Theme.text3).multilineTextAlignment(.center).lineSpacing(4)
                    .padding(.horizontal, 32)
                    .id("s\(beat)").transition(.opacity)
                Spacer()
                if beat == lines.count - 1 {
                    PrimaryButton(title: "Enter", icon: "arrow.right") { session.finishIntro() }
                        .padding(.horizontal, 32).transition(.opacity)
                } else {
                    Text("TAP TO CONTINUE").font(.system(size: 11, weight: .semibold)).tracking(2).foregroundStyle(Theme.text4)
                }
                Spacer().frame(height: 40)
            }
            .opacity(show ? 1 : 0)
        }
        .contentShape(Rectangle())
        .onTapGesture { if beat < lines.count - 1 { withAnimation(.easeInOut(duration: 0.6)) { beat += 1 } } }
        .onAppear { withAnimation(.easeOut(duration: 1.1)) { show = true } }
        .animation(.easeInOut(duration: 0.6), value: beat)
    }
}
