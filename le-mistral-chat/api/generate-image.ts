// api/generate-image.ts
// -----------------------------------------------------------------------------
// PURPOSE
//   Generate images via a Mistral Agent, then download the file(s) and return
//   base64 + the *correct* image MIME. We sniff bytes to fix cases where the API
//   responds with `application/octet-stream`, which otherwise breaks <img src="data:...">.
//
// WHAT'S IMPORTANT
//   - Robust MIME sniffing (normalizeMime/sniffImageMime) for JPEG/PNG/GIF/WEBP/BMP/SVG.
//   - Returns { images: [{ fileId, mime, base64 }] } with a real image/* MIME.
// -----------------------------------------------------------------------------

import type { VercelRequest, VercelResponse } from "@vercel/node";

const AGENTS_URL = "https://api.mistral.ai/v1/agents";
const CONVERSATIONS_URL = "https://api.mistral.ai/v1/conversations";
const FILE_CONTENT_URL = (id: string) => `https://api.mistral.ai/v1/files/${id}/content`;

let IMAGE_AGENT_ID: string | null = process.env.MISTRAL_IMAGE_AGENT_ID || null;

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function fail(res: VercelResponse, code: number, msg: string) {
  res.status(code).json({ error: msg });
}

/** --- MIME sniffing helpers ------------------------------------------------ */
function sniffImageMime(buf: Buffer): string | "" {
  if (buf.length >= 12) {
    const b = buf;
    // JPEG FF D8 FF
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
    // PNG 89 50 4E 47
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
    // GIF 47 49 46 38
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
    // WEBP "RIFF"...."WEBP"
    if (
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
    ) return "image/webp";
    // BMP "BM"
    if (b[0] === 0x42 && b[1] === 0x4d) return "image/bmp";
  }
  // SVG (text/xml)
  const head = buf.slice(0, 256).toString("utf8").trimStart();
  if (head.startsWith("<svg")) return "image/svg+xml";
  return "";
}

function normalizeMime(headerMime: string | null, buf: Buffer): string {
  const header = (headerMime || "").split(";")[0].trim().toLowerCase();
  if (header.startsWith("image/") && header !== "image/*") return header;
  const sniffed = sniffImageMime(buf);
  return sniffed || (header && header !== "application/octet-stream" ? header : "image/png");
}
/** ------------------------------------------------------------------------- */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return fail(res, 405, "Method Not Allowed");

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return fail(res, 500, "Missing MISTRAL_API_KEY");

  // Parse body
  let prompt = "";
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body ?? {});
    prompt = String(body?.prompt || "").trim();
    if (!prompt) return fail(res, 400, "Missing 'prompt'");
  } catch {
    return fail(res, 400, "Invalid JSON body");
  }

  try {
    const agentId = await ensureImageAgent(apiKey);

    // Start conversation (non-stream JSON)
    const convResp = await fetch(CONVERSATIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        agent_id: agentId,              // snake_case per HTTP API
        inputs: `Generate an image: ${prompt}`,
      }),
    });

    const convText = await convResp.text();
    if (!convResp.ok) return fail(res, convResp.status, convText || "Conversations error");

    type ConversationChunk = { type?: string; file_id?: string; fileId?: string } | string;
    type ConversationOutput = { content?: ConversationChunk[] };
    type ConversationResponse = { outputs?: ConversationOutput[] };

    let conv: ConversationResponse;
    try {
      conv = JSON.parse(convText) as ConversationResponse;
    } catch {
      return fail(res, 502, "Invalid conversations JSON");
    }

    // Collect file chunks (tool_file / file / image)
    const outputs: ConversationOutput[] = Array.isArray(conv?.outputs) ? conv.outputs : [];
    const fileIds: string[] = [];
    for (const entry of outputs) {
      const content = Array.isArray(entry?.content) ? entry.content : [];
      for (const chunk of content) {
        if (typeof chunk === "string") continue;
        const t = String(chunk?.type || "").toLowerCase();
        const fid = chunk?.file_id || chunk?.fileId;
        if (fid && (t === "tool_file" || t === "file" || t === "image")) {
          fileIds.push(String(fid));
        }
      }
    }
    if (!fileIds.length) {
      const last = outputs[outputs.length - 1] ?? {};
      return fail(
        res,
        422,
        `No generated file IDs found in conversation outputs. Last output: ${JSON.stringify(last).slice(0, 2000)}`
      );
    }

    // Download each file and base64 it (with MIME sniffing)
    const images: Array<{ fileId: string; mime: string; base64: string }> = [];
    for (const fid of fileIds) {
      const fileResp = await fetch(FILE_CONTENT_URL(fid), {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!fileResp.ok) {
        const t = await fileResp.text().catch(() => "");
        return fail(res, fileResp.status, `File download failed for ${fid}: ${t || "unknown error"}`);
      }

      const buf = Buffer.from(await fileResp.arrayBuffer());
      const headerMime = fileResp.headers.get("Content-Type");
      const mime = normalizeMime(headerMime, buf);

      images.push({ fileId: fid, mime, base64: buf.toString("base64") });
    }

    res.status(200).json({ images });
  } catch (error) {
    return fail(res, 502, error instanceof Error ? error.message : "Image generation failed");
  }
}

async function ensureImageAgent(apiKey: string): Promise<string> {
  if (IMAGE_AGENT_ID) return IMAGE_AGENT_ID;

  const r = await fetch(AGENTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: process.env.MISTRAL_IMAGE_AGENT_MODEL || "mistral-medium-2505",
      name: "Image Generation Agent",
      description: "Agent used to generate images.",
      instructions: "Use the image generation tool when you have to create images.",
      tools: [{ type: "image_generation" }],
      completion_args: { temperature: 0.3, top_p: 0.95 },
    }),
  });

  const text = await r.text();
  if (!r.ok) throw new Error(text || "Failed to create image agent");
  const agent = JSON.parse(text) as { id?: string };
  const id = agent?.id;
  if (!id) throw new Error("Agent ID missing from creation response");
  IMAGE_AGENT_ID = id;
  return id;
}
