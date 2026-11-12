# VibeSnap 2.0 — Baseline Compatibility and Security Audit

**Audit date:** 2026-11-12  
**Audited base:** `main` at `bba4156476e2c4db8a70e61cfc1f4f9fdd8e5313`  
**Scope:** read-only repository review. No application runtime, Supabase project, production database, storage objects, accounts, or keys were changed.

## Executive summary

The current application is a large browser-based single-page app centred on `index.html`, with Supabase access split between `supabase-adapter.js` and the legacy-compatible `supabase-compat.js`. The current code already contains a substantial desktop layout layer and a broad set of chat/camera features. The next VibeSnap 2.0 features must be added through the existing data/encryption contracts rather than by replacing the app or inventing a new message schema.

No new database feature is safe to implement from the repository snapshot alone. The checked-in Supabase migration history is incomplete as a full schema/RLS inventory: the repository currently exposes one migration file, not a complete schema snapshot or a full policy export. Therefore this audit records confirmed code contracts and explicitly marks database facts that still need authoritative confirmation from the Supabase project before any migration is proposed.

## 1. Confirmed application and backend contracts

### Browser application

- `index.html` is the primary application entry point and contains the page markup, application logic, and extensive inline styling.
- `supabase-adapter.js` creates the Supabase client and provides username/password authentication helpers, profile/search operations, friend requests, friendships, and presence updates.
- `supabase-compat.js` maps the existing Firebase-like application interface onto Supabase tables and Storage. Keep this adapter in place until a dedicated compatibility migration is reviewed.
- The adapter uses the existing Supabase project URL and a browser publishable key. No service-role key is present in the inspected adapter file. Do not replace or copy credentials into new files.
- Username login is mapped to an internal synthetic email suffix (`@users.vibesnap.invalid`). This is an implementation detail of the existing auth contract; do not change it as part of visual or messaging work.

### Tables and records referenced by application code

The current client code references these Supabase resources:

| Resource | Confirmed use in code | Compatibility note |
|---|---|---|
| `profiles` | Username, display name, avatar storage path, presence, public encryption key | Keep username discovery only; do not add bio or friends count |
| `profile_private` | Per-user friend nicknames | Private data must remain owner-scoped |
| `friend_requests` | Sender, receiver, status, timestamps | Preserve existing pending/accepted/declined rows |
| `friendships` | Canonically ordered user pair and creation time | Do not recreate or overwrite existing friendships |
| `conversations` | Conversation identity and creator | Membership must be checked independently |
| `conversation_members` | User membership and read timestamp | All access must be membership-scoped |
| `messages` | Encrypted message envelope and media/reply metadata | Existing rows and old crypto versions must remain readable |
| `user_blocks` | Blocker/blocked relationship | Preserve current block behaviour |
| Storage bucket `vibesnap-media` | Avatar and message media objects | Keep private storage and short-lived signed URLs |

This table is based on client references, not a complete database schema export. Column types, constraints, triggers, grants, indexes, bucket policies, and every RLS policy still require authoritative Supabase-side review.

### Message and encryption compatibility

- The compatibility adapter maps message records to `encrypted_text`, `iv`, and `crypto_version`, along with sender/receiver, message type, media path, timestamps, `reply_to_id`, and `edited_at`.
- The mapped message object deliberately exposes an empty `text` field and retains the encrypted payload separately. New features must not place decrypted message text into Postgres metadata, logs, analytics, or search indexes.
- The existing message update path writes the encrypted payload fields back to the original message row. It does not preserve a separate encrypted edit-history record. A future edit-history feature therefore needs a separately reviewed additive design and cannot be implemented by silently changing the existing update path.
- Existing public encryption keys are read from profile data. The inspected client includes an encrypted backup/restore path that verifies a restored private key against the account's existing public key before storing it locally. Do not alter, rotate, regenerate, or overwrite any key material.
- No complete cryptographic protocol specification or exhaustive old-message compatibility test suite was found in the reviewed repository snapshot. Before new message types or device enrolment, document the current encryption/decryption functions and supported crypto versions from the full source.

### Media handling

- Media rows can store a `storage_path`; the adapter obtains signed URLs from the private `vibesnap-media` bucket and caches them in memory for less than the one-hour signed URL lifetime.
- The adapter avoids writing a storage path as a permanent `media_url` when uploading through its compatibility path.
- Keep permanent public URLs out of new message records. Review avatar and media bucket policies and object ownership before changing Storage behaviour.
- Media encryption guarantees are not established by this audit; do not describe media as end-to-end encrypted unless that is separately verified.

## 2. Existing feature coverage and roadmap gaps

| Roadmap capability | Current evidence | Status from this audit |
|---|---|---|
| Futuristic responsive shell | Existing desktop sidebar/wide layout CSS at desktop breakpoints; tablet-specific layout rules; mobile camera/page styles | Partially present; needs visual and accessibility review before extending |
| Conversation threads/branches | Existing reply metadata via `reply_to_id` | Reply linkage exists; true threaded/branched conversation view not confirmed |
| Encrypted edit history | Existing `edited_at` and in-place encrypted message update | No separate edit-history model confirmed |
| Bookmarks | Existing local pinned-message shortcuts stored in browser localStorage | Device-local pinning only; not a synced bookmark/folder system |
| Duo Space | No implementation confirmed in inspected files | Not started |
| Voice Studio | Existing voice-message recording/playback and a proposed playback-speed enhancement in PR #7 | Basic voice support exists; full Studio controls not confirmed |
| Privacy-conscious search | Username/profile discovery exists; encrypted message search is not confirmed | Metadata/client-side-only approach still needed |
| Translation | No implementation confirmed | Not started |
| Shared memories | No safe, reviewed shared-memory implementation confirmed | Not started |
| Secure multi-device continuity | Existing encrypted key backup/restore code is visible | Requires protocol/key-version audit; no new device enrolment confirmed |

## 3. Migration and RLS review findings

The repository's `supabase/migrations` tree contains one migration at the audited base:

- `20261111000000_fix_conversation_member_rls.sql`

That migration adds a `SECURITY DEFINER` helper, `private.is_conversation_creator(text)`, with an empty search path and fully qualified table references, then replaces the conversation-member insert policy. The policy permits the conversation creator to add themself or a user with whom they have a friendship row.

This is a targeted fix for a first-member insert/RLS circular dependency. It is not a complete RLS inventory. Before any new table, column, Realtime subscription, or Storage path is added, obtain and review the full live schema and policy definitions, including:
- SELECT/INSERT/UPDATE/DELETE policies on every referenced table;
- function owner and execute grants for security-definer functions;
- conversation membership enforcement for message and Realtime reads;
- friendship checks and protection against adding arbitrary non-friends;
- Storage bucket privacy, object path ownership, and signed-URL behaviour;
- indexes/constraints and migration rollback implications.

No production migration was applied during this audit.

## 4. Open pull-request review

### PR #7 — Personalization features

PR #7 remains open and unmerged. Its current branch contains:
- local chat wallpaper presets;
- voice playback speed selectors;
- friendship-since labels;
- profile frame choices;
- animated background preferences;
- a narrow read-only `window.VibeSnapBridge` added to the main module so a separate feature script can access selected app state.

Safety improvements already made to the PR include removing the plaintext local Memory Collection and third-party QR generation from this first increment. However, PR #7 is not runtime-verified and should not be merged yet.

Review items still open:
- Confirm the profile editor selector `.vsProfileEditor` exists in the current page markup; if absent, the profile-frame control will not be mounted.
- Confirm the settings panel insertion point and lifecycle behaviour on navigation/auth changes.
- Confirm wallpaper styling is applied after every conversation switch and does not leak the prior friend's theme.
- Confirm the dynamic background preference does not interfere with page surfaces, camera preview, or login/auth loading.
- Check all new localStorage access for quota/security exceptions and account-switch behaviour.
- Validate reduced-motion behaviour for every animated surface, not only the main background.
- Check whether the module's MutationObservers are attached to the intended persistent containers and do not repeatedly perform expensive work.

PR #7 changes no database schema and should remain separate from database-backed feature work.

### PR #8 — VibeSnap 2.0 roadmap

PR #8 remains open and unmerged. It is documentation-only and defines the staged workstreams and non-negotiable preservation rules. This audit is the first implementation companion to Phase 0.

## 5. Recommended implementation order

1. Complete the missing Supabase schema/RLS/Storage inventory from the authoritative project, without changing it.
2. Finish a static review of PR #7's DOM hooks and local preference lifecycle; do not merge until its selectors and account-switch behaviour are confirmed.
3. Start Phase 1 with a separate visual-system stylesheet/tokens and narrowly scoped desktop/tablet improvements. Keep mobile styles and camera flow unchanged; include keyboard focus, contrast, and reduced-motion rules.
4. Before Phase 2, document the existing encryption/decryption envelope and old-message versions. Design threads, encrypted edit history, and bookmarks as additive, conversation-scoped records only after RLS and rollback review.
5. Defer Duo Space, translation, shared memories, and device enrolment until their access-control and privacy models are documented.

## 6. Explicit non-actions and verification limits

- No Supabase accounts, profiles, friendships, friend requests, conversations, messages, media objects, preferences, or encryption keys were changed.
- No production SQL, migrations, or Storage policies were applied.
- `vibesnap-backup.html` was not edited.
- No PR was merged and no deployment was performed.
- No real-device or real-account testing was performed, consistent with the agreed testing window after December 2026.
- This was a repository/code review only. The live Supabase schema, RLS policies, bucket policies, and database contents were not queried or verified.
