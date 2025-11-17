export type ProfilePictureUploadResult = {
  publicUrl: string;
  storagePath: string;
};

const PROFILE_BUCKET = "profile-pictures";

async function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unsupported file format."));
        return;
      }
      const base64 = result.includes(",") ? result.split(",").pop() || "" : result;
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a new avatar by posting to our serverless endpoint which uses the service role key.
 * This avoids exposing elevated Supabase credentials in the browser and bypasses storage RLS.
 */
export async function uploadProfilePicture(
  file: File,
  userId: string,
  previousPath?: string | null
): Promise<ProfilePictureUploadResult> {
  if (!file) throw new Error("No file selected.");
  if (!userId) throw new Error("You must be signed in to change your profile picture.");

  const base64 = await fileToBase64(file);

  const response = await fetch("/api/profile-picture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file: base64,
      filename: file.name,
      contentType: file.type || "image/jpeg",
      userId,
      previousPath,
      bucket: PROFILE_BUCKET,
    }),
  });

  const raw = await response.text();
  let payload: ProfilePictureUploadResult & { error?: string } = {} as ProfilePictureUploadResult;
  try {
    payload = raw ? JSON.parse(raw) : ({} as ProfilePictureUploadResult);
  } catch {
    // Ignore JSON parse errors; will handle below.
  }

  if (!response.ok) {
    throw new Error(payload?.error || `Upload failed with status ${response.status}`);
  }

  if (!payload?.publicUrl || !payload?.storagePath) {
    throw new Error("Server response missing profile picture metadata.");
  }

  return payload;
}
