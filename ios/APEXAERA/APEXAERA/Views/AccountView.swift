import SwiftUI

/// Account and access. Reached from the avatar on any tab.
struct AccountView: View {
    @Environment(Session.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var brand: Brand?

    var body: some View {
        NavigationStack {
            ZStack {
                ApexBackground()
                ScrollView {
                    VStack(spacing: 16) {
                        VStack(spacing: 10) {
                            ZStack {
                                Circle().fill(Theme.surface2).overlay(Circle().stroke(Theme.cyan.opacity(0.35), lineWidth: 1))
                                Text(String(session.firstName.prefix(1))).font(.system(size: 26, weight: .black)).foregroundStyle(Theme.cyanSoft)
                            }
                            .frame(width: 72, height: 72).shadow(color: Theme.cyan.opacity(0.2), radius: 18)
                            Text(session.profile?.full_name ?? session.firstName).font(.system(size: 22, weight: .heavy)).foregroundStyle(Theme.text)
                            Text(session.profile?.email ?? "").font(.system(size: 13)).foregroundStyle(Theme.text3)
                            Chip(text: session.role.label, color: Theme.cyan)
                        }
                        .padding(.top, 12)

                        ApexCard(quiet: true) {
                            VStack(alignment: .leading, spacing: 12) {
                                SectionLabel(text: "Access")
                                row("Role", session.role.label)
                                row("Workspace", brand?.name ?? (session.role.seesClients ? "All clients" : "Loading…"))
                                row("Mode", session.isDemo ? "Demo (mock data)" : "Live")
                                row("Portal", "www.apexaera.com")
                            }
                        }
                        ApexCard(quiet: true) {
                            VStack(alignment: .leading, spacing: 12) {
                                SectionLabel(text: "Security")
                                Text("Sessions refresh automatically. Sign out to end this device's access.").font(.system(size: 13)).foregroundStyle(Theme.text3)
                                Link(destination: URL(string: "https://www.apexaera.com/login")!) {
                                    HStack { Text("Change password on the web"); Spacer(); Image(systemName: "arrow.up.right") }
                                        .font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.cyan)
                                }
                            }
                        }
                        Button {
                            dismiss()
                            Task { await session.signOut() }
                        } label: {
                            HStack(spacing: 8) { Image(systemName: "rectangle.portrait.and.arrow.right"); Text("Sign out").fontWeight(.bold) }
                                .font(.system(size: 15)).frame(maxWidth: .infinity).padding(.vertical, 15)
                                .foregroundStyle(Theme.rose)
                                .background(Theme.rose.opacity(0.08), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.rose.opacity(0.3), lineWidth: 1))
                        }
                        .touchGlow(Theme.rose, radius: 14)
                        Text("APEX AERA · iOS 1.0").font(.system(size: 11)).foregroundStyle(Theme.text4).padding(.top, 8)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.bg.opacity(0.9), for: .navigationBar)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() }.foregroundStyle(Theme.cyan) } }
        }
        .task { brand = try? await Repo.shared.myBrand() }
    }

    private func row(_ k: String, _ v: String) -> some View {
        HStack { Text(k).font(.system(size: 13)).foregroundStyle(Theme.text3); Spacer(); Text(v).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.text) }
    }
}
