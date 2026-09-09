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

## Push notifications (not built yet)

Everything Apple side is ready, the app code is not.

- Bundle ID: `com.apexaera.app`, Push Notifications capability enabled on the App ID
- Team ID: `NAQW98L457`
- APNs auth key ID: `W7NTXD9F96`, configured for Sandbox and Production, Team Scoped (all topics)
- The `.p8` file itself lives with Isaac. Apple only lets it be downloaded once. It never goes in this repo.

Still to build: register for remote notifications in the app, store the device token per user,
a table for tokens, and a server route that signs a JWT with the key and posts to APNs.
APNs environments: Xcode debug builds hit sandbox, TestFlight and App Store builds hit production.
The key above covers both.
