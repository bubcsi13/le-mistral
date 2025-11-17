import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type CustomSystemPrompt = {
  id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string | null;
};

const TABLE = "system_prompts";

function withSchemaHint(error?: PostgrestError | null) {
  if (!error) return;
  if (error.code === "42P01") {
    const friendly = new Error(
      "Supabase system_prompts table missing. Update supabase/schema.sql and deploy migrations."
    ) as Error & { cause?: unknown };
    friendly.cause = error;
    throw friendly;
  }
  throw error;
}

export async function fetchSystemPrompts(userId: string) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, name, content, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) withSchemaHint(error);
  return (data ?? []) as CustomSystemPrompt[];
}

export async function createSystemPrompt(userId: string, name: string, content: string) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ user_id: userId, name: name.trim(), content: content.trim() })
    .select("id, name, content, created_at, updated_at")
    .single();
  if (error) withSchemaHint(error);
  return data as CustomSystemPrompt;
}

export async function deleteSystemPrompt(promptId: string) {
  const { error } = await supabase.from(TABLE).delete().eq("id", promptId);
  if (error) withSchemaHint(error);
}
