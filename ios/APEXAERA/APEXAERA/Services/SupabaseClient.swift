import Foundation

/// Thin Supabase client over URLSession: auth, PostgREST, storage. No SDK, no surprises.
struct SupabaseSession: Codable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Date
    var userId: String
    var email: String
}

enum SupabaseError: LocalizedError {
    case http(Int, String)
    case decoding(String)
    case noSession
    var errorDescription: String? {
        switch self {
        case .http(let code, let msg): return msg.isEmpty ? "Request failed (\(code))" : msg
        case .decoding(let m): return "Could not read the server response: \(m)"
        case .noSession: return "You are signed out."
        }
    }
}

actor SupabaseClient {
    static let shared = SupabaseClient()
    private let base = Config.supabaseURL
    private let anon = Config.supabaseAnonKey
    private(set) var session: SupabaseSession?

    private let store = UserDefaults.standard
    private let key = "apex.supabase.session"

    init() {
        if let data = UserDefaults.standard.data(forKey: "apex.supabase.session"),
           let s = try? JSONDecoder().decode(SupabaseSession.self, from: data) { session = s }
    }

    private func persist(_ s: SupabaseSession?) {
        session = s
        if let s, let data = try? JSONEncoder().encode(s) { store.set(data, forKey: key) } else { store.removeObject(forKey: key) }
    }

    // MARK: Auth
    private struct TokenResponse: Decodable {
        let access_token: String; let refresh_token: String; let expires_in: Int
        let user: U; struct U: Decodable { let id: String; let email: String? }
    }

    func signIn(email: String, password: String) async throws -> SupabaseSession {
        var req = URLRequest(url: base.appending(path: "auth/v1/token").appending(queryItems: [.init(name: "grant_type", value: "password")]))
        req.httpMethod = "POST"
        req.setValue(anon, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["email": email, "password": password])
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, http.statusCode < 300 else {
            let msg = (try? JSONDecoder().decode([String: String].self, from: data))?["error_description"] ?? (try? JSONDecoder().decode([String: String].self, from: data))?["msg"] ?? "Sign-in failed"
            throw SupabaseError.http((resp as? HTTPURLResponse)?.statusCode ?? 0, msg == "Invalid login credentials" ? "That email or password is not right." : msg)
        }
        let t = try JSONDecoder().decode(TokenResponse.self, from: data)
        let s = SupabaseSession(accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date().addingTimeInterval(TimeInterval(t.expires_in - 60)), userId: t.user.id, email: t.user.email ?? email)
        persist(s); return s
    }

    func refreshIfNeeded() async throws -> SupabaseSession {
        guard let s = session else { throw SupabaseError.noSession }
        if s.expiresAt > Date() { return s }
        var req = URLRequest(url: base.appending(path: "auth/v1/token").appending(queryItems: [.init(name: "grant_type", value: "refresh_token")]))
        req.httpMethod = "POST"
        req.setValue(anon, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["refresh_token": s.refreshToken])
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, http.statusCode < 300 else { persist(nil); throw SupabaseError.noSession }
        let t = try JSONDecoder().decode(TokenResponse.self, from: data)
        let n = SupabaseSession(accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date().addingTimeInterval(TimeInterval(t.expires_in - 60)), userId: t.user.id, email: t.user.email ?? s.email)
        persist(n); return n
    }

    func signOut() async {
        if let s = session {
            var req = URLRequest(url: base.appending(path: "auth/v1/logout"))
            req.httpMethod = "POST"; req.setValue(anon, forHTTPHeaderField: "apikey"); req.setValue("Bearer " + s.accessToken, forHTTPHeaderField: "Authorization")
            _ = try? await URLSession.shared.data(for: req)
        }
        persist(nil)
    }

    // MARK: PostgREST
    private func authed(_ url: URL, method: String = "GET") async throws -> URLRequest {
        let s = try await refreshIfNeeded()
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue(anon, forHTTPHeaderField: "apikey")
        req.setValue("Bearer " + s.accessToken, forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return req
    }

    private func run<T: Decodable>(_ req: URLRequest, as: T.Type) async throws -> T {
        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard code < 300 else {
            let msg = (try? JSONDecoder().decode([String: String?].self, from: data))?["message"] ?? nil
            throw SupabaseError.http(code, msg ?? String(data: data, encoding: .utf8) ?? "")
        }
        if T.self == EmptyResponse.self { return EmptyResponse() as! T }
        do { return try JSONDecoder().decode(T.self, from: data) }
        catch { throw SupabaseError.decoding(error.localizedDescription) }
    }
    struct EmptyResponse: Decodable {}

    /// GET /rest/v1/{table}?{query}
    func select<T: Decodable>(_ table: String, query: String, as: T.Type) async throws -> T {
        let url = URL(string: base.absoluteString + "/rest/v1/" + table + "?" + query)!
        return try await run(try await authed(url), as: T.self)
    }

    func insert(_ table: String, body: [String: Any]) async throws {
        var req = try await authed(base.appending(path: "rest/v1/" + table), method: "POST")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        _ = try await run(req, as: EmptyResponse.self)
    }

    func update(_ table: String, match: String, body: [String: Any]) async throws {
        let url = URL(string: base.absoluteString + "/rest/v1/" + table + "?" + match)!
        var req = try await authed(url, method: "PATCH")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        _ = try await run(req, as: EmptyResponse.self)
    }

    func delete(_ table: String, match: String) async throws {
        let url = URL(string: base.absoluteString + "/rest/v1/" + table + "?" + match)!
        _ = try await run(try await authed(url, method: "DELETE"), as: EmptyResponse.self)
    }

    // MARK: Storage
    func upload(bucket: String, path: String, data: Data, contentType: String) async throws {
        var req = try await authed(base.appending(path: "storage/v1/object/" + bucket + "/" + path), method: "POST")
        req.setValue(contentType, forHTTPHeaderField: "Content-Type")
        req.httpBody = data
        _ = try await run(req, as: EmptyResponse.self)
    }

    /// Calls a web-portal API route with the user's bearer token.
    func api<T: Decodable>(_ path: String, method: String = "POST", body: [String: Any]? = nil, as: T.Type) async throws -> T {
        let s = try await refreshIfNeeded()
        var req = URLRequest(url: Config.apiBase.appending(path: path))
        req.httpMethod = method
        req.setValue("Bearer " + s.accessToken, forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // So the activity log knows this came from the phone.
        req.setValue("ios", forHTTPHeaderField: "x-apex-surface")
        if let body { req.httpBody = try JSONSerialization.data(withJSONObject: body) }
        return try await run(req, as: T.self)
    }
}
