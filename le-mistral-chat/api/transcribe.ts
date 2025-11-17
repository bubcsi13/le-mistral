// api/transcribe.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Accepts EITHER:
 *  - JSON: { audio: "<base64>", mime_type: "audio/webm" }
 *  - (optionally in future) multipart/form-data with field "file"
 *
 * Forwards to Mistral STT and returns: { text: "..." }
 */

const MISTRAL_TRANSCRIBE_URL = "https://api.mistral.ai/v1/audio/transcriptions";
const FALLBACK_MODEL = "voxtral-mini-latest"; // fast & cheap; swap to voxtral-small/medium if you prefer

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Missing MISTRAL_API_KEY" });
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // --- Parse incoming body (we expect JSON base64 from the client composer) ---
  let audioBase64 = "";
  let mimeType = "audio/webm";

  try {
    const isJson =
      (req.headers["content-type"] || "").toLowerCase().includes("application/json");

    if (isJson) {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body ?? {});
      if (typeof body?.audio !== "string" || !body.audio.length) {
        res.status(400).json({ error: "Missing 'audio' (base64 string) in body" });
        return;
      }
      audioBase64 = body.audio;
      if (typeof body?.mime_type === "string" && body.mime_type) {
        mimeType = body.mime_type;
      }
    } else {
      // If you ever switch the client to send multipart directly, you can parse it here.
      // For now we only support JSON -> base64.
      res.status(415).json({ error: "Unsupported Media Type. Send JSON with base64 'audio'." });
      return;
    }
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  // --- Build multipart form-data to call Mistral STT endpoint ---
  try {
    const bytes = Buffer.from(audioBase64, "base64");
    const file = new Blob([bytes], { type: mimeType });

    const fd = new FormData();
    fd.append("model", FALLBACK_MODEL);
    // many STT endpoints expect the field name to be "file"
    fd.append("file", file, `audio.${mimeType.split("/")[1] || "webm"}`);
    // ask for raw text back when supported; if not, we'll extract below
    fd.append("response_format", "json");

    const upstream = await fetch(MISTRAL_TRANSCRIBE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // DO NOT set Content-Type manually — fetch/FormData will set the boundary
      },
      body: fd,
    });

    const raw = await upstream.text();
    if (!upstream.ok) {
      // Bubble up upstream error for easier debugging
      res.status(upstream.status).json({ error: raw || `Upstream error ${upstream.status}` });
      return;
    }

    // Try to parse a few common response shapes safely
    let text = "";
    try {
      type Segment = { text?: string };
      type TranscriptionResponse = {
        text?: string;
        result?: string;
        segments?: Segment[];
      };
      const data = JSON.parse(raw) as TranscriptionResponse;
      // Common shapes:
      //  { text: "..." }
      //  { segments: [{text:"..."}], text:"..." }
      //  { result: "..." }
      text =
        (typeof data?.text === "string" && data.text) ||
        (typeof data?.result === "string" && data.result) ||
        (Array.isArray(data?.segments) ? data.segments.map((segment) => segment?.text || "").join(" ") : "") ||
        "";
    } catch {
      // If it's already plain text, just use it
      text = raw.trim();
    }

    res.status(200).json({ text: (text || "").trim() });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Transcription request failed" });
  }
}
