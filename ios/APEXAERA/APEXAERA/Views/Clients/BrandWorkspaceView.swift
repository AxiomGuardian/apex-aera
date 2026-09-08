import SwiftUI

/// One brand: voice, autopilot, platforms, content, queue. Same shape as the web workspace.
struct BrandWorkspaceView: View {
    @Environment(Session.self) private var session
    @State var brand: Brand
    @State private var conns: [PlatformConnection] = []
    @State private var assets: [ContentAsset] = []
    @State private var posts: [ScheduledPost] = []
    @State private var saving = false
    @State private var saved = false
    @State private var tone = ""
    @State private var audience = ""
    @State private var website = ""
    @State private var autopilot = true
    @State private var notice: String?

    private let platforms: [(key: String, label: String, req: String)] = [
        ("instagram", "Instagram", "Needs a Creator or Business account."),
        ("tiktok", "TikTok", "Needs a Business or Creator account."),
        ("facebook", "Facebook Page", "Needs a Page you manage."),
    ]

    var body: some View {
        ZStack {
            ApexBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Header
                    HStack(spacing: 14) {
                        ZStack {
                            Circle().fill(RadialGradient(colors: [Theme.cyan.opacity(0.18), Theme.bg.opacity(0.9)], center: .center, startRadius: 0, endRadius: 28))
                            Circle().stroke(Theme.cyan.opacity(0.35), lineWidth: 1)
                            Text(brand.initials).font(.system(size: 17, weight: .black)).foregroundStyle(Theme.cyanSoft)
                        }
                        .frame(width: 56, height: 56).shadow(color: Theme.cyan.opacity(0.18), radius: 16)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(brand.name).font(.system(size: 26, weight: .heavy)).foregroundStyle(Theme.text)
                            HStack(spacing: 6) {
                                Chip(text: brand.isArchived ? "Archived" : "Active", color: brand.isArchived ? Theme.text4 : Theme.green)
                                if brand.billing_status == "past_due" { Chip(text: "Past due", color: Theme.amber) }
                            }
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 20).padding(.top, 8)

                    if let notice {
                        Text(notice).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.green)
                            .padding(12).frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.green.opacity(0.3), lineWidth: 1))
                            .padding(.horizontal, 20)
                    }

                    // Stats
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        StatTile(label: "Content", value: assets.count)
                        StatTile(label: "Queued", value: posts.filter { $0.status != "published" }.count)
                        StatTile(label: "Published", value: posts.filter { $0.status == "published" }.count, accent: Theme.green)
                        StatTile(label: "Platforms", value: conns.filter { $0.status == "connected" }.count, accent: Theme.violet)
                    }
                    .padding(.horizontal, 20)

                    // Autopilot
                    ApexCard(accent: autopilot ? Theme.green : Theme.amber) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(autopilot ? "Autopilot is on" : "Manual approval").font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.text)
                                Text(autopilot ? "AERA publishes approved content at the best windows without asking." : "Every post waits in the Queue for a yes.").font(.system(size: 12.5)).foregroundStyle(Theme.text3)
                            }
                            Spacer()
                            Toggle("", isOn: $autopilot).labelsHidden().tint(Theme.green)
                                .onChange(of: autopilot) { _, v in brand.autopilot = v; Task { try? await Repo.shared.saveBrand(brand) } }
                        }
                    }
                    .padding(.horizontal, 20)

                    // Brand voice
                    ApexCard {
                        VStack(alignment: .leading, spacing: 12) {
                            SectionLabel(text: "Brand voice")
                            Text("AERA reads this before it writes a word.").font(.system(size: 12.5)).foregroundStyle(Theme.text3)
                            field("Tone of voice", text: $tone, hint: "e.g. bold, cinematic, encouraging")
                            field("Who you are talking to", text: $audience, hint: "e.g. founders 25 to 40 building a brand")
                            field("Website", text: $website, hint: "https://")
                            HStack {
                                Spacer()
                                GhostButton(title: saved ? "Saved" : saving ? "Saving…" : "Save voice", icon: saved ? "checkmark" : "square.and.arrow.down") {
                                    saving = true
                                    brand.tone_of_voice = tone.isEmpty ? nil : tone
                                    brand.target_audience = audience.isEmpty ? nil : audience
                                    brand.website_url = website.isEmpty ? nil : website
                                    Task { try? await Repo.shared.saveBrand(brand); saving = false; saved = true; try? await Task.sleep(for: .seconds(2)); saved = false }
                                }
                            }
                            if brand.voice_confirmed_at != nil {
                                Label("AERA has read and confirmed this voice.", systemImage: "checkmark.seal.fill").font(.system(size: 12)).foregroundStyle(Theme.green)
                            }
                        }
                    }
                    .padding(.horizontal, 20)

                    // Platforms
                    ApexCard(quiet: true) {
                        VStack(alignment: .leading, spacing: 10) {
                            SectionLabel(text: "Platforms")
                            Text("Where AERA publishes. Connecting opens the platform's own login in your browser.").font(.system(size: 12.5)).foregroundStyle(Theme.text3)
                            ForEach(platforms, id: \.key) { p in
                                let c = conns.first { $0.platform == p.key }
                                let ok = c?.status == "connected"
                                HStack(spacing: 12) {
                                    Image(systemName: p.key.platformIcon).foregroundStyle(ok ? Theme.green : Theme.text4).frame(width: 22)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(p.label).font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.text)
                                        Text(ok ? "Connected as \(c?.account_name ?? "")" : c?.status == "expired" ? "Token expired. Reconnect." : "Not connected").font(.system(size: 11.5)).foregroundStyle(ok ? Theme.green : c?.status == "expired" ? Theme.amber : Theme.text3)
                                        if !ok { Text(p.req).font(.system(size: 11)).foregroundStyle(Theme.text4) }
                                    }
                                    Spacer()
                                    if session.isDemo {
                                        Chip(text: ok ? "Live" : "Demo", color: ok ? Theme.green : Theme.text4)
                                    } else {
                                        Link(ok ? "Reconnect" : "Connect", destination: connectURL(p.key))
                                            .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.cyan)
                                    }
                                }
                                .padding(12)
                                .background(ok ? Theme.green.opacity(0.05) : Theme.surface2.opacity(0.6), in: RoundedRectangle(cornerRadius: 12))
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(ok ? Theme.green.opacity(0.22) : Theme.border, lineWidth: 1))
                            }
                        }
                    }
                    .padding(.horizontal, 20)

                    // Recent content
                    ApexCard(quiet: true) {
                        VStack(alignment: .leading, spacing: 10) {
                            SectionLabel(text: "Recent content")
                            if assets.isEmpty { Text("No content yet. Upload from the Content tab.").font(.system(size: 13)).foregroundStyle(Theme.text3) }
                            ForEach(assets.prefix(5)) { a in AssetRow(asset: a) }
                        }
                    }
                    .padding(.horizontal, 20)

                    // Queue
                    ApexCard(quiet: true) {
                        VStack(alignment: .leading, spacing: 10) {
                            SectionLabel(text: "Queue")
                            let q = posts.filter { $0.status != "published" }
                            if q.isEmpty { Text("Nothing queued.").font(.system(size: 13)).foregroundStyle(Theme.text3) }
                            ForEach(q.prefix(5)) { p in PostRow(post: p) }
                        }
                    }
                    .padding(.horizontal, 20)
                    Spacer().frame(height: 30)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .dismissKeyboardOnTap()
            .refreshable { await load() }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.bg.opacity(0.9), for: .navigationBar)
        .onAppear {
            tone = brand.tone_of_voice ?? ""; audience = brand.target_audience ?? ""; website = brand.website_url ?? ""; autopilot = brand.autopilot ?? true
        }
        .task { await load() }
    }

    private func connectURL(_ platform: String) -> URL {
        let route = platform == "facebook" ? "meta" : platform
        return Config.apiBase.appending(path: "api/aera/connect/\(route)").appending(queryItems: [.init(name: "brandId", value: brand.id)])
    }

    private func load() async {
        async let c = Repo.shared.connections(brandId: brand.id)
        async let a = Repo.shared.assets(brandId: brand.id)
        async let p = Repo.shared.posts(brandId: brand.id)
        conns = (try? await c) ?? []; assets = (try? await a) ?? []; posts = (try? await p) ?? []
    }

    private func field(_ label: String, text: Binding<String>, hint: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased()).font(.system(size: 10, weight: .bold)).tracking(1.2).foregroundStyle(Theme.text3)
            TextField(hint, text: text, axis: .vertical).lineLimit(1...4).apexInput()
        }
    }
}

struct AssetRow: View {
    let asset: ContentAsset
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: asset.isVideo ? "video.fill" : "photo.fill").foregroundStyle(Theme.cyan).frame(width: 30, height: 30)
                .background(Theme.cyan.opacity(0.09), in: RoundedRectangle(cornerRadius: 9))
            VStack(alignment: .leading, spacing: 2) {
                Text(asset.title ?? "Untitled").font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.text).lineLimit(1)
                Text("\(asset.isVideo ? "Video" : "Image")\(asset.duration_seconds.map { " · \(Int($0))s" } ?? "") · \(asset.created_at.prettyDate)").font(.system(size: 11.5)).foregroundStyle(Theme.text3)
            }
            Spacer()
            Chip(text: asset.status, color: asset.status == "published" ? Theme.green : asset.status == "uploaded" ? Theme.text4 : Theme.cyan)
        }
        .padding(.vertical, 5)
    }
}
