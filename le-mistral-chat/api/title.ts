import type { VercelRequest, VercelResponse } from "@vercel/node";

const CHAT_URL = "https://api.mistral.ai/v1/chat/completions";
const MAX_TITLE_WORDS = 3;

function parseBody(req: VercelRequest) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body as Record<string, unknown>;
}

function toTitleCase(text: string) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function sanitizeTitle(text: string) {
  const normalized = text.replace(/\s+/g, " ").replace(/["]+/g, "").trim();
  if (!normalized) return "";
  const limited = normalized
    .split(" ")
    .filter(Boolean)
    .slice(0, MAX_TITLE_WORDS)
    .join(" ");
  if (!limited) return "";
  return toTitleCase(limited);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Missing MISTRAL_API_KEY" });
    return;
  }

  const body = parseBody(req);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const instructions =
    "You are an assistant that names chat sessions. Respond with a concise, Title Case summary of the user's first question. " +
    "Use at most 3 words (fewer is fine). Do not add punctuation besides spaces and never wrap the title in quotes.";

  const payload = {
    model: "mistral-small-latest",
    stream: false,
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: prompt.slice(0, 600) },
    ],
    temperature: 0.2,
    top_p: 0.5,
    max_tokens: 32,
  };

  try {
    const upstream = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      const error = text || `Failed to generate title (${upstream.status})`;
      res.status(upstream.status).json({ error });
      return;
    }

    type ChatChoice = {
      message?: { content?: string };
      delta?: { content?: string };
    };
    type ChatResponse = {
      choices?: ChatChoice[];
    };
    const data = (await upstream.json()) as ChatResponse;
    const raw =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.delta?.content ??
      "";
    const title = sanitizeTitle(typeof raw === "string" ? raw : "");

    if (!title) {
      res.status(502).json({ error: "Model returned an empty title" });
      return;
    }

    res.status(200).json({ title });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error while generating title",
    });
  }
}
