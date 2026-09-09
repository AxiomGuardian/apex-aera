import SwiftUI

/// The AERA tab: same brain as the voice layer (tools, memory, sight, search), with
/// private threads shared with the web portal.
struct ChatView: View {
    @Environment(Session.self) private var session
    @Environment(AppNav.self) private var nav
    @State private var threads: [Repo.Thread] = []
    @State private var thread: Repo.Thread?
    @State private var messages: [ChatMessage] = []
    @State private var draft = ""
    @State private var thinking = false
    @State private var stepsFor: [UUID: [Repo.ActResponse.StepInfo]] = [:]
    @State private var speech = SpeechEngine()
    @State private var showThreads = false
    @State private var pendingConfirm = false
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
                // Header
                HStack(spacing: 12) {
                    AuthMark(size: 40)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("AERA").font(.system(size: 18, weight: .heavy)).tracking(2).foregroundStyle(Theme.text)
                        HStack(spacing: 6) {
                            Circle().fill(speech.listening ? Theme.rose : Theme.green).frame(width: 6, height: 6)
                            Text(speech.listening ? "Listening" : thinking ? "Thinking" : (thread?.name ?? "Awake")).font(.system(size: 11)).foregroundStyle(Theme.text3).lineLimit(1)
                        }
                    }
                    Spacer()
                    if focused {
                        Button("Done") { focused = false }.font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.cyan)
                    }
                    Button { showThreads = true } label: {
                        Image(systemName: "text.bubble").font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.text2)
                            .frame(width: 36, height: 36).background(Theme.surface2, in: Circle()).overlay(Circle().stroke(Theme.borderMid, lineWidth: 1))
                    }
                    Button { Task { await newThread() } } label: {
                        Image(systemName: "plus").font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.cyan)
                            .frame(width: 36, height: 36).background(Theme.cyan.opacity(0.10), in: Circle()).overlay(Circle().stroke(Theme.cyan.opacity(0.35), lineWidth: 1))
                    }
                }
                .padding(.horizontal, 20).padding(.vertical, 12)

                // Conversation
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 14) {
                            if messages.isEmpty {
                                VStack(spacing: 10) {
                                    AuthMark(size: 64).padding(.bottom, 6)
                                    Text("Ask me anything about your brand.").font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.text2)
                                    Text("I can look at your content, search what is trending, and change things in your queue.").font(.system(size: 13)).foregroundStyle(Theme.text3).multilineTextAlignment(.center).padding(.horizontal, 30)
                                    ForEach(starters, id: \.self) { s in
                                        Button { draft = s; send() } label: {
                                            Text(s).font(.system(size: 13)).foregroundStyle(Theme.cyanSoft).padding(.horizontal, 14).padding(.vertical, 9)
                                                .background(Theme.cyan.opacity(0.08), in: Capsule()).overlay(Capsule().stroke(Theme.cyan.opacity(0.25), lineWidth: 1))
                                        }
                                        .touchGlow(Theme.cyan, radius: 20)
                                    }
                                }
                                .padding(.top, 40)
                            }
                            ForEach(messages) { m in
                                if let steps = stepsFor[m.id], !steps.isEmpty {
                                    StepTrailView(steps: steps)
                                        .padding(.leading, 22)
                                        .transition(.opacity)
                                }
                                HStack(alignment: .bottom, spacing: 8) {
                                    if m.kind == .user { Spacer(minLength: 56) }
                                    else { Image("ApexMark").resizable().scaledToFit().frame(width: 14).padding(.bottom, 8).opacity(0.8) }
                                    Text(m.text).font(.system(size: 15.5)).lineSpacing(3.5)
                                        .foregroundStyle(m.kind == .user ? Color(red: 0.02, green: 0.07, blue: 0.10) : Theme.text)
                                        .padding(.horizontal, 15).padding(.vertical, 12)
                                        .background(m.kind == .user ? AnyShapeStyle(Theme.cyan) : AnyShapeStyle(Theme.surface.opacity(0.9)), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                                        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(m.kind == .user ? .clear : Theme.border, lineWidth: 1))
                                        .textSelection(.enabled)
                                    if m.kind == .aera { Spacer(minLength: 40) }
                                }
                                .id(m.id)
                                .transition(.opacity.combined(with: .move(edge: .bottom)))
                            }
                            if thinking {
                                HStack(spacing: 8) { WaveformBars(level: 0.5, active: true, bars: 7).frame(width: 40); Text("AERA is thinking").font(.system(size: 12)).foregroundStyle(Theme.text3); Spacer() }.id("thinking")
                            }
                            if pendingConfirm {
                                HStack(spacing: 8) {
                                    GhostButton(title: "Yes, do it", icon: "checkmark", color: Theme.green) { draft = "yes"; send(confirm: true) }
                                    GhostButton(title: "No", icon: "xmark", color: Theme.rose) { pendingConfirm = false; messages.append(ChatMessage(kind: .aera, text: "Okay, leaving it as is.")) }
                                    Spacer()
                                }
                            }
                            Color.clear.frame(height: 8).id("bottom")
                        }
                        .padding(.horizontal, 16).padding(.top, 6)
                    }
                    .defaultScrollAnchor(.bottom)
                    .scrollDismissesKeyboard(.interactively)
                    .dismissKeyboardOnTap()
                    .onChange(of: messages.count) { _, _ in withAnimation(.easeOut(duration: 0.3)) { proxy.scrollTo("bottom", anchor: .bottom) } }
                    .onChange(of: thinking) { _, t in if t { withAnimation { proxy.scrollTo("thinking", anchor: .bottom) } } }
                }

                // Listening strip
                if speech.listening {
                    VStack(spacing: 6) {
                        WaveformBars(level: speech.level, active: true, bars: 22)
                        Text("Speak. Your words land in the box. Tap the square when you are done.").font(.system(size: 12)).foregroundStyle(Theme.text3)
                    }
                    .padding(.horizontal, 20).padding(.vertical, 10)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                if let e = speech.error { Text(e).font(.system(size: 12)).foregroundStyle(Theme.rose).padding(.horizontal, 20) }

                // Composer
                HStack(spacing: 10) {
                    Button {
                        if speech.listening { speech.stop(); draft = AeraVoice.fixName(speech.transcript) }
                        else { focused = false; speech.start() }
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
                        .submitLabel(.send).onSubmit { send() }
                    Button { send() } label: {
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
        .sheet(isPresented: $showThreads) { ThreadsSheet(threads: threads, current: thread?.id, onPick: { t in Task { await open(t) } }, onDelete: { t in Task { await delete(t) } }, onNew: { Task { await newThread() } }).presentationDetents([.medium, .large]) }
        .task { await loadThreads() }
        .onChange(of: speech.transcript) { _, t in if speech.listening { draft = AeraVoice.fixName(t) } }
        .onDisappear { if speech.listening { speech.stop() } }
    }

    // MARK: Threads
    private func loadThreads() async {
        threads = (try? await Repo.shared.threads()) ?? []
        if thread == nil {
            if let first = threads.first { await open(first) } else { await newThread() }
        }
    }
    private func newThread() async {
        guard let t = try? await Repo.shared.createThread() else { return }
        threads.insert(t, at: 0); thread = t; messages = []; showThreads = false
    }
    private func open(_ t: Repo.Thread) async {
        thread = t; showThreads = false
        messages = (try? await Repo.shared.messages(thread: t.id)) ?? []
    }
    private func delete(_ t: Repo.Thread) async {
        try? await Repo.shared.deleteThread(t.id)
        threads.removeAll { $0.id == t.id }
        if thread?.id == t.id { thread = nil; messages = []; await loadThreads() }
    }

    // MARK: Send (same brain as the voice layer)
    private func send(confirm: Bool = false) {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !thinking, let thread else { return }
        draft = ""; focused = false; pendingConfirm = false
        let mine = ChatMessage(kind: .user, text: text)
        withAnimation { messages.append(mine) }
        Task { await Repo.shared.saveMessage(thread: thread.id, mine) }
        if messages.count == 1 { Task { try? await Repo.shared.renameThread(thread.id, name: String(text.prefix(40))); await loadThreadsQuiet() } }
        thinking = true
        let t0 = Date()
        Log.event("chat.send", area: "chat", label: String(text.prefix(200)))
        Task {
            do {
                let r = try await Repo.shared.act(messages, confirm: confirm)
                Log.event("chat.reply", area: "chat",
                          label: String((r.say ?? "").prefix(200)),
                          ms: Int(Date().timeIntervalSince(t0) * 1000),
                          detail: ["steps": (r.steps ?? []).map { $0.tool }])
                for d in r.ui ?? [] { nav.apply(d, role: session.role) }
                if r.needsConfirm != nil { pendingConfirm = true }
                let reply = ChatMessage(kind: .aera, text: r.say ?? "Done.")
                if let st = r.steps, !st.isEmpty { stepsFor[reply.id] = st }
                withAnimation { messages.append(reply) }
                await Repo.shared.saveMessage(thread: thread.id, reply)
            } catch {
                Log.failure("chat.reply", error, area: "chat", label: String(text.prefix(200)), ms: Int(Date().timeIntervalSince(t0) * 1000))
                withAnimation { messages.append(ChatMessage(kind: .aera, text: "I could not reach the server: \(error.localizedDescription)")) }
            }
            thinking = false
        }
    }
    private func loadThreadsQuiet() async { threads = (try? await Repo.shared.threads()) ?? threads }
}

/// Past conversations. Private to this account.
struct ThreadsSheet: View {
    let threads: [Repo.Thread]
    let current: String?
    let onPick: (Repo.Thread) -> Void
    let onDelete: (Repo.Thread) -> Void
    let onNew: () -> Void

    var body: some View {
        NavigationStack {
            ZStack {
                ApexBackground()
                List {
                    Section {
                        Button(action: onNew) { Label("New chat", systemImage: "plus.circle.fill").foregroundStyle(Theme.cyan).font(.system(size: 15, weight: .semibold)) }
                            .listRowBackground(Theme.surface)
                    }
                    Section("Your chats") {
                        ForEach(threads) { t in
                            Button { onPick(t) } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(t.name ?? "Chat").font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.text).lineLimit(1)
                                        if let u = t.updated_at { Text(u.prettyDate).font(.system(size: 11)).foregroundStyle(Theme.text4) }
                                    }
                                    Spacer()
                                    if t.id == current { Image(systemName: "checkmark").foregroundStyle(Theme.cyan) }
                                }
                            }
                            .listRowBackground(t.id == current ? Theme.cyan.opacity(0.08) : Theme.surface)
                            .swipeActions { Button(role: .destructive) { onDelete(t) } label: { Label("Delete", systemImage: "trash") } }
                        }
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Chats")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.bg.opacity(0.9), for: .navigationBar)
        }
        .preferredColorScheme(.dark)
    }
}


/// What AERA did, in order, above her answer. The phone twin of the portal's trail.
struct StepTrailView: View {
    let steps: [Repo.ActResponse.StepInfo]
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            ForEach(steps, id: \.self) { s in
                HStack(spacing: 6) {
                    Image(systemName: s.ok ? "checkmark" : "xmark")
                        .font(.system(size: 8, weight: .black))
                        .foregroundStyle(s.ok ? Theme.green : Theme.rose)
                    Text(s.label)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.text3)
                        .lineLimit(1)
                    if let ms = s.ms, ms > 400 {
                        Text(String(format: "%.1fs", Double(ms) / 1000))
                            .font(.system(size: 10))
                            .foregroundStyle(Theme.text3.opacity(0.7))
                    }
                }
            }
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 8)
        .background(Theme.surface2.opacity(0.7), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Theme.border, style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
