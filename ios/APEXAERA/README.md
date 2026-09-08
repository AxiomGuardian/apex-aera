# APEX AERA iOS

SwiftUI companion app for the APEX AERA portal. iOS 17+, Xcode 16+.

## Open and run
1. Open `APEXAERA.xcodeproj` in Xcode.
2. Signing & Capabilities: pick your Team (bundle id `com.apexaera.app`, change if taken).
3. Run on the simulator or your iPhone.

## What it does
- Sign in with the same email and password as the web portal (Supabase Auth).
- "Explore a demo workspace" on the login screen runs the whole app on mock data, no account needed.
- Role-aware tabs: agency sees Dashboard + Clients; clients see My Brand. Everyone gets Content, Queue, AERA.
- Upload photos and videos from the camera roll straight into the brand's media bucket.
- Approve or skip queued posts. Toggle autopilot. Edit brand voice.
- Connect Instagram / TikTok / Facebook (opens the portal's OAuth in Safari, lands back on the web).
- AERA chat and Run heartbeat call the portal's API with the user's session token.

## Notes
- No third-party packages. Supabase is called over plain URLSession.
- Public keys only in `Config.swift`. No secrets ship in the app.
