import SwiftUI
import AVFoundation

/// Account and access. Reached from the avatar on any tab.
struct AccountView: View {
    @Environment(Session.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var brand: Brand?
    @State private var check: [String] = []
    @State private var checking = false

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
                        ApexCard(quiet: true) {
                            VStack(alignment: .leading, spacing: 12) {
                                SectionLabel(text: "Voice check")
                                Text("Tests the three pieces AERA needs to talk: speech credential, voice, and the action brain.").font(.system(size: 13)).foregroundStyle(Theme.text3)
                                GhostButton(title: checking ? "Checking…" : "Run voice check", icon: "waveform.badge.magnifyingglass") { Task { await runCheck() } }
                                ForEach(check, id: \.self) { line in
                                    Text(line).font(.system(size: 12.5, design: .monospaced)).foregroundStyle(line.hasPrefix("OK") ? Theme.green : Theme.rose)
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

    private struct Cred: Decodable { let mode: String?; let access_token: String?; let error: String? }
    private func runCheck() async {
        checking = true; check = []
        if session.isDemo { check = ["Demo mode: sign in to test the live voice."]; checking = false; return }
        // 1. Speech credential
        do {
            let c: Cred = try await SupabaseClient.shared.api("api/voice/deepgram-token", method: "GET", as: Cred.self)
            check.append(c.access_token != nil ? "OK  speech credential (\(c.mode ?? "?"))" : "FAIL speech credential: \(c.error ?? "empty")")
        } catch { check.append("FAIL speech credential: \(error.localizedDescription)") }
        // 2. Voice (Aura)
        do {
            let s = try await SupabaseClient.shared.refreshIfNeeded()
            var req = URLRequest(url: Config.apiBase.appending(path: "api/voice/speak"))
            req.httpMethod = "POST"
            req.setValue("Bearer " + s.accessToken, forHTTPHeaderField: "Authorization")
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: ["text": "AERA online."])
            let (data, resp) = try await URLSession.shared.data(for: req)
            let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
            if code == 200, data.count > 1000 {
                check.append("OK  voice (\(data.count / 1024) KB of audio)")
                try? AudioSessionConfig.activate()
                if let p = try? AVAudioPlayer(data: data) { p.play(); try? await Task.sleep(for: .seconds(2)) }
            } else {
                let msg = (try? JSONDecoder().decode([String: String].self, from: data))?["error"] ?? "HTTP \(code)"
                check.append("FAIL voice: \(msg)")
            }
        } catch { check.append("FAIL voice: \(error.localizedDescription)") }
        // 3. Action brain
        do {
            let r = try await Repo.shared.act([ChatMessage(kind: .user, text: "Say hello in five words.")])
            check.append("OK  brain: \((r.say ?? "").prefix(60))")
        } catch { check.append("FAIL brain: \(error.localizedDescription)") }
        checking = false
    }

    private func row(_ k: String, _ v: String) -> some View {
        HStack { Text(k).font(.system(size: 13)).foregroundStyle(Theme.text3); Spacer(); Text(v).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.text) }
    }
}
