import SwiftUI

/// APEX design tokens. Mirrors the web portal's dark theme.
enum Theme {
    static let bg        = Color(red: 0.043, green: 0.043, blue: 0.055)   // #0b0b0e
    static let bgDeep    = Color(red: 0.035, green: 0.043, blue: 0.055)
    static let surface   = Color(red: 0.086, green: 0.094, blue: 0.114)   // #16181d
    static let surface2  = Color(red: 0.125, green: 0.133, blue: 0.157)
    static let border    = Color.white.opacity(0.08)
    static let borderMid = Color.white.opacity(0.14)
    static let text      = Color(red: 0.91, green: 0.91, blue: 0.91)
    static let text2     = Color(red: 0.78, green: 0.78, blue: 0.80)
    static let text3     = Color(red: 0.60, green: 0.60, blue: 0.64)
    static let text4     = Color(red: 0.43, green: 0.43, blue: 0.47)
    static let cyan      = Color(red: 0.176, green: 0.831, blue: 1.0)     // #2DD4FF
    static let cyanSoft  = Color(red: 0.608, green: 0.906, blue: 1.0)     // #9be7ff
    static let green     = Color(red: 0.204, green: 0.827, blue: 0.600)   // #34D399
    static let amber     = Color(red: 0.984, green: 0.749, blue: 0.141)   // #fbbf24
    static let rose      = Color(red: 0.984, green: 0.443, blue: 0.522)   // #fb7185
    static let violet    = Color(red: 0.655, green: 0.545, blue: 0.980)
}

/// Ambient background used on every screen: deep black with a cyan bloom at the top.
struct ApexBackground: View {
    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            RadialGradient(colors: [Theme.cyan.opacity(0.16), .clear], center: .init(x: 0.5, y: -0.1), startRadius: 0, endRadius: 420)
                .ignoresSafeArea()
            RadialGradient(colors: [Theme.cyan.opacity(0.06), .clear], center: .init(x: 1.0, y: 1.05), startRadius: 0, endRadius: 320)
                .ignoresSafeArea()
        }
    }
}

/// Card surface with a hairline border and a soft accent line on top.
struct ApexCard<Content: View>: View {
    var accent: Color = Theme.cyan
    var quiet: Bool = false
    var padding: CGFloat = 18
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface.opacity(0.85), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Theme.border, lineWidth: 1))
            .touchGlow(accent, radius: 20)
            .overlay(alignment: .top) {
                if !quiet {
                    LinearGradient(colors: [.clear, accent.opacity(0.85), .clear], startPoint: .leading, endPoint: .trailing)
                        .frame(height: 2)
                        .padding(.horizontal, 40)
                        .offset(y: -0.5)
                }
            }
    }
}

struct SectionLabel: View {
    let text: String
    var body: some View {
        HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 2).fill(Theme.cyan).frame(width: 3, height: 12)
            Text(text.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(1.6)
                .foregroundStyle(Theme.text3)
        }
    }
}

struct Chip: View {
    let text: String
    var color: Color = Theme.cyan
    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 9.5, weight: .bold)).tracking(1)
            .padding(.horizontal, 9).padding(.vertical, 4)
            .foregroundStyle(color)
            .background(color.opacity(0.10), in: Capsule())
            .overlay(Capsule().stroke(color.opacity(0.28), lineWidth: 1))
    }
}

struct PrimaryButton: View {
    let title: String
    var icon: String? = nil
    var busy: Bool = false
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if busy { ProgressView().tint(.black) }
                else if let icon { Image(systemName: icon) }
                Text(title).fontWeight(.bold)
            }
            .font(.system(size: 15))
            .frame(maxWidth: .infinity).padding(.vertical, 15)
            .foregroundStyle(Color(red: 0.02, green: 0.07, blue: 0.10))
            .background(LinearGradient(colors: [Theme.cyan, Color(red: 0.094, green: 0.627, blue: 0.784)], startPoint: .top, endPoint: .bottom), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .shadow(color: Theme.cyan.opacity(0.28), radius: 18, y: 8)
        }
        .touchGlow(.white, radius: 14)
        .disabled(busy)
    }
}

struct GhostButton: View {
    let title: String
    var icon: String? = nil
    var color: Color = Theme.cyan
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let icon { Image(systemName: icon) }
                Text(title).fontWeight(.semibold)
            }
            .font(.system(size: 13))
            .padding(.horizontal, 14).padding(.vertical, 10)
            .foregroundStyle(color)
            .background(color.opacity(0.09), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).stroke(color.opacity(0.28), lineWidth: 1))
        }
        .touchGlow(color, radius: 11)
    }
}

/// The APEX mark inside a glowing ring, like the auth screens on the web.
struct AuthMark: View {
    var size: CGFloat = 64
    var body: some View {
        ZStack {
            Circle().fill(RadialGradient(colors: [Theme.cyan.opacity(0.18), Theme.bg.opacity(0.9)], center: .center, startRadius: 0, endRadius: size / 2))
            Circle().stroke(Theme.cyan.opacity(0.35), lineWidth: 1)
            Image("ApexMark").resizable().scaledToFit().frame(width: size * 0.46)
        }
        .frame(width: size, height: size)
        .shadow(color: Theme.cyan.opacity(0.18), radius: 20)
    }
}

extension View {
    func apexInput() -> some View {
        self.padding(.horizontal, 14).padding(.vertical, 13)
            .background(Color.white.opacity(0.035), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Color.white.opacity(0.10), lineWidth: 1))
            .foregroundStyle(Theme.text)
    }
}

// MARK: - Touch glow (the phone version of hover)

/// A light that orbits the border, like the beam on the website cards.
struct OrbitBeam: View {
    var color: Color = Theme.cyan
    var radius: CGFloat = 20
    var lineWidth: CGFloat = 1.5
    var speed: Double = 1.0     // revolutions per second
    var body: some View {
        TimelineView(.animation(minimumInterval: 1/60)) { t in
            let angle = (t.date.timeIntervalSinceReferenceDate * speed * 360).truncatingRemainder(dividingBy: 360)
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .stroke(
                    AngularGradient(colors: [.clear, .clear, .clear, color.opacity(0.0), color, .white, color.opacity(0.0), .clear], center: .center, angle: .degrees(angle)),
                    lineWidth: lineWidth
                )
        }
        .allowsHitTesting(false)
    }
}

/// Which element currently holds the light. Shared app-wide so only one glows at a time.
@Observable
final class GlowFocus {
    static let shared = GlowFocus()
    var id: UUID? = nil
}

/// Touch a card or button and it lights with the orbiting beam, and stays lit until you touch another.
/// A press detector that yields to scrolling, so lists still scroll normally.
struct TouchGlow: ViewModifier {
    var color: Color = Theme.cyan
    var radius: CGFloat = 20
    @State private var me = UUID()
    @State private var pressing = false
    private var focus: GlowFocus { GlowFocus.shared }
    private var lit: Bool { pressing || focus.id == me }

    func body(content: Content) -> some View {
        content
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(color.opacity(lit ? 0.35 : 0), lineWidth: 1)
            )
            .overlay { if lit { OrbitBeam(color: color, radius: radius, speed: pressing ? 0.8 : 0.35).transition(.opacity) } }
            .shadow(color: color.opacity(lit ? 0.22 : 0), radius: lit ? 22 : 0)
            .scaleEffect(pressing ? 1.01 : 1)
            .animation(.easeOut(duration: 0.25), value: lit)
            .animation(.easeOut(duration: 0.25), value: pressing)
            .onLongPressGesture(minimumDuration: 0.06, maximumDistance: 12, perform: {}, onPressingChanged: { p in
                pressing = p
                if p { focus.id = me }
            })
    }
}

extension View {
    func touchGlow(_ color: Color = Theme.cyan, radius: CGFloat = 20) -> some View { modifier(TouchGlow(color: color, radius: radius)) }
    /// Always-on slow orbit, for hero cards like the login panel.
    func orbitBeam(_ color: Color = Theme.cyan, radius: CGFloat = 24, speed: Double = 0.25) -> some View {
        overlay(OrbitBeam(color: color, radius: radius, lineWidth: 1.2, speed: speed))
    }

    /// Tap anywhere outside a text field to put the keyboard away.
    func dismissKeyboardOnTap() -> some View {
        self.onTapGesture { UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil) }
    }
}

/// Live audio bars, like the dictation waveform on the web.
struct WaveformBars: View {
    var level: CGFloat          // 0...1
    var active: Bool
    var color: Color = Theme.cyan
    var bars: Int = 16
    @State private var phase: CGFloat = 0

    var body: some View {
        TimelineView(.animation(minimumInterval: 1/30, paused: !active)) { t in
            let time = t.date.timeIntervalSinceReferenceDate
            HStack(alignment: .center, spacing: 3) {
                ForEach(0..<bars, id: \.self) { i in
                    let wave = CGFloat(sin(time * 7 + Double(i) * 0.7) * 0.5 + 0.5)
                    let h = active ? 4 + (wave * 0.4 + level * 0.9) * 26 : 4
                    Capsule().fill(color.opacity(active ? 0.55 + Double(wave) * 0.45 : 0.25))
                        .frame(width: 3, height: max(4, h))
                }
            }
            .frame(height: 32)
        }
    }
}
