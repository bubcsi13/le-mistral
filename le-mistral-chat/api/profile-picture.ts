import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";

const DEFAULT_BUCKET = "profile-pictures";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    file,
    filename,
    contentType = "image/jpeg",
    userId,
    previousPath,
    bucket = DEFAULT_BUCKET,
  } = req.body ?? {};

  if (!file || !filename || !userId) {
    return res.status(400).json({ error: "Missing required payload values." });
  }

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET;

  if (!supabaseUrl || !serviceKey) {
    console.error("[profile-picture] Missing Supabase credentials", {
      hasUrl: Boolean(supabaseUrl),
      hasServiceKey: Boolean(serviceKey),
      envKeys: Object.keys(process.env ?? {}).filter((key) =>
        key.toLowerCase().includes("supabase"),
      ),
    });
    return res
      .status(500)
      .json({ error: "Server missing Supabase credentials. Set SUPABASE_SERVICE_ROLE_KEY." });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let buffer: Buffer;
  try {
    buffer = Buffer.from(file, "base64");
  } catch {
    return res.status(400).json({ error: "Invalid file encoding." });
  }

  const extension = filename.split(".").pop()?.toLowerCase() || "jpg";
  const uniqueId =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : Date.now().toString();
  const storagePath = `${userId}/${uniqueId}.${extension}`;

  const { error: uploadError } = await adminClient.storage.from(bucket).upload(storagePath, buffer, {
    cacheControl: "3600",
    upsert: true,
    contentType,
  });

  if (uploadError) {
    return res.status(uploadError.statusCode ?? 400).json({ error: uploadError.message });
  }

  if (previousPath && previousPath !== storagePath) {
    await adminClient.storage
      .from(bucket)
      .remove([previousPath])
      .catch((error) => console.warn("[profile] Failed to remove previous avatar", error));
  }

  const { data: urlData } = adminClient.storage.from(bucket).getPublicUrl(storagePath);
  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) {
    return res.status(500).json({ error: "Failed to load public URL from Supabase." });
  }

  const { data: existingUser, error: userError } = await adminClient.auth.admin.getUserById(userId);
  if (userError) {
    return res.status(userError.status ?? 400).json({ error: userError.message });
  }

  const currentMetadata = existingUser?.user?.user_metadata ?? {};
  const nextMetadata = {
    ...currentMetadata,
    avatar_url: publicUrl,
    avatar_path: storagePath,
    avatar_updated_at: new Date().toISOString(),
  };

  const { error: metadataError } = await adminClient.auth.admin.updateUserById(userId, {
    user_metadata: nextMetadata,
  });

  if (metadataError) {
    return res.status(metadataError.status ?? 400).json({ error: metadataError.message });
  }

  return res.status(200).json({ publicUrl, storagePath });
}
