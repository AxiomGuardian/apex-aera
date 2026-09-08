import SwiftUI

/// The floating AERA presence: slides under the header on any tab and stays while you move around.
struct VoiceCapsule: View {
    @Environment(AeraVoice.self) private var aera

    private var label: String {
        switch aera.state {
        case .idle: return "Tap to talk"
        case .listening: return "Listening"
        case .thinking: return "Thinking"
        case .speaking: return "AERA"
        }
    }
    private var body_text: String {
        switch aera.state {
        case .listening: return aera.heard.isEmpty ? (aera.ears.transcript.isEmpty ? "I am listening." : aera.ears.transcript) : aera.heard
        case .thinking: return aera.heard
        case .speaking: return aera.said
        case .idle: return ""
        }
    }

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(Theme.surface2).overlay(Circle().stroke(Theme.cyan.opacity(0.5), lineWidth: 1))
                    if aera.state == .speaking { Circle().stroke(Theme.cyan.opacity(0.5), lineWidth: 2).scaleEffect(1.25).opacity(0.6) }
                    Image("ApexMark").resizable().scaledToFit().frame(width: 16)
                }
                .frame(width: 34, height: 34)
                .onTapGesture { if aera.state == .speaking { aera.interrupt() } }
                VStack(alignment: .leading, spacing: 2) {
                    Text(label.uppercased()).font(.system(size: 10, weight: .bold)).tracking(2).foregroundStyle(Theme.cyanSoft)
                    if !body_text.isEmpty {
                        Text(body_text).font(.system(size: 13.5)).foregroundStyle(Theme.text).lineLimit(3)
                    }
                }
                Spacer()
                WaveformBars(level: aera.state == .listening ? aera.ears.level : (aera.state == .speaking ? 0.5 : 0), active: aera.state == .listening || aera.state == .speaking, bars: 9)
                    .frame(width: 56)
                Button { aera.close() } label: {
                    Image(systemName: "xmark").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.text3).frame(width: 28, height: 28)
                        .background(Theme.surface2, in: Circle())
                }
            }
            if let e = aera.error { Text(e).font(.system(size: 11)).foregroundStyle(Theme.rose) }
            if aera.pendingConfirm != nil {
                Text("Say yes to confirm, or no to leave it.").font(.system(size: 11.5)).foregroundStyle(Theme.amber)
            }
        }
        .padding(12)
        .background(Theme.surface.opacity(0.96), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Theme.cyan.opacity(0.35), lineWidth: 1))
        .overlay(OrbitBeam(color: Theme.cyan, radius: 18, speed: aera.state == .thinking ? 1.2 : 0.35))
        .shadow(color: Theme.cyan.opacity(0.25), radius: 24, y: 8)
        .padding(.horizontal, 14)
        .animation(.easeInOut(duration: 0.25), value: aera.state)
    }
}

/// Pulsing ring AERA draws around whatever she is talking about.
struct AeraHighlight: ViewModifier {
    @Environment(AppNav.self) private var nav
    let kind: String
    let id: String
    @State private var pulse = false
    private var on: Bool { nav.highlight?.kind == kind && nav.highlight?.id == id }
    func body(content: Content) -> some View {
        content
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Theme.cyan.opacity(on ? (pulse ? 0.9 : 0.35) : 0), lineWidth: 1.5)
                    .padding(-6)
            )
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.cyan.opacity(on ? 0.06 : 0)).padding(-6))
            .animation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true), value: pulse)
            .onChange(of: on, initial: true) { _, v in pulse = v }
    }
}
extension View {
    func aeraHighlight(_ kind: String, _ id: String) -> some View { modifier(AeraHighlight(kind: kind, id: id)) }
}
