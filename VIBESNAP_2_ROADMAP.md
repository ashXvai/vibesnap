# VibeSnap 2.0 — Futuristic Messaging Platform Roadmap

**Product direction:** a next-generation messaging platform with a distinctive futuristic visual identity, expressive conversations, collaborative chat experiences, and dependable privacy.

**Status:** planning baseline. This document does not change the live app, Supabase schema, user accounts, or encryption.

## Non-negotiable safety and compatibility rules

1. Preserve all existing Supabase Auth users, profile rows, usernames, friendships, friend requests, conversations, messages, media objects, and user preferences.
2. Never reset, rotate, overwrite, or regenerate existing encryption keys as part of a feature rollout. Any future key-format change requires a separately reviewed, versioned migration and a compatibility path for old messages.
3. Keep existing login/session behaviour and the current Supabase project configuration. Do not reintroduce Firebase or replace the backend.
4. Keep `vibesnap-backup.html` untouched.
5. Do not expose private profile fields, encryption material, signed media URLs, or conversation content through public tables, logs, analytics, or QR codes.
6. Add database changes only through additive, reviewed migrations with RLS policies, indexes, rollback notes, and a documented backfill strategy. No destructive schema or data resets.
7. Keep the existing mobile camera flow and mobile layout stable while improving desktop/tablet layouts. Camera permission must remain deferred until the camera is opened.
8. Keep the existing product decisions: username-only discovery; no profile bio or friends count; no disappearing media/Stories; no automatic Downloads-folder saving; no account-recovery feature; no notification feature.
9. Respect reduced-motion preferences and provide a low-motion mode for animated visual effects.
10. Real-device and real-account testing remains postponed until after December 2026. Before then, limit verification to safe code review, static checks, migration review, and isolated non-production tests.

## Product architecture

- **Client:** retain the current browser-based HTML/CSS/JavaScript application and its existing page/navigation structure. Introduce modular feature files rather than rewriting the single-page application all at once.
- **Backend:** retain Supabase Auth, Postgres, Realtime, and Storage already used by the app.
- **Data access:** continue using the existing compatibility adapter until a feature can be migrated deliberately. Avoid mixing direct Supabase calls into unrelated UI code.
- **Security:** enforce ownership and conversation membership in RLS. Realtime channels must be scoped to authorised conversation members. Treat client-side visibility checks as presentation only, never as access control.
- **Encryption:** document the current message encryption contract before extending it. New message types must declare a versioned payload format and must not silently fall back to plaintext.
- **Feature rollout:** build each capability behind a small feature flag or isolated entry point where practical. Merge in small pull requests with clear rollback instructions.

## Workstreams and implementation sequence

### Phase 0 — Baseline audit and safety gate

- Review the current main branch, open pull requests, existing migrations, Supabase adapter, message encryption/decryption flow, media upload/download flow, and current navigation.
- Audit the open personalization PR before merging it. Confirm selectors, lifecycle hooks, local-storage limits, QR privacy, and behaviour when a user signs out or switches accounts.
- Record current database tables, columns, constraints, RLS policies, storage buckets, and encryption key locations without changing them.
- Establish a safe feature branch and change log for each workstream.
- **Exit criteria:** a written compatibility map and no unreviewed changes to production data or key material.

### Phase 1 — Futuristic visual system and responsive shell

- Define a consistent visual language: deep midnight surfaces, restrained neon violet/cyan accents, soft glass panels, clear typography, and purposeful motion.
- Create shared CSS tokens for colour, spacing, radius, elevation, focus rings, and animation timing.
- Upgrade desktop navigation and conversation layout while preserving the current mobile navigation and camera controls.
- Add keyboard navigation, visible focus states, sufficient contrast, reduced-motion support, and graceful fallbacks where backdrop filters or animation are unavailable.
- **Exit criteria:** all existing pages remain reachable; mobile layout rules are not replaced by desktop styling; motion can be reduced or disabled.

### Phase 2 — Reliable conversation foundation

- Define a documented message envelope for text, media, voice, reactions, replies, edits, and future thread messages.
- Add conversation branches/threads as a separate view linked to a parent message; do not duplicate or rewrite the original message.
- Add message edit history with clear edited status and author/time metadata. Preserve the original encrypted payload in a controlled history model; never store plaintext edit history.
- Add personal bookmarks and folders using user-owned records. Bookmarking must not grant access to a message outside the user's conversations.
- Add scheduled sending only after a trusted server-side scheduling design exists. A browser timer is not reliable enough. The scheduled payload must remain encrypted until delivery and must have explicit cancellation and retry semantics.
- Add smart search in a privacy-preserving way. Because encrypted message bodies cannot be searched by the server as ordinary plaintext, begin with metadata filters and optional client-side search over messages the device can decrypt. Do not silently upload plaintext search indexes.
- **Exit criteria:** old messages remain readable; new message types are versioned; RLS protects every new row; no plaintext is added to database logs or indexes.

### Phase 3 — Live Duo Space

- Add a collaborative canvas that opens from a one-to-one conversation.
- Support strokes, text notes, shapes, and user-selected images; show live cursors/presence only to authorised participants.
- Use Supabase Realtime for transient collaboration events and Postgres/Storage for explicitly saved snapshots.
- Persist only intentional saves; define ownership, participant access, size limits, and deletion semantics.
- Reconnect safely after network loss and reconcile simultaneous edits without overwriting a participant's work.
- **Exit criteria:** non-members cannot subscribe or read saved spaces; reconnect does not duplicate or corrupt canvas state.

### Phase 4 — Voice Studio and expressive messages

- Improve voice recording controls, trimming, waveform display, playback speed, and accessible playback controls.
- Add expressive message cards and reaction combinations as presentation layers around the existing message envelope.
- Keep media access behind existing authenticated storage rules and short-lived signed URLs. Do not place permanent public media URLs in message rows.
- Document whether media is end-to-end encrypted before promising that it is; do not change media encryption implicitly as part of UI work.
- **Exit criteria:** old voice/media messages still play; unsupported browsers have a usable fallback; no media becomes public.

### Phase 5 — Translation and personal chat tools

- Add user-initiated translation with the original message always available.
- Clearly disclose when text would leave the device for a translation provider. Prefer an explicit per-message action and opt-in setting.
- Never send private conversation history to an external service automatically.
- Add optional on-device organisation tools only where the browser can process already-decrypted content safely.
- **Exit criteria:** translation is opt-in, reversible, and does not change stored encrypted message content.

### Phase 6 — Shared memories and friendship timeline

- Build on the existing private/local memory concept only after reviewing its current implementation.
- Distinguish device-local saves from shared, server-synchronised memories in the UI.
- Shared memories require explicit participant consent and conversation-scoped access policies.
- Preserve original media permissions and provide clear remove/unshare controls. Do not imply that a local-only save is synced across devices.
- **Exit criteria:** memory ownership and visibility are clear; removing a memory does not unexpectedly delete the original chat message or media.

### Phase 7 — Secure multi-device continuity

- Audit the existing key backup/recovery implementation and supported key versions before making changes.
- Design device enrolment and key transfer around user-authorised, encrypted key material. Never upload raw private keys or passwords.
- Ensure a new device can access history only after an explicit secure enrolment step.
- Add device/session management only with clear sign-out semantics and no accidental deletion of account data.
- **Exit criteria:** existing devices and old encrypted messages continue to work; no key rotation or recovery flow is triggered silently.

### Phase 8 — Final quality, accessibility, and release readiness

- Run static syntax checks, dependency/security review, migration checks, and isolated automated tests before any live-account testing.
- After the agreed testing window, perform staged tests with dedicated test accounts and test conversations, never by clearing real user data.
- Validate Android Chrome, desktop Chrome, tablet layouts, camera permission timing, offline/reconnect behaviour, and multi-device encryption.
- Prepare a release checklist and rollback procedure for each merged workstream.
- **Exit criteria:** all critical paths pass; no unresolved data-loss, privacy, encryption, or account-access issue remains.

## Suggested feature flags

Use independent flags so features can be rolled back without changing existing data:

- `v2_visual_shell`
- `message_threads`
- `message_edit_history`
- `message_bookmarks`
- `scheduled_messages`
- `duo_space`
- `voice_studio`
- `message_translation`
- `shared_memories`
- `secure_device_enrolment`

Flags must default to off until the relevant code, RLS, migration, and compatibility review is complete.

## Data and encryption review checklist for every feature

- Does this feature add a table, column, storage path, or Realtime channel?
- Is every new row scoped to the authenticated owner or conversation members?
- Are RLS policies enabled and tested for both allowed and denied access?
- Does any data contain plaintext message content, private keys, tokens, or permanent media URLs?
- Can an old client still read old records?
- Can the feature be disabled without deleting user data?
- Is there a safe rollback that does not destroy messages, profiles, friendships, media, or keys?
- Are retention, export, and deletion behaviours explained to the user?

## Explicitly out of scope for this roadmap

- Replacing Supabase or migrating back to Firebase.
- Resetting accounts, profiles, friendships, messages, media, or encryption keys.
- Account recovery or password-reset redesign.
- Public profile discovery by email or phone.
- Disappearing messages, Stories, or automatic media downloads.
- Notifications.
- Rewriting the app wholesale before the current architecture is understood.

## First implementation milestone

Start with Phase 0: inspect and document the current implementation, review the existing personalization pull request, and establish the visual-system foundation as a separate, reversible change. Do not merge the personalization pull request or apply database migrations until its compatibility and security review is complete.
