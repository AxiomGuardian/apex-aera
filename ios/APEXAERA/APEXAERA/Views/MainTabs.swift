import SwiftUI

struct MainTabs: View {
    @Environment(Session.self) private var session
    @Environment(AppNav.self) private var nav
    @Environment(AeraVoice.self) private var aera

    var body: some View {
        @Bindable var nav = nav
        ZStack(alignment: .bottom) {
            TabView(selection: $nav.tab) {
                if session.role.seesClients {
                    DashboardView().tabItem { Label("Dashboard", systemImage: "square.grid.2x2.fill") }.tag(AppTab.dashboard)
                    ClientsView().tabItem { Label("Clients", systemImage: "person.2.fill") }.tag(AppTab.clients)
                } else {
                    BrandTab().tabItem { Label("My Brand", systemImage: "sparkle") }.tag(AppTab.brand)
                }
                ContentListView().tabItem { Label("Content", systemImage: "photo.stack.fill") }.tag(AppTab.content)
                QueueView().tabItem { Label("Queue", systemImage: "checkmark.circle.fill") }.tag(AppTab.queue)
                ChatView().tabItem { Label("AERA", systemImage: "waveform") }.tag(AppTab.aera)
            }
            .toolbarBackground(Theme.bg.opacity(0.92), for: .tabBar)
            .toolbarBackground(.visible, for: .tabBar)

            if aera.active {
                VoiceCapsule()
                    .padding(.bottom, 56)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .zIndex(5)
            }
        }
        .animation(.spring(duration: 0.45, bounce: 0.15), value: aera.active)
        .onAppear {
            aera.nav = nav
            aera.role = session.role
            nav.tab = session.role.seesClients ? .dashboard : .brand
            Log.event("app.open", area: "system", label: "Opened the app")
        }
        .onChange(of: nav.tab) { _, tab in
            Log.event("nav.tab", area: "nav", label: "Opened " + tab.rawValue, detail: ["tab": tab.rawValue])
        }
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
    @Environment(AeraVoice.self) private var aera
    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                if let subtitle { Text(subtitle.uppercased()).font(.system(size: 10.5, weight: .bold)).tracking(2).foregroundStyle(Theme.cyanSoft) }
                Text(title).font(.system(size: 28, weight: .heavy)).foregroundStyle(Theme.text)
            }
            Spacer()
            Button { aera.active ? aera.close() : aera.open() } label: {
                ZStack {
                    Circle().fill(aera.active ? Theme.cyan.opacity(0.16) : Theme.surface2)
                        .overlay(Circle().stroke(aera.active ? Theme.cyan : Theme.cyan.opacity(0.35), lineWidth: 1))
                    Image("ApexMark").resizable().scaledToFit().frame(width: 16)
                }
                .frame(width: 38, height: 38)
                .shadow(color: Theme.cyan.opacity(aera.active ? 0.5 : 0.15), radius: 10)
            }
            .padding(.trailing, 8)
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
