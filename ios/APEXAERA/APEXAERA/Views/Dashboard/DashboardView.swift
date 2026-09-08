import SwiftUI

struct DashboardView: View {
    @Environment(Session.self) private var session
    @State private var brands: [Brand] = []
    @State private var counts = PipelineCounts()
    @State private var posts: [ScheduledPost] = []
    @State private var hbBusy = false
    @State private var hbResult: String?

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        return h < 12 ? "Good morning." : h < 17 ? "Good afternoon." : "Good evening."
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ApexBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        ApexHeader(title: greeting, subtitle: session.isDemo ? "Demo workspace" : "APEX Command")

                        HStack(spacing: 10) {
                            GhostButton(title: hbBusy ? "Running…" : "Run heartbeat", icon: "bolt.fill", color: Theme.green) {
                                guard !hbBusy else { return }
                                hbBusy = true
                                Task { hbResult = (try? await Repo.shared.runHeartbeat()) ?? "Heartbeat failed"; hbBusy = false; await load() }
                            }
                        }
                        .padding(.horizontal, 20)
                        if let hbResult {
                            Text(hbResult).font(.system(size: 12)).foregroundStyle(Theme.text3).padding(.horizontal, 20)
                        }

                        VStack(alignment: .leading, spacing: 12) {
                            SectionLabel(text: "Content pipeline")
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                                StatTile(label: "Uploaded", value: counts.uploaded)
                                StatTile(label: "Analyzed", value: counts.analyzed)
                                StatTile(label: "Captioned", value: counts.captioned)
                                StatTile(label: "Scheduled", value: counts.scheduled)
                                StatTile(label: "Published", value: counts.published, accent: Theme.green)
                                StatTile(label: "Clients", value: brands.count, accent: Theme.violet)
                            }
                        }
                        .padding(.horizontal, 20)

                        ApexCard(quiet: true) {
                            VStack(alignment: .leading, spacing: 12) {
                                HStack { SectionLabel(text: "Clients"); Spacer(); Text("\(brands.count) total").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.text4) }
                                if brands.isEmpty {
                                    Text("No clients yet. Onboard one from the web portal.").font(.system(size: 13)).foregroundStyle(Theme.text3)
                                }
                                ForEach(brands.prefix(4)) { b in
                                    NavigationLink { BrandWorkspaceView(brand: b) } label: { BrandRow(brand: b) }
                                }
                            }
                        }
                        .padding(.horizontal, 20)

                        ApexCard(quiet: true) {
                            VStack(alignment: .leading, spacing: 12) {
                                SectionLabel(text: "Next up")
                                let upcoming = posts.filter { $0.status != "published" }.prefix(4)
                                if upcoming.isEmpty { Text("Nothing scheduled. Upload content and AERA will plan the week.").font(.system(size: 13)).foregroundStyle(Theme.text3) }
                                ForEach(Array(upcoming)) { p in PostRow(post: p) }
                            }
                        }
                        .padding(.horizontal, 20)
                        Spacer().frame(height: 30)
                    }
                }
                .refreshable { await load() }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .task { await load() }
    }

    private func load() async {
        async let b = Repo.shared.brands()
        async let c = Repo.shared.pipeline()
        async let p = Repo.shared.posts()
        brands = (try? await b) ?? []; counts = (try? await c) ?? PipelineCounts(); posts = (try? await p) ?? []
    }
}

struct StatTile: View {
    let label: String; let value: Int; var accent: Color = Theme.cyan
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(value)")
                .font(.system(size: 30, weight: .heavy)).tracking(-1)
                .foregroundStyle(value > 0 ? LinearGradient(colors: [Theme.text, accent], startPoint: .top, endPoint: .bottom) : LinearGradient(colors: [Theme.text4, Theme.text4], startPoint: .top, endPoint: .bottom))
            Text(label.uppercased()).font(.system(size: 9.5, weight: .bold)).tracking(1.2).foregroundStyle(Theme.text3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Theme.surface.opacity(0.85), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Theme.border, lineWidth: 1))
        .touchGlow(accent, radius: 16)
    }
}

struct BrandRow: View {
    let brand: Brand
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Theme.surface2).overlay(Circle().stroke(Theme.cyan.opacity(0.35), lineWidth: 1))
                Text(brand.initials).font(.system(size: 12, weight: .black)).foregroundStyle(Theme.cyanSoft)
            }.frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 2) {
                Text(brand.name).font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.text)
                Text(brand.autopilot == false ? "Manual approval" : "Autopilot on").font(.system(size: 11.5)).foregroundStyle(Theme.text3)
            }
            Spacer()
            if brand.billing_status == "past_due" { Chip(text: "Past due", color: Theme.amber) }
            else if brand.isArchived { Chip(text: "Archived", color: Theme.text4) }
            else { Chip(text: "Active", color: Theme.green) }
            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.text4)
        }
        .padding(.vertical, 6)
    }
}

struct PostRow: View {
    let post: ScheduledPost
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: post.platform.platformIcon).font(.system(size: 15)).foregroundStyle(Theme.cyan).frame(width: 30, height: 30)
                .background(Theme.cyan.opacity(0.09), in: RoundedRectangle(cornerRadius: 9))
            VStack(alignment: .leading, spacing: 2) {
                Text(post.content_assets?.title ?? "Untitled").font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.text).lineLimit(1)
                Text("\(post.platform.platformLabel) · \(post.scheduled_at.prettyDate)\(post.brands?.name.map { " · " + $0 } ?? "")").font(.system(size: 11.5)).foregroundStyle(Theme.text3)
            }
            Spacer()
            Chip(text: post.status == "proposed" ? "Needs yes" : post.status, color: post.status == "proposed" ? Theme.amber : post.status == "published" ? Theme.green : Theme.cyan)
        }
        .padding(.vertical, 5)
    }
}
