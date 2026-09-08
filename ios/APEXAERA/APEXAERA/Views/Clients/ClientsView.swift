import SwiftUI

struct ClientsView: View {
    @State private var brands: [Brand] = []
    @State private var showArchived = false
    @State private var query = ""

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
                        Text("New clients are onboarded from the web portal, where the invite email goes out.").font(.system(size: 12)).foregroundStyle(Theme.text4).padding(.horizontal, 20)
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
    }
}
