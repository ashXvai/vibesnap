-- Record the Supabase privilege hardening applied to the project.
-- Keep profile discovery limited to authenticated users and only the fields
-- required by VibeSnap. Private friend nicknames remain in profile_private.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

grant select (
  user_id,
  username,
  display_name,
  avatar_url,
  last_seen_at,
  is_online,
  encryption_public_key,
  created_at,
  updated_at
) on table public.profiles to authenticated;
