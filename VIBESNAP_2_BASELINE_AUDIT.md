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
- No production SQL, migrations, or Storage policies were applied; all live database checks below were read-only catalog/metadata queries.
- No user message bodies, profile row values, friend lists, media contents, or key material were queried.
- `vibesnap-backup.html` was not edited.
- No PR was merged and no deployment was performed.
- No real-device or real-account testing was performed, consistent with the agreed testing window after December 2026.
- Static source inspection and read-only Supabase metadata checks were performed. No browser runtime, end-to-end, or automated application test suite was run.


## 7. Live Supabase inventory — read-only snapshot (2026-11-12)

The connected project `uhrzntqoqofneiomzwga` was inspected using read-only project metadata, catalog queries, and Supabase advisors. The database is active on PostgreSQL 17. No application records or message/profile contents were selected.

### Live application tables and RLS

All 10 application tables in the `public` schema have RLS enabled:

| Table | Key purpose/columns observed | RLS |
|---|---|---|
| `profiles` | user_id, username, display_name, avatar_url, last_seen_at, is_online, encryption_public_key; legacy `friend_nicknames` column remains | Enabled |
| `profile_private` | user_id, friend_nicknames, updated_at | Enabled |
| `friend_requests` | sender_id, receiver_id, status, timestamps | Enabled |
| `friendships` | user_one, user_two, created_at | Enabled |
| `conversations` | id, conversation_type, created_by, timestamps | Enabled |
| `conversation_members` | conversation_id, user_id, joined_at, last_read_at, typing_until | Enabled |
| `messages` | encrypted_text, iv, crypto_version, media_url, storage_path, media metadata, reply_to_id, edited_at | Enabled |
| `message_reactions` | message_id, user_id, reaction, created_at | Enabled |
| `user_blocks` | blocker_id, blocked_id, created_at | Enabled |
| `user_privacy_settings` | friend_request_policy, show_online_status | Enabled |

The live policy inventory reports 34 policies across these public application tables: conversation membership (4), conversations (3), friend requests (4), friendships (3), message reactions (3), messages (4), private profiles (4), profiles (3), blocks (3), and privacy settings (3).

### Important profile privacy detail

The live `profiles` table still contains a legacy `friend_nicknames` column. The authenticated and anonymous roles do **not** have SELECT privilege on that column. Authenticated profile discovery is governed by `profiles_discover_signed_in`, but column-level grants limit readable profile fields. The separate `profile_private` table has owner-scoped SELECT/INSERT/UPDATE/DELETE policies. The current adapter reads nicknames from `profile_private`, not from the legacy public-profile column.

Do not remove the legacy column or change grants as part of this roadmap work. Its eventual cleanup requires a separately reviewed migration and confirmation that no old client depends on it.

### Conversation and message RLS

The live policies confirm these controls:
- Conversation rows are readable only when `private.is_conversation_member(conversations.id)` returns true.
- Membership reads are limited to the current user and members of conversations they belong to.
- Membership insertion requires the conversation-creator helper and allows the creator to add themself or a friend.
- Message SELECT requires conversation membership and also checks block relationships.
- Message INSERT requires the sender to be a conversation member; a non-null receiver must also be a member; blocked relationships are rejected.
- Message UPDATE is restricted to the sender and a conversation member.
- Message DELETE is restricted to the sender.

These are metadata-level policy inspections, not penetration tests. Realtime publication membership and all edge cases still need isolated tests after December 2026.

### Storage

The live `vibesnap-media` bucket is private (`public = false`), has a 50 MiB file-size limit, and allows the image/video/audio MIME types listed by the project. RLS is enabled on `storage.objects`; seven policies are present:
- Avatar reads are allowed to signed-in users.
- Avatar upload/update/delete are scoped to the user's `avatars/{uid}/...` path.
- Conversation media upload/read are scoped through `conversation_members`.
- Media deletion is scoped to the object's owner.

The adapter's signed-URL refresh path remains compatible with this private bucket. The actual object path conventions and every upload/download lifecycle were not exercised.

### Security-definer functions

The live database has several `SECURITY DEFINER` functions in the non-exposed `private` schema, including `is_conversation_member`, `is_conversation_creator`, `is_blocked_between`, and friend-request/privacy helpers. Their configured search paths are empty, and the `private` schema is not usable by `anon`.

One trigger function, `private.create_profile_private_row()`, has an EXECUTE grant visible to `anon`, but `anon` has no USAGE on the `private` schema; the function is attached to the profile insert trigger. This is not currently callable through the exposed API based on the observed schema privileges, but the grant is a least-privilege cleanup candidate for a separately reviewed security change. No grant was changed.

### Live migration history — critical repository drift

Supabase reports 23 applied migrations:

| Version | Migration |
|---|---|
| `20261106045505` | `create_vibesnap_messaging_foundation` |
| `20261106045516` | `index_vibesnap_message_sender_membership` |
| `20261111063944` | `vibesnap_profiles_friendships_and_rls` |
| `20261111063955` | `vibesnap_fix_membership_rls_and_request_permissions` |
| `20261111065148` | `fix_message_insert_membership_policy` |
| `20261111065209` | `vibesnap_auth_profile_trigger` |
| `20261111071342` | `vibesnap_media_presence_and_realtime` |
| `20261111071541` | `vibesnap_profile_online_state` |
| `20261111071957` | `consolidate_friend_request_update_policy` |
| `20261111072003` | `optimize_friend_request_rls_policy` |
| `20261112100922` | `isolate_friend_nicknames_and_add_private_profile` |
| `20261112101917` | `add_chat_interaction_support` |
| `20261112101926` | `publish_chat_member_and_reaction_updates` |
| `20261112102217` | `index_message_reply_and_reaction_foreign_keys` |
| `20261112102413` | `allow_private_profile_avatar_storage` |
| `20261112102606` | `allow_participants_to_remove_friend_links` |
| `20261112102634` | `add_user_blocking_and_enforce_chat_privacy` |
| `20261112102728` | `harden_block_visibility_and_rls_checks` |
| `20261112102828` | `allow_custom_emoji_message_reactions` |
| `20261112104231` | `enable_voice_messages_and_audio_storage` |
| `20261112105522` | `friend_request_privacy_and_spam_controls` |
| `20261112105538` | `add_online_status_privacy_preference` |
| `20261112111444` | `add_private_mutual_friend_counts` |

The GitHub repository's `supabase/migrations` folder currently contains only `20261111000000_fix_conversation_member_rls.sql`. The live project migration history and tracked repository migration history therefore do not match. The 22 missing migration SQL files cannot be reconstructed safely from migration names alone.

**Blocker before future schema work:** reconcile the migration history with the repository using a verified schema/migration pull or an owner-reviewed backup of the missing SQL. Do not apply a new migration, reset migration history, or attempt to recreate the missing SQL from names.

### Supabase advisor findings

- **Security warning:** leaked-password protection is disabled in Supabase Auth. The advisor recommends enabling breached-password checks. This setting was not changed.
- **Performance info:** three indexes are currently reported as unused: `idx_messages_reply_to_id`, `idx_message_reactions_user_id`, and `idx_user_blocks_blocked_id`. Do not drop them based on this snapshot; low traffic or newly added indexes can appear unused.

## 8. PR #7 static compatibility review

The current `main` markup confirms the following PR #7 insertion points exist:
- `#profilePage .vsProfileEditor`
- `#settingsPage .settingsPanel`
- `#chatConversation .conversationHeader`
- `#conversationCamera`
- `#profileAvatar`

The Supabase compatibility adapter maps friendships to `{ members: [user_one, user_two], createdAt: created_at }`, matching the shape expected by the friendship-since label. The extra script is loaded as a module, and the per-user preference key is namespaced by the current user ID. Local-storage reads/writes catch parse and quota errors. The dynamic background animation has a `prefers-reduced-motion` override.

One unresolved issue remains: the extras script applies dynamic background preferences during its initial refresh and when settings DOM changes, but it does not subscribe to auth/account changes. If an account is switched without a full page reload, the prior account's dynamic background can remain applied until another refresh occurs. This is a cosmetic preference-isolation issue, not a data/key leak, but should be fixed before PR #7 is merged. No runtime test was performed.

## 9. Updated Phase 0 exit status and next steps

The written compatibility map and live read-only RLS/Storage inventory are now recorded. Phase 0 is **audited, with two follow-up blockers**:
1. Reconcile the 23 live migration records with the single tracked migration file before any database feature work.
2. Review the Supabase leaked-password-protection warning and decide whether to enable the setting.

PR #7 has had a static selector/data-shape review, but its account-switch preference refresh issue remains. Keep it unmerged until fixed and reviewed.

After these items, begin Phase 1 with an isolated desktop/tablet visual-system increment. Do not change the mobile camera flow or existing Supabase data/encryption.
