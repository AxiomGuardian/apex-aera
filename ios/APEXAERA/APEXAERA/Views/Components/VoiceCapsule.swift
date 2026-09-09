import SwiftUI

/// AERA's presence while you talk to her. Sits at the bottom, just above the tabs,
/// out of the way of what she is changing on screen. Shows exactly one thing at a
/// time: who is talking, what was heard or said, and what she is doing about it.
struct VoiceCapsule: View {
    @Environment(AeraVoice.self) private var aera

    private var stateLabel: String {
        switch aera.state {
        case .idle:      return "Ready"
        case .listening: return aera.muted ? "Muted" : "Listening"
        case .thinking:  return aera.doing ?? "Thinking"
        case .speaking:  return "AERA"
        }
    }

    private var stateColor: Color {
        if aera.muted { return Theme.rose }
        switch aera.state {
        case .listening: return Theme.cyan
        case .thinking:  return Theme.amber
        case .speaking:  return Theme.cyan
        case .idle:      return Theme.text3
        }
    }

    private var line: String {
        switch aera.state {
        case .listening: return aera.heard.isEmpty ? "Go ahead." : aera.heard
        case .thinking:  return aera.heard.isEmpty ? "Working on it." : aera.heard
        case .speaking:  return aera.said
        case .idle:      return ""
        }
    }

    var body: some View {
        VStack(spacing: 7) {
            if let e = aera.error {
                Text(e)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.rose)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if aera.pendingConfirm != nil {
                Text("Say yes to confirm, or no to leave it.")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.amber)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            HStack(spacing: 11) {
                // Mark. Tap to cut her off.
                Button {
                    if aera.state == .speaking { aera.interrupt() }
                } label: {
                    ZStack {
                        Circle().fill(Theme.surface2)
                        Circle().stroke(stateColor.opacity(0.55), lineWidth: 1)
                        if aera.state == .speaking {
                            Circle().stroke(Theme.cyan.opacity(0.35), lineWidth: 2)
                                .scaleEffect(1.3)
                                .opacity(0.7)
                        }
                        Image("ApexMark").resizable().scaledToFit().frame(width: 15)
                    }
                    .frame(width: 36, height: 36)
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Circle().fill(stateColor).frame(width: 5, height: 5)
                        Text(stateLabel.uppercased())
                            .font(.system(size: 9.5, weight: .bold))
                            .tracking(1.6)
                            .foregroundStyle(stateColor)
                            .lineLimit(1)
                    }
                    if !line.isEmpty {
                        Text(line)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.text)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                            .animation(nil, value: line)
                    }
                }

                Spacer(minLength: 4)

                WaveformBars(
                    level: aera.state == .listening ? aera.level : (aera.state == .speaking ? 0.55 : 0.12),
                    active: aera.state == .listening || aera.state == .speaking,
                    bars: 11
                )
                .frame(width: 52, height: 22)

                Button { aera.toggleMute() } label: {
                    Image(systemName: aera.muted ? "mic.slash.fill" : "mic.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(aera.muted ? Theme.rose : Theme.text3)
                        .frame(width: 30, height: 30)
                        .background(aera.muted ? Theme.rose.opacity(0.15) : Theme.surface2, in: Circle())
                        .overlay(Circle().stroke(aera.muted ? Theme.rose.opacity(0.5) : .clear, lineWidth: 1))
                }
                .buttonStyle(.plain)

                Button { aera.close() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.text3)
                        .frame(width: 30, height: 30)
                        .background(Theme.surface2, in: Circle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .background(Theme.surface.opacity(0.82), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(stateColor.opacity(aera.state == .idle ? 0.18 : 0.4), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.35), radius: 18, y: 6)
        .shadow(color: stateColor.opacity(0.18), radius: 22, y: 0)
        .padding(.horizontal, 12)
        .animation(.easeInOut(duration: 0.22), value: aera.state)
        .animation(.easeInOut(duration: 0.22), value: aera.muted)
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
