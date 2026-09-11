import Foundation
import UIKit
import AVFoundation

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

        // Stills, so AERA can actually see the video. The portal does this on upload
        // and without it a video uploaded from the phone gets analyzed blind.
        var framePaths: [String] = []
        let frames = await Self.stills(from: fileURL, count: 3)
        for (i, jpeg) in frames.enumerated() {
            let fp = "\(brandId)/\(assetId)/frame-\(i).jpg"
            if (try? await sb.upload(bucket: "thumbnails", path: fp, data: jpeg, contentType: "image/jpeg")) != nil {
                framePaths.append(fp)
            }
        }

        let duration = await Self.duration(of: fileURL)
        try await sb.insert("content_assets", body: [
            "id": assetId, "brand_id": brandId, "uploaded_by": s.userId,
            "type": duration > 90 ? "video_long" : "video_short", "status": "uploaded",
            "title": title.isEmpty ? "Video" : title, "description": note ?? NSNull(), "storage_path": path,
            "duration_seconds": duration > 0 ? Int(duration) : NSNull(),
            "metadata": ["size": data.count, "mime": "video/mp4", "source": "ios", "frames": framePaths],
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

    struct ActResponse: Decodable {
        let say: String?
        let ui: [UIDirective]?
        let needsConfirm: Confirm?
        /// What she actually did, in order, in plain words.
        let steps: [StepInfo]?
        struct UIDirective: Decodable { let type: String; let tab: String?; let kind: String?; let id: String? }
        struct Confirm: Decodable { let tool: String; let prompt: String }
        struct StepInfo: Decodable, Hashable { let tool: String; let label: String; let ok: Bool; let ms: Int? }
    }
    func act(_ history: [ChatMessage], confirm: Bool = false) async throws -> ActResponse {
        if demo {
            try await Task.sleep(for: .seconds(1))
            let t = (history.last?.text ?? "").lowercased()
            let ui: [ActResponse.UIDirective] = t.contains("queue") || t.contains("post") ? [.init(type: "navigate", tab: "queue", kind: nil, id: nil), .init(type: "highlight", tab: nil, kind: "post", id: "p1")] : t.contains("client") ? [.init(type: "navigate", tab: "clients", kind: nil, id: nil)] : []
            return ActResponse(say: MockData.reply(to: t), ui: ui, needsConfirm: nil, steps: ui.isEmpty ? [] : [ActResponse.StepInfo(tool: "list_queue", label: "Reading the queue", ok: true, ms: 210)])
        }
        let msgs = history.map { ["role": $0.kind == .user ? "user" : "assistant", "content": $0.text] }
        return try await sb.api("api/aera/act", body: ["messages": msgs, "confirm": confirm], as: ActResponse.self)
    }

    // MARK: Chat threads (shared with the web portal: aera_threads / aera_messages)
    struct Thread: Decodable, Identifiable, Hashable { let id: String; let name: String?; let updated_at: String? }
    struct StoredMessage: Decodable { let msg_id: String?; let role: String; let content: String; let created_at: String? }

    func threads() async throws -> [Thread] {
        if demo { return [Thread(id: "demo", name: "Demo chat", updated_at: nil)] }
        return try await sb.select("aera_threads", query: "select=id,name,updated_at&order=updated_at.desc&limit=50", as: [Thread].self)
    }
    func createThread(name: String = "New chat") async throws -> Thread {
        let id = "thread-" + UUID().uuidString.lowercased()
        if demo { return Thread(id: id, name: name, updated_at: nil) }
        let s = try await sb.refreshIfNeeded()
        try await sb.insert("aera_threads", body: ["id": id, "user_id": s.userId, "name": name])
        return Thread(id: id, name: name, updated_at: nil)
    }
    func renameThread(_ id: String, name: String) async throws {
        if demo { return }
        try await sb.update("aera_threads", match: "id=eq.\(id)", body: ["name": name, "updated_at": ISO8601DateFormatter().string(from: Date())])
    }
    func deleteThread(_ id: String) async throws {
        if demo { return }
        try await sb.delete("aera_messages", match: "session_id=eq.\(id)")
        try await sb.delete("aera_threads", match: "id=eq.\(id)")
    }
    func messages(thread: String) async throws -> [ChatMessage] {
        if demo { return [] }
        let rows = try await sb.select("aera_messages", query: "select=msg_id,role,content,created_at&session_id=eq.\(thread)&order=created_at.asc&limit=200", as: [StoredMessage].self)
        return rows.map { ChatMessage(kind: $0.role == "user" ? .user : .aera, text: $0.content) }
    }
    func saveMessage(thread: String, _ m: ChatMessage) async {
        if demo { return }
        guard let s = try? await sb.refreshIfNeeded() else { return }
        try? await sb.insert("aera_messages", body: ["user_id": s.userId, "session_id": thread, "role": m.kind == .user ? "user" : "aera", "content": m.text, "msg_id": m.id.uuidString.lowercased()])
        try? await sb.update("aera_threads", match: "id=eq.\(thread)", body: ["updated_at": ISO8601DateFormatter().string(from: Date())])
    }

    // MARK: Content pipeline (the same engines the portal runs)
    private struct EngineResult: Decodable { let ok: Bool?; let error: String? }

    /// analyze -> captions -> schedule. Each one moves the asset to the next status.
    func runEngine(_ engine: String, assetId: String) async throws {
        if demo { try await Task.sleep(for: .seconds(1.5)); return }
        let path = engine == "analyze" ? "api/aera/analyze" : engine == "captions" ? "api/aera/captions" : "api/aera/schedule"
        let r = try await sb.api(path, body: ["assetId": assetId], as: EngineResult.self)
        if let e = r.error, r.ok != true { throw SupabaseError.decoding(e) }
    }

    /// Removes the file from storage and then the row.
    func deleteAsset(_ asset: ContentAsset) async throws {
        if demo { return }
        if let path = asset.storage_path, !path.isEmpty {
            try? await sb.removeStorage(bucket: "media", paths: [path])
        }
        try await sb.delete("content_assets", match: "id=eq.\(asset.id)")
    }

    // MARK: Platform connections
    private struct PlainOk: Decodable { let ok: Bool?; let error: String? }
    func disconnect(brandId: String, platform: String) async throws {
        if demo { try await Task.sleep(for: .seconds(1)); return }
        let r = try await sb.api("api/aera/connect/disconnect", body: ["brandId": brandId, "platform": platform], as: PlainOk.self)
        if let e = r.error, r.ok != true { throw SupabaseError.decoding(e) }
    }

    struct InstagramCheck: Decodable {
        let ok: Bool?
        let verdict: String?
        let step: String?
        let detail: String?
    }
    func checkInstagram(brandId: String) async throws -> InstagramCheck {
        if demo { try await Task.sleep(for: .seconds(1)); return InstagramCheck(ok: true, verdict: "Demo mode. Connect a real account to test it.", step: nil, detail: nil) }
        return try await sb.api("api/aera/connect/instagram/check?brandId=\(brandId)", method: "GET", as: InstagramCheck.self)
    }

    // MARK: Client lifecycle (same routes as the portal)
    private struct LifecycleResult: Decodable { let ok: Bool?; let error: String? }

    /// archive keeps everything for 30 days, restore brings it back, delete is forever.
    func brandLifecycle(_ brandId: String, action: String) async throws {
        if demo { try await Task.sleep(for: .seconds(1)); return }
        let r = try await sb.api("api/agency/clients/\(action)", body: ["brandId": brandId], as: LifecycleResult.self)
        if let e = r.error, r.ok != true { throw SupabaseError.decoding(e) }
    }

    // MARK: Onboarding (same route the web portal calls, so both stay in step)
    struct OnboardResult: Decodable {
        let ok: Bool?
        let error: String?
        let brand: BrandStub?
        struct BrandStub: Decodable { let id: String; let name: String }
    }
    func onboardClient(brandName: String, email: String, tier: String = "client", orgName: String? = nil) async throws -> OnboardResult {
        if demo { try await Task.sleep(for: .seconds(1)); return OnboardResult(ok: true, error: nil, brand: .init(id: "demo", name: brandName)) }
        var body: [String: Any] = ["brandName": brandName, "email": email, "tier": tier]
        if let orgName, !orgName.isEmpty { body["orgName"] = orgName }
        return try await sb.api("api/agency/onboard", body: body, as: OnboardResult.self)
    }

    struct Invite: Decodable, Identifiable, Hashable {
        let id: String
        let email: String
        let status: String
        let role: String
        let accepted_at: String?
        let created_at: String
    }
    struct InviteAction: Decodable { let ok: Bool?; let link: String?; let error: String? }
    /// "link" hands back a fresh sign in link, "resend" emails it again, "delete" removes it.
    @discardableResult
    func inviteAction(_ inviteId: String, action: String) async throws -> String? {
        if demo { try await Task.sleep(for: .seconds(1)); return action == "link" ? "https://www.apexaera.com/welcome" : nil }
        let r = try await sb.api("api/agency/invite", body: ["inviteId": inviteId, "action": action], as: InviteAction.self)
        if let e = r.error, r.ok != true { throw SupabaseError.decoding(e) }
        return r.link
    }

    func invites(limit: Int = 20) async throws -> [Invite] {
        if demo { return [] }
        return try await sb.select("invites", query: "select=id,email,status,role,accepted_at,created_at&order=created_at.desc&limit=\(limit)", as: [Invite].self)
    }

    // MARK: Leads (agency pipeline, same route as the portal)
    struct Lead: Decodable, Identifiable, Hashable {
        let id: String
        let name: String
        let category: String?
        let city: String?
        let state: String?
        let website: String?
        let phone: String?
        let instagram: String?
        let tiktok: String?
        let followers: Int?
        let presence: String?
        let gap: String?
        let pitch: String?
        let score: Int?
        let status: String
        let created_at: String?
    }
    private struct LeadList: Decodable { let leads: [Lead] }
    private struct LeadSearchResult: Decodable { let ok: Bool?; let added: Int?; let error: String?; let note: String? }
    private struct OkResult: Decodable { let ok: Bool? }

    func leads(status: String = "all", limit: Int = 100) async throws -> [Lead] {
        if demo { return [] }
        return try await sb.api("api/agency/leads?status=\(status)&limit=\(limit)", method: "GET", as: LeadList.self).leads
    }
    /// Returns how many new ones landed, or a note when everything was already there.
    func findLeads(city: String, industry: String) async throws -> (added: Int, note: String?) {
        if demo { try await Task.sleep(for: .seconds(2)); return (0, "Demo mode does not search for real businesses.") }
        let r = try await sb.api("api/agency/leads", body: ["city": city, "industry": industry, "count": 10], as: LeadSearchResult.self)
        if let e = r.error { throw SupabaseError.decoding(e) }
        return (r.added ?? 0, r.note)
    }
    func setLeadStatus(_ id: String, status: String) async throws {
        if demo { return }
        _ = try await sb.api("api/agency/leads", method: "PATCH", body: ["id": id, "status": status], as: OkResult.self)
    }

    struct Brief: Decodable { let brief: String? }
    func brief() async throws -> String? {
        if demo { return "Two posts are waiting for your yes on IsaacOriginals, and Daisy Fitness has a Reel going out at 4 PM." }
        return try await sb.api("api/aera/brief", method: "GET", as: Brief.self).brief
    }

    struct HeartbeatResult: Decodable { let ok: Bool?; let summary: String? }
    func runHeartbeat() async throws -> String {
        if demo { try await Task.sleep(for: .seconds(2)); return "trends 1, analyzed 2, captioned 2, scheduled 1, due 0" }
        let r = try await sb.api("api/heartbeat", body: [:], as: HeartbeatResult.self)
        return r.summary ?? "Heartbeat ran."
    }

    // MARK: Video stills

    /// Evenly spaced JPEG frames from a video, for the analyzer to look at.
    static func stills(from url: URL, count: Int) async -> [Data] {
        let asset = AVURLAsset(url: url)
        guard let seconds = try? await asset.load(.duration).seconds, seconds.isFinite, seconds > 0 else { return [] }
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 720, height: 720)
        generator.requestedTimeToleranceBefore = .init(seconds: 0.4, preferredTimescale: 600)
        generator.requestedTimeToleranceAfter = .init(seconds: 0.4, preferredTimescale: 600)

        var out: [Data] = []
        for i in 0..<count {
            // A fifth in, the middle, four fifths in. Skips black intro frames.
            let fraction = Double(i + 1) / Double(count + 1)
            let time = CMTime(seconds: seconds * fraction, preferredTimescale: 600)
            guard let cg = try? await generator.image(at: time).image else { continue }
            if let jpeg = UIImage(cgImage: cg).jpegData(compressionQuality: 0.7) { out.append(jpeg) }
        }
        return out
    }

    static func duration(of url: URL) async -> Double {
        let asset = AVURLAsset(url: url)
        guard let d = try? await asset.load(.duration).seconds, d.isFinite, d > 0 else { return 0 }
        return d
    }
}
