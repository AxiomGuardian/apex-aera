import Foundation

enum Role: String, Codable {
    case agencyAdmin = "agency_admin"
    case client
    case enterpriseAdmin = "enterprise_admin"
    case enterpriseMember = "enterprise_member"

    var isAgency: Bool { self == .agencyAdmin }
    var seesClients: Bool { self == .agencyAdmin || self == .enterpriseAdmin }
    var label: String {
        switch self {
        case .agencyAdmin: return "APEX Command"
        case .client: return "Client workspace"
        case .enterpriseAdmin: return "Enterprise admin"
        case .enterpriseMember: return "Team member"
        }
    }
}

struct Profile: Codable, Identifiable {
    let id: String
    let email: String
    let full_name: String?
    let role: Role?
    var firstName: String { (full_name ?? email).split(separator: " ").first.map(String.init) ?? "there" }
}

struct Brand: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let slug: String?
    let status: String
    var tone_of_voice: String?
    var target_audience: String?
    var website_url: String?
    var autopilot: Bool?
    let created_at: String
    var archived_at: String?
    var billing_status: String?
    var last_activity_at: String?
    var voice_confirmed_at: String?

    var initials: String {
        let parts = name.split(separator: " ").compactMap { $0.first }
        return String(parts.prefix(2)).uppercased()
    }
    var isArchived: Bool { status == "archived" }
}

struct ContentAsset: Codable, Identifiable, Hashable {
    let id: String
    let brand_id: String?
    let title: String?
    let type: String
    let status: String
    let storage_path: String?
    let duration_seconds: Double?
    let created_at: String
    var isVideo: Bool { type.hasPrefix("video") }
}

struct ScheduledPost: Codable, Identifiable, Hashable {
    let id: String
    let platform: String
    let scheduled_at: String
    var status: String
    let content_assets: AssetRef?
    let brands: BrandRef?
    struct AssetRef: Codable, Hashable { let title: String? }
    struct BrandRef: Codable, Hashable { let name: String? }
}

struct PlatformConnection: Codable, Identifiable, Hashable {
    var id: String { platform }
    let platform: String
    let status: String
    let account_name: String?
}

struct ChatMessage: Identifiable, Hashable {
    enum Kind { case user, aera }
    let id = UUID()
    let kind: Kind
    var text: String
    var thinking: String? = nil
}

struct PipelineCounts {
    var uploaded = 0, analyzed = 0, captioned = 0, scheduled = 0, published = 0
}

extension String {
    /// "Sep 8, 9:41 PM" from an ISO timestamp.
    var prettyDate: String {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let f2 = ISO8601DateFormatter(); f2.formatOptions = [.withInternetDateTime]
        guard let d = f.date(from: self) ?? f2.date(from: self) else { return self }
        let o = DateFormatter(); o.dateFormat = "MMM d, h:mm a"; o.timeZone = TimeZone(identifier: "America/Phoenix")
        return o.string(from: d)
    }
    var platformLabel: String {
        switch self {
        case "instagram": return "Instagram"
        case "tiktok": return "TikTok"
        case "facebook": return "Facebook"
        case "youtube": return "YouTube"
        case "linkedin": return "LinkedIn"
        default: return self.capitalized
        }
    }
    var platformIcon: String {
        switch self {
        case "instagram": return "camera.fill"
        case "tiktok": return "music.note"
        case "facebook": return "person.2.fill"
        case "youtube": return "play.rectangle.fill"
        case "linkedin": return "briefcase.fill"
        default: return "globe"
        }
    }
}
