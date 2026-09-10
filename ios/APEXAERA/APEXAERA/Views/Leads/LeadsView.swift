import SwiftUI

/// The prospect pipeline on the phone. Name a city and a trade, AERA goes looking
/// for real local businesses with weak social, and you work the list from here.
struct LeadsView: View {
    @State private var leads: [Repo.Lead] = []
    @State private var filter = "all"
    @State private var city = ""
    @State private var industry = ""
    @State private var searching = false
    @State private var notice: (ok: Bool, text: String)?
    @State private var loading = true
    @FocusState private var focused: Bool

    private let statuses = ["new", "contacted", "meeting", "won", "lost"]

    private var shown: [Repo.Lead] {
        filter == "all" ? leads : leads.filter { $0.status == filter }
    }

    private func color(_ status: String) -> Color {
        switch status {
        case "new": return Theme.cyan
        case "contacted": return Theme.amber
        case "meeting": return Theme.violet
        case "won": return Theme.green
        default: return Theme.text4
        }
    }
    private func scoreColor(_ n: Int) -> Color {
        n >= 75 ? Theme.green : n >= 50 ? Theme.amber : Theme.text4
    }

    var body: some View {
        ZStack {
            ApexBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    ApexHeader(title: "Leads", subtitle: "\(leads.count) in the pipeline")

                    // Search
                    VStack(spacing: 10) {
                        TextField("City or area, like Eloy AZ", text: $city)
                            .textInputAutocapitalization(.words)
                            .autocorrectionDisabled()
                            .focused($focused)
                            .apexInput()
                        TextField("Trade, like gyms or welders", text: $industry)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .submitLabel(.search)
                            .onSubmit { find() }
                            .apexInput()
                        PrimaryButton(title: searching ? "Looking" : "Find leads", icon: "magnifyingglass", busy: searching) { find() }
                            .opacity(city.trimmingCharacters(in: .whitespaces).isEmpty || searching ? 0.5 : 1)
                            .disabled(city.trimmingCharacters(in: .whitespaces).isEmpty || searching)
                    }
                    .padding(.horizontal, 20)

                    if searching {
                        Text("Searching the live web and checking each business's accounts. Up to a minute.")
                            .font(.system(size: 12)).foregroundStyle(Theme.text4)
                            .padding(.horizontal, 20)
                    }

                    if let notice {
                        Text(notice.text)
                            .font(.system(size: 13))
                            .foregroundStyle(notice.ok ? Theme.green : Theme.rose)
                            .padding(.horizontal, 20)
                    }

                    // Filter
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 7) {
                            ForEach(["all"] + statuses, id: \.self) { s in
                                Button { withAnimation(.easeInOut(duration: 0.15)) { filter = s } } label: {
                                    Text(s.capitalized + (s == "all" ? "" : " \(leads.filter { $0.status == s }.count)"))
                                        .font(.system(size: 12.5, weight: .semibold))
                                        .foregroundStyle(filter == s ? Theme.cyan : Theme.text4)
                                        .padding(.horizontal, 13).padding(.vertical, 7)
                                        .background(filter == s ? Theme.cyan.opacity(0.12) : Color.white.opacity(0.03), in: Capsule())
                                        .overlay(Capsule().stroke(filter == s ? Theme.cyan.opacity(0.4) : Color.white.opacity(0.08), lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 20)
                    }

                    if loading {
                        Text("Reading the pipeline.").font(.system(size: 13)).foregroundStyle(Theme.text4).padding(.horizontal, 20)
                    } else if shown.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Nothing here yet.").font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.text)
                            Text("Put a city above and tap Find leads.").font(.system(size: 13)).foregroundStyle(Theme.text4)
                        }
                        .padding(.horizontal, 20).padding(.top, 8)
                    }

                    VStack(spacing: 11) {
                        ForEach(shown) { lead in
                            LeadCard(lead: lead, color: color(lead.status), scoreColor: scoreColor(lead.score ?? 50)) { status in
                                move(lead, to: status)
                            }
                        }
                    }
                    .padding(.horizontal, 20)

                    Spacer().frame(height: 40)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .dismissKeyboardOnTap()
            .refreshable { await load() }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task { await load() }
    }

    private func load() async {
        leads = (try? await Repo.shared.leads()) ?? leads
        loading = false
    }

    private func find() {
        let c = city.trimmingCharacters(in: .whitespaces)
        guard !c.isEmpty, !searching else { return }
        focused = false
        searching = true; notice = nil
        let t0 = Date()
        Log.event("lead.search", area: "leads", label: "Searching " + c, detail: ["city": c, "industry": industry])
        Task {
            do {
                let r = try await Repo.shared.findLeads(city: c, industry: industry.trimmingCharacters(in: .whitespaces))
                notice = (true, r.added > 0 ? "Found \(r.added) new \(r.added == 1 ? "lead" : "leads")." : (r.note ?? "Nothing new."))
                Log.event("lead.search", area: "leads", label: "Found \(r.added) in " + c, ms: Int(Date().timeIntervalSince(t0) * 1000), detail: ["added": r.added])
                await load()
            } catch {
                notice = (false, error.localizedDescription)
                Log.failure("lead.search", error, area: "leads", label: "Lead search failed for " + c, ms: Int(Date().timeIntervalSince(t0) * 1000))
            }
            searching = false
        }
    }

    private func move(_ lead: Repo.Lead, to status: String) {
        Task {
            try? await Repo.shared.setLeadStatus(lead.id, status: status)
            Log.event("lead.update", area: "leads", label: "Moved a lead to " + status, detail: ["id": lead.id, "status": status])
            await load()
        }
    }
}

private struct LeadCard: View {
    let lead: Repo.Lead
    let color: Color
    let scoreColor: Color
    let onStatus: (String) -> Void

    @State private var expanded = false
    private let statuses = ["new", "contacted", "meeting", "won", "lost"]

    var body: some View {
        ApexCard(accent: color, padding: 14) {
            VStack(alignment: .leading, spacing: 9) {
                HStack(alignment: .top, spacing: 10) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(lead.name).font(.system(size: 15.5, weight: .bold)).foregroundStyle(Theme.text)
                        Text([lead.category, [lead.city, lead.state].compactMap { $0 }.joined(separator: ", ")]
                            .compactMap { $0?.isEmpty == false ? $0 : nil }.joined(separator: " · "))
                            .font(.system(size: 11.5)).foregroundStyle(Theme.text4)
                    }
                    Spacer()
                    VStack(spacing: 2) {
                        Text("\(lead.score ?? 50)").font(.system(size: 19, weight: .heavy)).foregroundStyle(scoreColor)
                        Text("FIT").font(.system(size: 8, weight: .bold)).tracking(1).foregroundStyle(Theme.text4)
                    }
                }

                if let presence = lead.presence, !presence.isEmpty {
                    Text(presence).font(.system(size: 12.5)).foregroundStyle(Theme.text3).lineSpacing(2)
                }
                if let gap = lead.gap, !gap.isEmpty {
                    Text(gap).font(.system(size: 12.5)).foregroundStyle(Theme.text2).lineSpacing(2)
                        .padding(.leading, 9)
                        .overlay(alignment: .leading) {
                            Rectangle().fill(Theme.cyan.opacity(0.5)).frame(width: 2)
                        }
                }
                if expanded, let pitch = lead.pitch, !pitch.isEmpty {
                    Text("\u{201C}\(pitch)\u{201D}").font(.system(size: 12.5).italic()).foregroundStyle(Theme.cyanSoft).lineSpacing(2)
                }

                // Reach out
                HStack(spacing: 14) {
                    if let phone = lead.phone, !phone.isEmpty,
                       let url = URL(string: "tel:" + phone.filter { $0.isNumber || $0 == "+" }) {
                        Link(destination: url) {
                            Label(phone, systemImage: "phone.fill").font(.system(size: 11.5)).foregroundStyle(Theme.text3)
                        }
                    }
                    if let site = lead.website, !site.isEmpty,
                       let url = URL(string: site.hasPrefix("http") ? site : "https://" + site) {
                        Link(destination: url) {
                            Label("Site", systemImage: "globe").font(.system(size: 11.5)).foregroundStyle(Theme.text3)
                        }
                    }
                    if let ig = lead.instagram, !ig.isEmpty,
                       let url = URL(string: "https://instagram.com/" + ig.replacingOccurrences(of: "@", with: "")) {
                        Link(destination: url) {
                            Label(ig, systemImage: "camera.fill").font(.system(size: 11.5)).foregroundStyle(Theme.text3)
                        }
                    }
                }

                // Status
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 5) {
                        ForEach(statuses, id: \.self) { s in
                            Button { onStatus(s) } label: {
                                Text(s.capitalized)
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(lead.status == s ? color : Theme.text4)
                                    .padding(.horizontal, 10).padding(.vertical, 5)
                                    .background(lead.status == s ? color.opacity(0.15) : Color.clear, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                                    .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous)
                                        .stroke(lead.status == s ? color.opacity(0.6) : Color.white.opacity(0.08), lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.top, 2)
            }
            .contentShape(Rectangle())
            .onTapGesture { withAnimation(.easeInOut(duration: 0.2)) { expanded.toggle() } }
        }
    }
}
