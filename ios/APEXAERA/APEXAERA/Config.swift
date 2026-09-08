import Foundation

/// Public keys only. Nothing secret lives in the app.
enum Config {
    static let supabaseURL = URL(string: "https://ogfhkfqomsuvtxasmsou.supabase.co")!
    static let supabaseAnonKey = "sb_publishable_Gd3TpoPs5Mg26VVsGeshpQ_0WXOG4ap"
    /// The web portal. Mobile calls the same API routes with a bearer token.
    static let apiBase = URL(string: "https://www.apexaera.com")!
}
