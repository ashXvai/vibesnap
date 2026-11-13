-- Grant only the write operations used by the VibeSnap client.
-- RLS policies continue to restrict every row to its authenticated owner,
-- participant, or sender/receiver as appropriate.
grant insert (
  user_id, username, display_name, avatar_url, last_seen_at,
  is_online, encryption_public_key, created_at, updated_at
) on table public.profiles to authenticated;

grant update (
  username, display_name, avatar_url, last_seen_at,
  is_online, encryption_public_key, updated_at
) on table public.profiles to authenticated;

grant update (status, updated_at)
  on table public.friend_requests to authenticated;

grant update (encrypted_text, iv, crypto_version, edited_at, reply_to_id)
  on table public.messages to authenticated;
