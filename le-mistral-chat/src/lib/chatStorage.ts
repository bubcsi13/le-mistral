import type { PostgrestError } from "@supabase/supabase-js";
import type { Message } from "@/types/chat";
import { supabase } from "@/lib/supabase";

export type ChatSession = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string | null;
};

const BASE_SELECT = "id, title, created_at, updated_at";
const SCHEMA_HINT =
  "Supabase tables missing. Run the SQL in supabase/schema.sql to create chat_sessions and chat_messages.";

function throwWithSchemaHint(error?: PostgrestError | null) {
  if (!error) return;
  if (error.code === "42P01") {
    const friendly = new Error(SCHEMA_HINT) as Error & { cause?: unknown };
    friendly.cause = error;
    throw friendly;
  }
  throw error;
}

export async function fetchSessions(userId: string) {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select(BASE_SELECT)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throwWithSchemaHint(error);
  return (data ?? []) as ChatSession[];
}

export async function createSession(userId: string, title = "New chat") {
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ user_id: userId, title })
    .select(BASE_SELECT)
    .single();

  if (error) throwWithSchemaHint(error);
  return data as ChatSession;
}

export async function renameSession(sessionId: string, title: string, _userId?: string | null) {
  const trimmed = title.trim();
  if (!trimmed) return;

  const { data, error } = await supabase
    .from("chat_sessions")
    .update({
      title: trimmed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select("id, title")
    .maybeSingle();

  if (error) {
    console.error("[renameSession] Supabase error:", error);
    throw error;
  }

  console.log("[renameSession] updated session title:", data);
}

export async function fetchMessages(sessionId: string) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at, model_used")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throwWithSchemaHint(error);
  return (data ?? []).map(
    (m) =>
      ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.created_at),
        modelUsed: m.model_used ?? undefined,
      }) satisfies Message
  );
}

export async function persistMessage(sessionId: string, message: Message) {
  const { error } = await supabase
    .from("chat_messages")
    .upsert(
      {
        id: message.id,
        session_id: sessionId,
        role: message.role,
        content: message.content,
        model_used: message.modelUsed ?? null,
        created_at: message.timestamp.toISOString(),
      },
      { onConflict: "id" }
    );
  if (error) throwWithSchemaHint(error);
  const { error: updateError } = await supabase
    .from("chat_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (updateError) throwWithSchemaHint(updateError);
}

export async function deleteSession(sessionId: string) {
  const { error } = await supabase.from("chat_sessions").delete().eq("id", sessionId);
  if (error) throwWithSchemaHint(error);
}

export async function deleteAllSessions(userId: string) {
  const { error } = await supabase.from("chat_sessions").delete().eq("user_id", userId);
  if (error) throwWithSchemaHint(error);
}
