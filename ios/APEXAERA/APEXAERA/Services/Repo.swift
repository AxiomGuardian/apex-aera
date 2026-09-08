import Foundation
import UIKit

/// One place for every read and write. Routes to Supabase, or to MockData in demo mode.
final class Repo {
    static let shared = Repo()
    private var sb: SupabaseClient { SupabaseClient.shared }
    var demo = false

    func profile(userId: String, email: String) async throws -> Profile {
        let rows: [Profile] = try await sb.select("profiles", query: "select=id,email,full_name,role&id=eq.\(userId)&limit=1", as: [Profile].self)
        return rows.first ?? Profile(id: userId, email: email, full_name: nil, role: .client)
    }

    func brands(includeArchived: Bool = false) async throws -> [Brand] {
        if demo { return MockData.brands }
        var q = "select=id,name,slug,status,tone_of_voice,target_audience,website_url,autopilot,created_at,archived_at,billing_status,last_activity_at,voice_confirmed_at&order=created_at.desc"
        if !includeArchived { q += "&status=neq.archived" }
        return try await sb.select("brands", query: q, as: [Brand].self)
    }

    func myBrand() async throws -> Brand? { try await brands().first }

    func assets(brandId: String? = nil, limit: Int = 50) async throws -> [ContentAsset] {
        if demo { return brandId == nil ? MockData.assets : MockData.assets.filter { $0.brand_id == brandId } }
        var q = "select=id,brand_id,title,type,status,storage_path,duration_seconds,created_at&order=created_at.desc&limit=\(limit)"
        if let brandId { q += "&brand_id=eq.\(brandId)" }
        return try await sb.select("content_assets", query: q, as: [ContentAsset].self)
    }

    func posts(brandId: String? = nil) async throws -> [ScheduledPost] {
        if demo { return MockData.posts }
        var q = "select=id,platform,scheduled_at,status,content_assets(title),brands(name)&status=in.(proposed,approved,locked,published)&order=scheduled_at.asc&limit=60"
        if let brandId { q += "&brand_id=eq.\(brandId)" }
        return try await sb.select("scheduled_posts", query: q, as: [ScheduledPost].self)
    }

    func setPost(_ id: String, status: String) async throws {
        if demo { return }
        try await sb.update("scheduled_posts", match: "id=eq.\(id)", body: ["status": status])
    }

    func connections(brandId: String) async throws -> [PlatformConnection] {
        if demo { return MockData.connections[brandId] ?? [] }
        return try await sb.select("platform_connections", query: "select=platform,status,account_name&brand_id=eq.\(brandId)", as: [PlatformConnection].self)
    }

    func pipeline() async throws -> PipelineCounts {
        let a = try await assets(limit: 500)
        var c = PipelineCounts()
        for x in a {
            switch x.status {
            case "uploaded": c.uploaded += 1
            case "analyzed": c.analyzed += 1
            case "captioned": c.captioned += 1
            case "scheduled": c.scheduled += 1
            case "published": c.published += 1
            default: break
            }
        }
        return c
    }

    func saveBrand(_ b: Brand) async throws {
        if demo { return }
        try await sb.update("brands", match: "id=eq.\(b.id)", body: [
            "tone_of_voice": b.tone_of_voice ?? NSNull(),
            "target_audience": b.target_audience ?? NSNull(),
            "website_url": b.website_url ?? NSNull(),
            "autopilot": b.autopilot ?? true,
        ])
    }

    func uploadImage(brandId: String, image: UIImage, title: String, note: String?) async throws {
        if demo { try await Task.sleep(for: .seconds(1)); return }
        guard let data = image.jpegData(compressionQuality: 0.9) else { throw SupabaseError.decoding("image") }
        let s = try await sb.refreshIfNeeded()
        let assetId = UUID().uuidString.lowercased()
        let path = "\(brandId)/\(assetId)/\(title.isEmpty ? "photo" : title).jpg"
        try await sb.upload(bucket: "media", path: path, data: data, contentType: "image/jpeg")
        try await sb.insert("content_assets", body: [
            "id": assetId, "brand_id": brandId, "uploaded_by": s.userId, "type": "image", "status": "uploaded",
            "title": title.isEmpty ? "Photo" : title, "description": note ?? NSNull(), "storage_path": path,
            "metadata": ["size": data.count, "mime": "image/jpeg", "source": "ios"],
        ])
    }

    func uploadVideo(brandId: String, fileURL: URL, title: String, note: String?) async throws {
        if demo { try await Task.sleep(for: .seconds(1)); return }
        let data = try Data(contentsOf: fileURL)
        let s = try await sb.refreshIfNeeded()
        let assetId = UUID().uuidString.lowercased()
        let ext = fileURL.pathExtension.isEmpty ? "mp4" : fileURL.pathExtension
        let path = "\(brandId)/\(assetId)/\(title.isEmpty ? "video" : title).\(ext)"
        try await sb.upload(bucket: "media", path: path, data: data, contentType: ext == "mov" ? "video/quicktime" : "video/mp4")
        try await sb.insert("content_assets", body: [
            "id": assetId, "brand_id": brandId, "uploaded_by": s.userId, "type": "video_short", "status": "uploaded",
            "title": title.isEmpty ? "Video" : title, "description": note ?? NSNull(), "storage_path": path,
            "metadata": ["size": data.count, "mime": "video/mp4", "source": "ios"],
        ])
    }

    struct ChatReply: Decodable { let content: String; let thinking: String? }
    func chat(_ history: [ChatMessage], context: String? = nil) async throws -> ChatReply {
        if demo { try await Task.sleep(for: .seconds(1)); return ChatReply(content: MockData.reply(to: history.last?.text ?? ""), thinking: nil) }
        let msgs = history.map { ["role": $0.kind == .user ? "user" : "assistant", "content": $0.text] }
        var body: [String: Any] = ["messages": msgs]
        if let context { body["systemOverride"] = context }
        return try await sb.api("api/aera/chat", body: body, as: ChatReply.self)
    }

    /// Live snapshot of the user's brands for AERA: voice, platforms, queue, content. Keeps answers specific.
    func brandContext() async throws -> String {
        let bs = try await brands()
        var out: [String] = ["LIVE WORKSPACE CONTEXT (from the APEX database right now). Speak to this brand specifically. Infer the industry from the audience, tone, and website, and shape suggestions for that industry (real estate, construction, e-commerce, creator, fitness, restaurant, etc.). Offer concrete next posts, not generic advice. Keep replies short, no em dashes, no bullet spam."]
        for b in bs.prefix(6) {
            let conns = (try? await connections(brandId: b.id)) ?? []
            let posts = (try? await posts(brandId: b.id)) ?? []
            let assets = (try? await assets(brandId: b.id, limit: 8)) ?? []
            out.append("""
            BRAND: \(b.name)
            Tone: \(b.tone_of_voice ?? "not set"). Audience: \(b.target_audience ?? "not set"). Website: \(b.website_url ?? "none").
            Autopilot: \(b.autopilot == false ? "off (manual approval)" : "on"). Billing: \(b.billing_status ?? "active").
            Platforms: \(conns.isEmpty ? "none connected" : conns.map { "\($0.platform) \($0.status)\($0.account_name.map { " (" + $0 + ")" } ?? "")" }.joined(separator: ", ")).
            Queue: \(posts.filter { $0.status != "published" }.isEmpty ? "empty" : posts.filter { $0.status != "published" }.prefix(6).map { "\($0.content_assets?.title ?? "Untitled") to \($0.platform) at \($0.scheduled_at.prettyDate) [\($0.status)]" }.joined(separator: "; ")).
            Recent content: \(assets.isEmpty ? "none uploaded" : assets.map { "\($0.title ?? "Untitled") (\($0.type), \($0.status))" }.joined(separator: "; ")).
            """)
        }
        return out.joined(separator: "\n\n")
    }

    struct PublishResult: Decodable { let ok: Bool; let error: String?; let platformPostId: String? }
    func publishNow(_ postId: String) async throws -> PublishResult {
        if demo { try await Task.sleep(for: .seconds(2)); return PublishResult(ok: true, error: nil, platformPostId: "demo") }
        return try await sb.api("api/aera/publish-now", body: ["postId": postId], as: PublishResult.self)
    }

    struct HeartbeatResult: Decodable { let ok: Bool?; let summary: String? }
    func runHeartbeat() async throws -> String {
        if demo { try await Task.sleep(for: .seconds(2)); return "trends 1, analyzed 2, captioned 2, scheduled 1, due 0" }
        let r = try await sb.api("api/heartbeat", body: [:], as: HeartbeatResult.self)
        return r.summary ?? "Heartbeat ran."
    }
}
