import Foundation
import UIKit

/// The activity log, phone side.
///
///   Log.event("voice.open", area: "voice", label: "Opened the voice layer")
///
/// Events queue for a moment and go up in one batch to /api/log, the same table
/// the portal writes to, so one screen shows everything anyone did anywhere.
/// Never throws, never blocks, and quietly drops events if the person is signed out.
enum Log {
    private static let queueLock = NSLock()
    private static var pending: [[String: Any]] = []
    private static var flushScheduled = false
    private static let session = UUID().uuidString

    private static var appVersion: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        let b = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
        return v + " (" + b + ")"
    }

    static func event(
        _ event: String,
        area: String? = nil,
        label: String? = nil,
        ok: Bool = true,
        ms: Int? = nil,
        brandId: String? = nil,
        detail: [String: Any] = [:]
    ) {
        var row: [String: Any] = [
            "event": event,
            "ok": ok,
            "at": ISO8601DateFormatter().string(from: Date()),
            "sessionId": session,
            "appVersion": appVersion,
            "surface": "ios",
            "detail": sanitize(detail),
        ]
        if let area { row["area"] = area }
        if let label { row["label"] = label }
        if let ms { row["ms"] = ms }
        if let brandId { row["brandId"] = brandId }

        queueLock.lock()
        pending.append(row)
        let count = pending.count
        let schedule = !flushScheduled
        if schedule { flushScheduled = true }
        queueLock.unlock()

        if count >= 25 { flush() }
        else if schedule { DispatchQueue.global().asyncAfter(deadline: .now() + 2) { flush() } }
    }

    /// Something went wrong, with the reason attached.
    static func failure(_ event: String, _ error: Error?, area: String? = nil, label: String? = nil, ms: Int? = nil, brandId: String? = nil, detail: [String: Any] = [:]) {
        var d = detail
        if let error { d["error"] = String(error.localizedDescription.prefix(500)) }
        self.event(event, area: area, label: label, ok: false, ms: ms, brandId: brandId, detail: d)
    }

    /// Times a block of work and logs how long it took.
    static func time<T>(_ event: String, area: String? = nil, label: String? = nil, run: () async throws -> T) async rethrows -> T {
        let t0 = Date()
        do {
            let out = try await run()
            self.event(event, area: area, label: label, ms: Int(Date().timeIntervalSince(t0) * 1000))
            return out
        } catch {
            failure(event, error, area: area, label: label, ms: Int(Date().timeIntervalSince(t0) * 1000))
            throw error
        }
    }

    static func flush() {
        queueLock.lock()
        let batch = pending
        pending = []
        flushScheduled = false
        queueLock.unlock()
        guard !batch.isEmpty else { return }

        Task.detached(priority: .background) {
            do {
                let s = try await SupabaseClient.shared.refreshIfNeeded()
                var req = URLRequest(url: Config.apiBase.appending(path: "api/log"))
                req.httpMethod = "POST"
                req.setValue("Bearer " + s.accessToken, forHTTPHeaderField: "Authorization")
                req.setValue("application/json", forHTTPHeaderField: "Content-Type")
                req.httpBody = try JSONSerialization.data(withJSONObject: ["surface": "ios", "events": batch])
                req.timeoutInterval = 12
                _ = try await URLSession.shared.data(for: req)
            } catch {
                // A log is never worth a visible error. Drop it and move on.
            }
        }
    }

    /// Anything that will not survive JSONSerialization is turned into text.
    private static func sanitize(_ d: [String: Any]) -> [String: Any] {
        var out: [String: Any] = [:]
        for (k, v) in d {
            if JSONSerialization.isValidJSONObject([k: v]) { out[k] = v }
            else { out[k] = String(describing: v) }
        }
        return out
    }
}
