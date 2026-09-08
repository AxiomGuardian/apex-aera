import SwiftUI

struct ChatView: View {
    @Environment(Session.self) private var session
    @State private var messages: [ChatMessage] = []
    @State private var draft = ""
    @State private var thinking = false
    @State private var speech = SpeechEngine()
    @State private var context: String?
    @FocusState private var focused: Bool

    private var starters: [String] {
        session.role.seesClients
            ? ["What is trending across my clients this week?", "What is waiting in the queue?", "Give me a report on every brand."]
            : ["What is trending for my brand this week?", "What is in my queue?", "What should I post next?"]
    }

    var body: some View {
        ZStack {
            ApexBackground()
            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    AuthMark(size: 40)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("AERA").font(.system(size: 18, weight: .heavy)).tracking(2).foregroundStyle(Theme.text)
                        HStack(spacing: 6) {
                            Circle().fill(speech.listening ? Theme.rose : Theme.green).frame(width: 6, height: 6)
                            Text(speech.listening ? "Listening" : thinking ? "Thinking" : "Awake").font(.system(size: 11)).foregroundStyle(Theme.text3)
                        }
                    }
                    Spacer()
                    if focused {
                        Button("Done") { focused = false }.font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.cyan)
                    }
                }
                .padding(.horizontal, 20).padding(.vertical, 12)

                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(spacing: 12) {
                            if messages.isEmpty {
                                VStack(spacing: 10) {
                                    Text("Ask me anything about your brand.").font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.text2)
                                    ForEach(starters, id: \.self) { s in
                                        Button { draft = s; send() } label: {
                                            Text(s).font(.system(size: 13)).foregroundStyle(Theme.cyanSoft).padding(.horizontal, 14).padding(.vertical, 9)
                                                .background(Theme.cyan.opacity(0.08), in: Capsule()).overlay(Capsule().stroke(Theme.cyan.opacity(0.25), lineWidth: 1))
                                        }
                                        .touchGlow(Theme.cyan, radius: 20)
                                    }
                                }
                                .padding(.top, 50)
                            }
                            ForEach(messages) { m in
                                HStack {
                                    if m.kind == .user { Spacer(minLength: 50) }
                                    Text(m.text).font(.system(size: 15)).lineSpacing(3)
                                        .foregroundStyle(m.kind == .user ? Color(red: 0.02, green: 0.07, blue: 0.10) : Theme.text)
                                        .padding(.horizontal, 14).padding(.vertical, 11)
                                        .background(m.kind == .user ? AnyShapeStyle(Theme.cyan) : AnyShapeStyle(Theme.surface), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                                        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(m.kind == .user ? .clear : Theme.border, lineWidth: 1))
                                    if m.kind == .aera { Spacer(minLength: 50) }
                                }
                                .id(m.id)
                            }
                            if thinking {
                                HStack { ProgressView().tint(Theme.cyan); Text("AERA is thinking").font(.system(size: 12)).foregroundStyle(Theme.text3); Spacer() }.id("thinking")
                            }
                        }
                        .padding(.horizontal, 16).padding(.bottom, 12)
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .dismissKeyboardOnTap()
                    .onChange(of: messages.count) { _, _ in withAnimation { proxy.scrollTo(messages.last?.id, anchor: .bottom) } }
                }

                // Listening strip
                if speech.listening {
                    VStack(spacing: 6) {
                        WaveformBars(level: speech.level, active: speech.listening)
                        Text(speech.transcript.isEmpty ? "Listening. Tap the square when you are done." : "Tap the square when you are done.")
                            .font(.system(size: 12)).foregroundStyle(Theme.text3)
                    }
                    .padding(.horizontal, 20).padding(.vertical, 10)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                if let e = speech.error { Text(e).font(.system(size: 12)).foregroundStyle(Theme.rose).padding(.horizontal, 20) }

                HStack(spacing: 10) {
                    Button {
                        if speech.listening {
                            speech.stop()
                            draft = AeraVoice.fixName(speech.transcript)
                        } else { focused = false; speech.start() }
                    } label: {
                        ZStack {
                            Circle().fill(speech.listening ? Theme.rose : Theme.surface2)
                                .overlay(Circle().stroke(speech.listening ? Theme.rose : Theme.borderMid, lineWidth: 1))
                            if speech.listening {
                                Circle().stroke(Theme.rose.opacity(0.5), lineWidth: 2).scaleEffect(1 + speech.level * 0.6).opacity(1 - Double(speech.level) * 0.6)
                            }
                            Image(systemName: speech.listening ? "stop.fill" : "mic.fill").font(.system(size: 15, weight: .bold))
                                .foregroundStyle(speech.listening ? .white : Theme.text2)
                        }
                        .frame(width: 42, height: 42)
                    }
                    .animation(.easeOut(duration: 0.15), value: speech.level)
                    TextField("Talk to AERA", text: $draft, axis: .vertical).lineLimit(1...4).focused($focused).apexInput()
                        .submitLabel(.send).onSubmit(send)
                    Button(action: send) {
                        Image(systemName: "arrow.up").font(.system(size: 15, weight: .bold)).foregroundStyle(Color(red: 0.02, green: 0.07, blue: 0.10))
                            .frame(width: 42, height: 42).background(Theme.cyan, in: Circle()).shadow(color: Theme.cyan.opacity(0.35), radius: 10)
                    }
                    .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty || thinking)
                }
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(Theme.bg.opacity(0.9))
            }
            .animation(.easeInOut(duration: 0.3), value: speech.listening)
        }
        .task { context = try? await Repo.shared.brandContext() }
        .onChange(of: speech.transcript) { _, t in if speech.listening { draft = AeraVoice.fixName(t) } }
        .onDisappear { if speech.listening { speech.stop() } }
    }

    private func send() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !thinking else { return }
        draft = ""; focused = false
        messages.append(ChatMessage(kind: .user, text: text))
        thinking = true
        Task {
            do {
                let r = try await Repo.shared.chat(messages, context: context)
                messages.append(ChatMessage(kind: .aera, text: r.content, thinking: r.thinking))
            } catch {
                messages.append(ChatMessage(kind: .aera, text: "I could not reach the server: \(error.localizedDescription)"))
            }
            thinking = false
        }
    }
}
