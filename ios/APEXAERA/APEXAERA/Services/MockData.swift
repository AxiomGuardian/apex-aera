import Foundation

/// Demo workspace so the app is fully explorable without an account.
enum MockData {
    static let profile = Profile(id: "demo", email: "demo@apexaera.com", full_name: "Isaac Rodriguez", role: .agencyAdmin)

    static let brands: [Brand] = [
        Brand(id: "b1", name: "IsaacOriginals", slug: "isaacoriginals", status: "active", tone_of_voice: "Bold, cinematic, encouraging. Short sentences.", target_audience: "Creators and founders 22 to 40 building a personal brand.", website_url: "https://isaacoriginals.com", autopilot: true, created_at: "2026-09-01T18:00:00Z", archived_at: nil, billing_status: "active", last_activity_at: "2026-09-08T02:00:00Z", voice_confirmed_at: "2026-09-06T02:00:00Z"),
        Brand(id: "b2", name: "Daisy Fitness", slug: "daisy-fitness", status: "active", tone_of_voice: "Energetic, warm, no-nonsense.", target_audience: "Women 25 to 45 starting their fitness journey.", website_url: nil, autopilot: true, created_at: "2026-08-20T18:00:00Z", archived_at: nil, billing_status: "active", last_activity_at: "2026-09-07T20:00:00Z", voice_confirmed_at: nil),
        Brand(id: "b3", name: "Rodriguez Forge", slug: "rodriguez-forge", status: "active", tone_of_voice: "Craftsman. Proud, plain, honest.", target_audience: "Homeowners and realtors in the Phoenix valley.", website_url: "https://rodriguezforge.com", autopilot: false, created_at: "2026-08-28T18:00:00Z", archived_at: nil, billing_status: "past_due", last_activity_at: "2026-09-05T20:00:00Z", voice_confirmed_at: nil),
    ]

    static let connections: [String: [PlatformConnection]] = [
        "b1": [PlatformConnection(platform: "instagram", status: "connected", account_name: "@isaacoriginals"), PlatformConnection(platform: "tiktok", status: "connected", account_name: "@isaac.rodriguez962")],
        "b2": [PlatformConnection(platform: "instagram", status: "connected", account_name: "@daisyfit")],
        "b3": [],
    ]

    static let assets: [ContentAsset] = [
        ContentAsset(id: "a1", brand_id: "b1", title: "Studio walkthrough", type: "video_short", status: "scheduled", storage_path: nil, duration_seconds: 42, created_at: "2026-09-07T22:10:00Z"),
        ContentAsset(id: "a2", brand_id: "b1", title: "New drop teaser", type: "image", status: "analyzed", storage_path: nil, duration_seconds: nil, created_at: "2026-09-07T20:30:00Z"),
        ContentAsset(id: "a3", brand_id: "b2", title: "Morning mobility routine", type: "video_short", status: "published", storage_path: nil, duration_seconds: 58, created_at: "2026-09-06T15:00:00Z"),
        ContentAsset(id: "a4", brand_id: "b2", title: "Client transformation", type: "image", status: "captioned", storage_path: nil, duration_seconds: nil, created_at: "2026-09-07T13:00:00Z"),
        ContentAsset(id: "a5", brand_id: "b3", title: "Iron gate install", type: "video_long", status: "uploaded", storage_path: nil, duration_seconds: 310, created_at: "2026-09-08T01:00:00Z"),
    ]

    static let posts: [ScheduledPost] = [
        ScheduledPost(id: "p1", platform: "instagram", scheduled_at: "2026-09-08T18:00:00Z", status: "proposed", content_assets: .init(title: "Studio walkthrough"), brands: .init(name: "IsaacOriginals")),
        ScheduledPost(id: "p2", platform: "tiktok", scheduled_at: "2026-09-08T23:30:00Z", status: "approved", content_assets: .init(title: "Studio walkthrough"), brands: .init(name: "IsaacOriginals")),
        ScheduledPost(id: "p3", platform: "instagram", scheduled_at: "2026-09-09T16:00:00Z", status: "proposed", content_assets: .init(title: "Client transformation"), brands: .init(name: "Daisy Fitness")),
        ScheduledPost(id: "p4", platform: "instagram", scheduled_at: "2026-09-06T17:00:00Z", status: "published", content_assets: .init(title: "Morning mobility routine"), brands: .init(name: "Daisy Fitness")),
    ]

    static func reply(to text: String) -> String {
        let t = text.lowercased()
        if t.contains("trend") { return "Three things are moving in your niche this week: behind-the-scenes process videos are up 34% in engagement, carousel posts with a single bold line are outperforming captions with hashtags, and posting between 5 and 7 PM Phoenix time is beating mornings for creators your size. I have queued a trend brief on the IsaacOriginals workspace." }
        if t.contains("post") || t.contains("schedule") { return "You have 2 posts waiting for a yes in the Queue and 1 on autopilot for tonight at 4:30 PM. Want me to approve both, or hold the TikTok one until the sandbox test lands?" }
        if t.contains("report") { return "Last 7 days across your brands: 6 published, 2 scheduled, reach up 18% week over week, driven mostly by Daisy Fitness Reels. Rodriguez Forge has not posted in 9 days and billing is past due; I have sent the reminder." }
        return "I am AERA. I read your brand voice, watch your content, research your market, and run the posting. Ask me what is trending, what is in the queue, or for a report on any client."
    }
}
