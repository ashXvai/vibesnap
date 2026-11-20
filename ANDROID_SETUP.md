# VibeSnap Android app setup

This repository keeps the existing GitHub Pages website as the source of truth and prepares a local web bundle for the Android app.

## Current architecture

- Website: the existing root `index.html` and its JavaScript modules.
- Android wrapper: Capacitor.
- Backend: the existing Supabase project and compatibility adapter.
- Proposed Android application ID: `com.vibesnap.app`.

The Android wrapper must use the same Supabase project and existing authentication/data contracts. Do not create a second backend or change user data as part of the conversion.

## Requirements

- Node.js 22 or newer.
- Android Studio 2025.2.1 or newer for Capacitor 8.
- Android SDK Platform 24 or newer.
- A physical Android phone for camera and real-device checks.

## Prepare the web bundle

From the repository root:

```bash
npm install
npm run build:web
```

The preparation script copies the current website entry point and its local JavaScript modules into the generated `www/` directory. The generated directory is intentionally ignored by Git and can be recreated at any time.

## Create and open the Android project

After Android Studio and the Android SDK are installed:

```bash
npx cap add android
npm run cap:sync
npx cap open android
```

For later web-code updates, run:

```bash
npm run cap:sync
```

## Compatibility items to validate before release

1. Test username/password sign-in and session persistence in the Android WebView.
2. Test the existing live camera flow. The website uses `navigator.mediaDevices.getUserMedia()` and `MediaRecorder`; do not replace it with a still-photo-only flow. Camera permission must remain deferred until the user opens the Camera screen.
3. Verify media upload/download against the existing private Supabase Storage bucket.
4. Verify realtime chat, encrypted message history, reconnect behaviour, and signed media URLs.
5. Check keyboard resizing, Android back navigation, screen insets, and app lifecycle.
6. Keep the browser website working independently; do not make its entry point depend on Android-only plugins.

## Important boundaries

- Do not edit `vibesnap-backup.html`.
- Do not change Supabase keys, authentication settings, database schema, RLS policies, user accounts, messages, or stored media for this scaffolding task.
- Never put a Supabase service-role/secret key in the client app.
- Do not add disguised-app behaviour. The Android app should be clearly identified as VibeSnap.
- No app-store release or real-device compatibility claim is made by this setup scaffold.
