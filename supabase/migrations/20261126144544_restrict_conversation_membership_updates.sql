-- Keep membership identity immutable to authenticated clients.
-- The app only needs to update read receipts and typing presence.
REVOKE UPDATE ON TABLE public.conversation_members FROM authenticated;
GRANT UPDATE (last_read_at, typing_until) ON TABLE public.conversation_members TO authenticated;

-- No client-side feature updates conversation metadata directly.
REVOKE UPDATE ON TABLE public.conversations FROM authenticated;
