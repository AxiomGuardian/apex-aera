import SwiftUI

struct QueueView: View {
    @State private var posts: [ScheduledPost] = []
    @State private var busy: String = ""
    @State private var pubMsg: String?
    @Environment(AppNav.self) private var nav

    private var needsYes: [ScheduledPost] { posts.filter { $0.status == "proposed" } }
    private var autopilot: [ScheduledPost] { posts.filter { $0.status == "approved" || $0.status == "locked" } }
    private var done: [ScheduledPost] { posts.filter { $0.status == "published" } }

    var body: some View {
        NavigationStack {
            ZStack {
                ApexBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        ApexHeader(title: "Queue", subtitle: needsYes.isEmpty ? "All clear" : "\(needsYes.count) need a yes")

                        ApexCard(accent: Theme.amber) {
                            VStack(alignment: .leading, spacing: 10) {
                                SectionLabel(text: "Needs your yes")
                                if needsYes.isEmpty { Text("Nothing waiting. Autopilot is handling the rest.").font(.system(size: 13)).foregroundStyle(Theme.text3) }
                                ForEach(needsYes) { p in
                                    VStack(spacing: 8) {
                                        PostRow(post: p)
                                        HStack(spacing: 8) {
                                            GhostButton(title: busy == p.id ? "…" : "Approve", icon: "checkmark", color: Theme.green) { Task { await act(p, "approved") } }
                                            GhostButton(title: "Skip", icon: "xmark", color: Theme.rose) { Task { await act(p, "cancelled") } }
                                            Spacer()
                                        }
                                    }
                                    .padding(.bottom, 6)
                                }
                            }
                        }
                        .padding(.horizontal, 20)

                        ApexCard(accent: Theme.green, quiet: true) {
                            VStack(alignment: .leading, spacing: 10) {
                                SectionLabel(text: "On autopilot")
                                if !autopilot.isEmpty {
                                    HStack(spacing: 6) {
                                        ForEach(Array(Set(autopilot.map { $0.platform })).sorted(), id: \.self) { p in
                                            HStack(spacing: 4) { Image(systemName: p.platformIcon); Text("\(autopilot.filter { $0.platform == p }.count)") }
                                                .font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.cyanSoft)
                                                .padding(.horizontal, 9).padding(.vertical, 5)
                                                .background(Theme.cyan.opacity(0.08), in: Capsule())
                                        }
                                        Spacer()
                                    }
                                }
                                if let pubMsg { Text(pubMsg).font(.system(size: 12.5, weight: .semibold)).foregroundStyle(pubMsg.hasPrefix("Published") ? Theme.green : Theme.rose) }
                                if autopilot.isEmpty { Text("Nothing scheduled yet.").font(.system(size: 13)).foregroundStyle(Theme.text3) }
                                ForEach(autopilot) { p in
                                    VStack(spacing: 8) {
                                        PostRow(post: p)
                                        HStack { GhostButton(title: busy == p.id ? "Publishing…" : "Publish now", icon: "paperplane.fill") { Task { await publishNow(p) } }; Spacer() }
                                    }
                                    .padding(.bottom, 6)
                                }
                            }
                        }
                        .padding(.horizontal, 20)

                        if !done.isEmpty {
                            ApexCard(quiet: true) {
                                VStack(alignment: .leading, spacing: 10) {
                                    SectionLabel(text: "Published")
                                    ForEach(done.prefix(10)) { p in PostRow(post: p) }
                                }
                            }
                            .padding(.horizontal, 20)
                        }
                        Spacer().frame(height: 30)
                    }
                }
                .refreshable { await load() }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .task { await load() }
        .onChange(of: nav.refreshTick) { _, _ in Task { await load() } }
    }

    private func load() async { posts = (try? await Repo.shared.posts()) ?? [] }
    private func publishNow(_ p: ScheduledPost) async {
        busy = p.id; pubMsg = nil
        do {
            let r = try await Repo.shared.publishNow(p.id)
            Log.event("post.publish_now", area: "queue", label: r.ok ? "Published a post by hand" : "Publish by hand failed", ok: r.ok, detail: ["postId": p.id, "platform": p.platform, "error": r.error ?? ""])
            pubMsg = r.ok ? "Published to \(p.platform.platformLabel)." : "Publish failed: \(r.error ?? "unknown")"
        } catch {
            Log.failure("post.publish_now", error, area: "queue", label: "Publish by hand failed", detail: ["postId": p.id])
            pubMsg = "Publish failed: \(error.localizedDescription)"
        }
        busy = ""; await load()
    }
    private func act(_ p: ScheduledPost, _ status: String) async {
        busy = p.id
        try? await Repo.shared.setPost(p.id, status: status)
        Log.event("post." + status, area: "queue", label: (status == "approved" ? "Approved" : "Cancelled") + " a post", detail: ["postId": p.id, "platform": p.platform])
        withAnimation { if let i = posts.firstIndex(of: p) { if status == "cancelled" { posts.remove(at: i) } else { posts[i].status = status } } }
        busy = ""
    }
}
