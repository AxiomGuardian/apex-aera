import SwiftUI

struct ClientsView: View {
    @Environment(Session.self) private var session
    @State private var brands: [Brand] = []
    @State private var onboarding = false
    @State private var showArchived = false
    @State private var query = ""

    @ViewBuilder
    private func actionTile(icon: String, title: String, note: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Image(systemName: icon).font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.cyan)
            Text(title).font(.system(size: 14.5, weight: .bold)).foregroundStyle(Theme.cyan)
            Text(note).font(.system(size: 11)).foregroundStyle(Theme.text4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14).padding(.vertical, 12)
        .background(Theme.cyan.opacity(0.09), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.cyan.opacity(0.32), lineWidth: 1))
    }

    private var filtered: [Brand] {
        brands.filter { (showArchived || !$0.isArchived) && (query.isEmpty || $0.name.localizedCaseInsensitiveContains(query)) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ApexBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        ApexHeader(title: "Clients", subtitle: "\(brands.filter { !$0.isArchived }.count) active")

                        if session.role.seesClients {
                            HStack(spacing: 10) {
                                Button { onboarding = true } label: {
                                    actionTile(icon: "plus.circle.fill", title: "Onboard", note: "New client")
                                }
                                .buttonStyle(.plain)

                                NavigationLink { LeadsView() } label: {
                                    actionTile(icon: "scope", title: "Leads", note: "Find prospects")
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(.horizontal, 20)
                        }
                        HStack {
                            Image(systemName: "magnifyingglass").foregroundStyle(Theme.text4)
                            TextField("Search clients", text: $query).foregroundStyle(Theme.text)
                        }
                        .apexInput().padding(.horizontal, 20)
                        VStack(spacing: 10) {
                            ForEach(filtered) { b in
                                NavigationLink { BrandWorkspaceView(brand: b) } label: {
                                    ApexCard(accent: b.isArchived ? Theme.text4 : Theme.cyan, quiet: b.isArchived, padding: 14) { BrandRow(brand: b) }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 20)
                        Toggle("Show archived", isOn: $showArchived).tint(Theme.cyan).font(.system(size: 13)).foregroundStyle(Theme.text3).padding(.horizontal, 20)
                        Text("Onboarding sends them an invite email. They set their own password on whatever device they open it on.").font(.system(size: 12)).foregroundStyle(Theme.text4).padding(.horizontal, 20)
                        Spacer().frame(height: 30)
                    }
                }
                .scrollDismissesKeyboard(.interactively)
                .dismissKeyboardOnTap()
                .refreshable { brands = (try? await Repo.shared.brands(includeArchived: true)) ?? [] }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .task { brands = (try? await Repo.shared.brands(includeArchived: true)) ?? [] }
        .sheet(isPresented: $onboarding) {
            OnboardClientView {
                Task { brands = (try? await Repo.shared.brands(includeArchived: true)) ?? brands }
            }
        }
    }
}
