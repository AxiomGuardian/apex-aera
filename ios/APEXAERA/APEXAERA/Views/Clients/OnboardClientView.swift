import SwiftUI
import UIKit

/// Onboard a client from the phone. Calls the same route the web portal calls,
/// so the brand, the invite record and the invite email are identical either way.
struct OnboardClientView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(Session.self) private var session
    var onDone: () -> Void = {}

    @State private var brandName = ""
    @State private var email = ""
    @State private var tier = "client"
    @State private var orgName = ""
    @State private var sending = false
    @State private var done: String?
    @State private var error: String?
    @State private var invites: [Repo.Invite] = []
    @State private var rowBusy = ""
    @State private var rowMessage: [String: String] = [:]
    @FocusState private var focused: Field?

    private enum Field { case brand, email, org }

    private var emailLooksReal: Bool {
        let t = email.trimmingCharacters(in: .whitespaces).lowercased()
        guard let at = t.firstIndex(of: "@"), t.filter({ $0 == "@" }).count == 1 else { return false }
        let domain = t[t.index(after: at)...]
        guard let dot = domain.lastIndex(of: "."), domain.distance(from: dot, to: domain.endIndex) >= 3 else { return false }
        return !t.hasPrefix("@") && !domain.hasPrefix(".")
    }

    private var canSend: Bool {
        !brandName.trimmingCharacters(in: .whitespaces).isEmpty
        && emailLooksReal
        && (tier == "client" || !orgName.trimmingCharacters(in: .whitespaces).isEmpty)
        && !sending
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ApexBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {

                        VStack(alignment: .leading, spacing: 6) {
                            Text("NEW CLIENT").font(.system(size: 10.5, weight: .bold)).tracking(2).foregroundStyle(Theme.cyanSoft)
                            Text("Onboard").font(.system(size: 28, weight: .heavy)).foregroundStyle(Theme.text)
                            Text("Creates their workspace and emails them an invite. They set their own password.")
                                .font(.system(size: 13)).foregroundStyle(Theme.text3).lineSpacing(2)
                        }
                        .padding(.horizontal, 20).padding(.top, 8)

                        VStack(spacing: 12) {
                            // Tier
                            HStack(spacing: 8) {
                                ForEach(["client", "enterprise"], id: \.self) { t in
                                    Button {
                                        withAnimation(.easeInOut(duration: 0.18)) { tier = t }
                                    } label: {
                                        VStack(spacing: 3) {
                                            Text(t == "client" ? "Single brand" : "Enterprise")
                                                .font(.system(size: 13.5, weight: .bold))
                                                .foregroundStyle(tier == t ? Theme.cyan : Theme.text3)
                                            Text(t == "client" ? "One workspace" : "Many brands")
                                                .font(.system(size: 10.5))
                                                .foregroundStyle(Theme.text4)
                                        }
                                        .frame(maxWidth: .infinity).padding(.vertical, 11)
                                        .background(tier == t ? Theme.cyan.opacity(0.10) : Color.white.opacity(0.03),
                                                    in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous)
                                            .stroke(tier == t ? Theme.cyan.opacity(0.55) : Color.white.opacity(0.08), lineWidth: 1))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }

                            if tier == "enterprise" {
                                TextField("Organization name", text: $orgName)
                                    .textInputAutocapitalization(.words)
                                    .focused($focused, equals: .org)
                                    .apexInput()
                            }

                            TextField("Brand name", text: $brandName)
                                .textInputAutocapitalization(.words)
                                .autocorrectionDisabled()
                                .focused($focused, equals: .brand)
                                .submitLabel(.next)
                                .onSubmit { focused = .email }
                                .apexInput()

                            TextField("Their email", text: $email)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .textContentType(.emailAddress)
                                .focused($focused, equals: .email)
                                .submitLabel(.send)
                                .onSubmit { if canSend { send() } }
                                .apexInput()

                            if !email.isEmpty && !emailLooksReal {
                                Text("That email is missing a domain ending, like .com.")
                                    .font(.system(size: 11.5)).foregroundStyle(Theme.amber)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            PrimaryButton(title: sending ? "Sending the invite" : "Create and send invite",
                                          icon: "paperplane.fill", busy: sending) { send() }
                                .opacity(canSend ? 1 : 0.5)
                                .disabled(!canSend)
                        }
                        .padding(.horizontal, 20)

                        if let done {
                            ApexCard(accent: Theme.green, padding: 14) {
                                HStack(alignment: .top, spacing: 10) {
                                    Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.green)
                                    Text(done).font(.system(size: 13)).foregroundStyle(Theme.text2).lineSpacing(2)
                                }
                            }
                            .padding(.horizontal, 20)
                        }

                        if let error {
                            ApexCard(accent: Theme.rose, padding: 14) {
                                HStack(alignment: .top, spacing: 10) {
                                    Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Theme.rose)
                                    Text(error).font(.system(size: 13)).foregroundStyle(Theme.text2).lineSpacing(2)
                                }
                            }
                            .padding(.horizontal, 20)
                        }

                        if !invites.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("RECENT INVITES").font(.system(size: 10, weight: .bold)).tracking(1.8).foregroundStyle(Theme.text4)
                                ForEach(invites) { inv in
                                    VStack(alignment: .leading, spacing: 9) {
                                        HStack(spacing: 10) {
                                            Circle()
                                                .fill(inv.accepted_at != nil ? Theme.green : Theme.amber)
                                                .frame(width: 6, height: 6)
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(inv.email).font(.system(size: 13)).foregroundStyle(Theme.text2).lineLimit(1)
                                                Text(inv.accepted_at != nil ? "Set up their account" : "Waiting on them")
                                                    .font(.system(size: 11)).foregroundStyle(Theme.text4)
                                            }
                                            Spacer()
                                            Text(inv.role == "enterprise_admin" ? "Enterprise" : "Client")
                                                .font(.system(size: 10, weight: .semibold))
                                                .foregroundStyle(Theme.text4)
                                        }

                                        // When the email does not land, these are the way out.
                                        if inv.accepted_at == nil {
                                            HStack(spacing: 7) {
                                                inviteChip("Copy link", icon: "link", busy: rowBusy == inv.id + "link") {
                                                    act(inv, "link")
                                                }
                                                inviteChip("Resend", icon: "paperplane", busy: rowBusy == inv.id + "resend") {
                                                    act(inv, "resend")
                                                }
                                                Spacer()
                                                inviteChip("Delete", icon: "trash", color: Theme.rose, busy: rowBusy == inv.id + "delete") {
                                                    act(inv, "delete")
                                                }
                                            }
                                        }

                                        if let m = rowMessage[inv.id] {
                                            Text(m).font(.system(size: 11.5)).foregroundStyle(Theme.cyanSoft)
                                                .frame(maxWidth: .infinity, alignment: .leading)
                                        }
                                    }
                                    .padding(.vertical, 10).padding(.horizontal, 12)
                                    .background(Color.white.opacity(0.03), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                                }
                            }
                            .padding(.horizontal, 20)
                        }

                        Spacer().frame(height: 40)
                    }
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle("")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }.foregroundStyle(Theme.text3)
                }
            }
        }
        .task { invites = (try? await Repo.shared.invites()) ?? [] }
    }

    @ViewBuilder
    private func inviteChip(_ title: String, icon: String, color: Color = Theme.cyan, busy: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                if busy { ProgressView().tint(color).scaleEffect(0.55) }
                else { Image(systemName: icon).font(.system(size: 10, weight: .bold)) }
                Text(title).font(.system(size: 11, weight: .semibold))
            }
            .foregroundStyle(color)
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(color.opacity(0.10), in: Capsule())
            .overlay(Capsule().stroke(color.opacity(0.28), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(!rowBusy.isEmpty)
    }

    private func act(_ inv: Repo.Invite, _ action: String) {
        guard rowBusy.isEmpty else { return }
        rowBusy = inv.id + action
        Task {
            do {
                let link = try await Repo.shared.inviteAction(inv.id, action: action)
                switch action {
                case "link":
                    if let link { UIPasteboard.general.string = link }
                    rowMessage[inv.id] = "Link copied. Send it to them yourself. It replaces any earlier link."
                case "resend":
                    rowMessage[inv.id] = "Invite email sent again."
                default:
                    rowMessage[inv.id] = nil
                }
                Log.event("invite." + action, area: "clients", label: action.capitalized + " invite for " + inv.email)
                invites = (try? await Repo.shared.invites()) ?? invites
            } catch {
                rowMessage[inv.id] = error.localizedDescription
                Log.failure("invite." + action, error, area: "clients", label: "Invite " + action + " failed for " + inv.email)
            }
            rowBusy = ""
        }
    }

    private func send() {
        guard canSend else { return }
        focused = nil
        sending = true; error = nil; done = nil
        let name = brandName.trimmingCharacters(in: .whitespaces)
        let mail = email.trimmingCharacters(in: .whitespaces).lowercased()
        Log.event("client.onboard.start", area: "clients", label: "Onboarding " + name, detail: ["tier": tier])
        Task {
            do {
                let r = try await Repo.shared.onboardClient(brandName: name, email: mail, tier: tier,
                                                            orgName: tier == "enterprise" ? orgName.trimmingCharacters(in: .whitespaces) : nil)
                if let e = r.error, r.ok != true {
                    error = e
                    Log.failure("client.onboard", nil, area: "clients", label: "Onboarding failed for " + name, detail: ["error": e])
                } else {
                    done = "Invite sent to \(mail). \(name) is ready. They finish setup from the email on any device."
                    Log.event("client.onboard", area: "clients", label: "Onboarded " + name, detail: ["tier": tier, "email": mail])
                    brandName = ""; email = ""; orgName = ""
                    invites = (try? await Repo.shared.invites()) ?? invites
                    onDone()
                }
            } catch {
                self.error = error.localizedDescription
                Log.failure("client.onboard", error, area: "clients", label: "Onboarding failed for " + name)
            }
            sending = false
        }
    }
}
