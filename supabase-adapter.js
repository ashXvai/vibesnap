/*
 * VibeSnap Supabase adapter
 * Browser-safe publishable key only. Never put a service_role/secret key here.
 * This adapter is intentionally staged alongside Firebase until all app features
 * have been migrated and tested; do not switch the live auth listener yet.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://uhrzntqoqofneiomzwga.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_tjjAhM1pEKf7HoVIrNW1Dw_DEHURqYi";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: "vibesnap-supabase-auth"
  },
  realtime: { params: { eventsPerSecond: 10 } }
});

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const EMAIL_SUFFIX = "@users.vibesnap.invalid";

function normalizeUsername(value) {
  const username = String(value || "").trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    throw new Error("Username must be 3–20 characters and use only lowercase letters, numbers, or underscores.");
  }
  return username;
}

function internalLoginEmail(username) {
  return normalizeUsername(username) + EMAIL_SUFFIX;
}

function unwrap(result) {
  if (result.error) throw result.error;
  return result.data;
}

export async function signUpWithUsername(usernameValue, password) {
  const username = normalizeUsername(usernameValue);
  if (typeof password !== "string" || password.length < 6) {
    throw new Error("Choose a password with at least 6 characters.");
  }
  const data = unwrap(await supabase.auth.signUp({
    email: internalLoginEmail(username),
    password,
    options: { data: { username } }
  }));
  if (!data.user) throw new Error("Supabase did not create the account.");
  // The database trigger creates the profile from auth metadata. Do not store
  // passwords or synthetic email addresses in the public profiles table.
  return data;
}

export async function signInWithUsername(usernameValue, password) {
  const username = normalizeUsername(usernameValue);
  if (!password) throw new Error("Enter your password.");
  return unwrap(await supabase.auth.signInWithPassword({
    email: internalLoginEmail(username),
    password
  }));
}

export async function signOut() {
  return unwrap(await supabase.auth.signOut());
}

export async function getMyProfile() {
  const { data: { user } } = unwrap(await supabase.auth.getUser());
  if (!user) return null;
  const result = await supabase.from("profiles")
    .select("user_id,username,display_name,avatar_url,last_seen_at,created_at")
    .eq("user_id", user.id)
    .maybeSingle();
  return unwrap(result);
}

export async function searchProfiles(usernameQuery, limit = 25) {
  const query = String(usernameQuery || "").trim().toLowerCase();
  if (query.length < 2) return [];
  const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 50));
  const { data: { user } } = unwrap(await supabase.auth.getUser());
  if (!user) throw new Error("Sign in to find people.");
  const result = await supabase.from("profiles")
    .select("user_id,username,display_name,avatar_url,last_seen_at")
    .ilike("username", query.replace(/[\\%_]/g, "\\$&") + "%")
    .neq("user_id", user.id)
    .order("username", { ascending: true })
    .limit(safeLimit);
  return unwrap(result) || [];
}

export async function updateMyPresence(isOnline = true) {
  const { data: { user } } = unwrap(await supabase.auth.getUser());
  if (!user) return;
  const result = await supabase.from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("user_id", user.id);
  unwrap(result);
  return { isOnline, last_seen_at: new Date().toISOString() };
}

export async function sendFriendRequest(receiverId) {
  const { data: { user } } = unwrap(await supabase.auth.getUser());
  if (!user) throw new Error("Sign in to send a friend request.");
  if (!receiverId || receiverId === user.id) throw new Error("Choose another VibeSnap user.");
  const result = await supabase.from("friend_requests").insert({
    sender_id: user.id,
    receiver_id: receiverId,
    status: "pending"
  }).select().single();
  return unwrap(result);
}

export async function listFriendRequests() {
  const { data: { user } } = unwrap(await supabase.auth.getUser());
  if (!user) return { incoming: [], outgoing: [] };
  const result = await supabase.from("friend_requests")
    .select("id,sender_id,receiver_id,status,created_at,updated_at")
    .or("sender_id.eq." + user.id + ",receiver_id.eq." + user.id)
    .order("created_at", { ascending: false });
  const rows = unwrap(result) || [];
  return {
    incoming: rows.filter(row => row.receiver_id === user.id && row.status === "pending"),
    outgoing: rows.filter(row => row.sender_id === user.id && row.status === "pending")
  };
}

export async function decideFriendRequest(requestId, decision) {
  if (!["accepted", "declined"].includes(decision)) {
    throw new Error("Unsupported friend-request decision.");
  }
  const { data: { user } } = unwrap(await supabase.auth.getUser());
  if (!user) throw new Error("Sign in first.");
  const updated = unwrap(await supabase.from("friend_requests")
    .update({ status: decision, updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("receiver_id", user.id)
    .eq("status", "pending")
    .select("id,sender_id,receiver_id,status")
    .single());

  if (decision === "accepted") {
    const [userOne, userTwo] = [updated.sender_id, updated.receiver_id].sort();
    unwrap(await supabase.from("friendships").insert({ user_one: userOne, user_two: userTwo }));
  }
  return updated;
}

export async function listFriendships() {
  const { data: { user } } = unwrap(await supabase.auth.getUser());
  if (!user) return [];
  const result = await supabase.from("friendships")
    .select("id,user_one,user_two,created_at")
    .or("user_one.eq." + user.id + ",user_two.eq." + user.id)
    .order("created_at", { ascending: false });
  return unwrap(result) || [];
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

if (typeof window !== "undefined") {
  window.VibeSnapSupabase = Object.freeze({
    client: supabase,
    signUpWithUsername,
    signInWithUsername,
    signOut,
    getMyProfile,
    searchProfiles,
    updateMyPresence,
    sendFriendRequest,
    listFriendRequests,
    decideFriendRequest,
    listFriendships,
    onAuthStateChange
  });
}
