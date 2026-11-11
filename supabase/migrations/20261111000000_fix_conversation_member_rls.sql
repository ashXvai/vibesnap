-- Fix the conversation-member insert policy.
-- The old policy queried public.conversations directly, but its SELECT policy
-- hides a conversation until the caller is already a member. That creates a
-- circular RLS dependency during first-time conversation setup.
create or replace function private.is_conversation_creator(p_conversation_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and c.created_by = (select auth.uid())::text
  );
$$;

revoke all on function private.is_conversation_creator(text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_conversation_creator(text) to authenticated;

drop policy if exists conversation_members_add_creator_or_self
on public.conversation_members;

create policy conversation_members_add_creator_or_self
on public.conversation_members
for insert
to authenticated
with check (
  private.is_conversation_creator(conversation_id)
  and (
    user_id = (select auth.uid())::text
    or exists (
      select 1
      from public.friendships f
      where
        (f.user_one = (select auth.uid())
          and f.user_two::text = conversation_members.user_id)
        or
        (f.user_two = (select auth.uid())
          and f.user_one::text = conversation_members.user_id)
    )
  )
);
