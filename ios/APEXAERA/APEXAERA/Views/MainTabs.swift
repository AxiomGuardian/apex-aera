import SwiftUI

struct MainTabs: View {
    @Environment(Session.self) private var session

    var body: some View {
        TabView {
            if session.role.seesClients {
                DashboardView().tabItem { Label("Dashboard", systemImage: "square.grid.2x2.fill") }
                ClientsView().tabItem { Label("Clients", systemImage: "person.2.fill") }
            } else {
                BrandTab().tabItem { Label("My Brand", systemImage: "sparkle") }
            }
            ContentListView().tabItem { Label("Content", systemImage: "photo.stack.fill") }
            QueueView().tabItem { Label("Queue", systemImage: "checkmark.circle.fill") }
            ChatView().tabItem { Label("AERA", systemImage: "waveform") }
        }
        .toolbarBackground(Theme.bg.opacity(0.92), for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
    }
}

/// Client-role home: their single brand, opened directly.
struct BrandTab: View {
    @State private var brand: Brand?
    var body: some View {
        NavigationStack {
            Group {
                if let brand {
                    ZStack {
                        ApexBackground()
                        VStack(spacing: 0) {
                            ApexHeader(title: "My Brand", subtitle: "Your workspace")
                            BrandWorkspaceView(brand: brand)
                        }
                    }
                }
                else { ApexBackground().overlay(ProgressView().tint(Theme.cyan)) }
            }
        }
        .task { brand = try? await Repo.shared.myBrand() }
    }
}

/// Shared top bar: mark, title, account menu.
struct ApexHeader: View {
    @Environment(Session.self) private var session
    let title: String
    var subtitle: String? = nil
    @State private var showAccount = false
    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                if let subtitle { Text(subtitle.uppercased()).font(.system(size: 10.5, weight: .bold)).tracking(2).foregroundStyle(Theme.cyanSoft) }
                Text(title).font(.system(size: 28, weight: .heavy)).foregroundStyle(Theme.text)
            }
            Spacer()
            Button { showAccount = true } label: {
                ZStack {
                    Circle().fill(Theme.surface2).overlay(Circle().stroke(Theme.borderMid, lineWidth: 1))
                    Text(String(session.firstName.prefix(1))).font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.text2)
                    Circle().fill(Theme.cyan).frame(width: 8, height: 8).offset(x: 13, y: -13).shadow(color: Theme.cyan.opacity(0.7), radius: 4)
                }
                .frame(width: 38, height: 38)
            }
            .sheet(isPresented: $showAccount) { AccountView().environment(session).preferredColorScheme(.dark) }
        }
        .padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 4)
    }
}
