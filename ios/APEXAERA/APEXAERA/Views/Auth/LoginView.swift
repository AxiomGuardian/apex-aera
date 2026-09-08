import SwiftUI

struct LoginView: View {
    @Environment(Session.self) private var session
    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    @State private var busy = false
    @FocusState private var focus: Field?
    enum Field { case email, password }

    var body: some View {
        ZStack {
            ApexBackground()
            ScrollView {
                VStack(spacing: 22) {
                    Spacer().frame(height: 60)
                    AuthMark(size: 72)
                    VStack(spacing: 6) {
                        Text("APEX AERA").font(.system(size: 13, weight: .bold)).tracking(4).foregroundStyle(Theme.cyanSoft)
                        Text("Welcome back.").font(.system(size: 30, weight: .heavy)).foregroundStyle(Theme.text)
                        Text("Sign in to your workspace.").font(.system(size: 14)).foregroundStyle(Theme.text3)
                    }
                    VStack(spacing: 12) {
                        TextField("Email", text: $email)
                            .keyboardType(.emailAddress).textContentType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                            .focused($focus, equals: .email).apexInput()
                        HStack {
                            Group {
                                if showPassword { TextField("Password", text: $password) } else { SecureField("Password", text: $password) }
                            }
                            .textContentType(.password).focused($focus, equals: .password)
                            Button { showPassword.toggle() } label: { Image(systemName: showPassword ? "eye.slash" : "eye").foregroundStyle(Theme.text4) }
                        }
                        .apexInput()
                        if let e = session.error {
                            Text(e).font(.system(size: 12.5)).foregroundStyle(Theme.rose).frame(maxWidth: .infinity, alignment: .leading)
                        }
                        PrimaryButton(title: "Sign in", icon: "arrow.right", busy: busy) {
                            focus = nil; busy = true
                            Task { await session.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password); busy = false }
                        }
                        .disabled(email.isEmpty || password.isEmpty)
                        .opacity(email.isEmpty || password.isEmpty ? 0.6 : 1)
                    }
                    .padding(22)
                    .background(Theme.surface.opacity(0.78), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Theme.border, lineWidth: 1))
                    .padding(.horizontal, 22)

                    Button { session.enterDemo() } label: {
                        Text("Explore a demo workspace").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.cyanSoft)
                    }
                    Text("Access is by invitation. Your workspace is private and qualified.")
                        .font(.system(size: 11.5)).foregroundStyle(Theme.text4).multilineTextAlignment(.center).padding(.horizontal, 40)
                    Spacer()
                }
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }
}
