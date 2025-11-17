// api/chat.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";

const CHAT_URL = "https://api.mistral.ai/v1/chat/completions";
const CONVERSATIONS_URL = "https://api.mistral.ai/v1/conversations";

function setSseHeaders(res: VercelResponse) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Access-Control-Allow-Origin", "*");
}

type MessageRole = "system" | "user" | "assistant";
type VisionContentItem =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: string };

type ChatMessagePayload = {
  role: MessageRole;
  content: string | VisionContentItem[];
};

type ToolPayload = Record<string, unknown>;

type Payload = {
  messages?: ChatMessagePayload[];
  model?: string;
  instructions?: string;
  completion_args?: { temperature?: number; max_tokens?: number; top_p?: number };
  tools?: ToolPayload[];
  attachments?: Array<{
    type: string;
    data: string; // base64 encoded file data
    filename: string;
    mimeType: string;
    extractedText?: string; // For text-based files
  }>;
};

type ConversationInput = { role: MessageRole; content: string };
type ChatRequestBase = {
  messages: ChatMessagePayload[];
  stream: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  tools?: ToolPayload[];
};
type ConversationRequestBase = {
  inputs: ConversationInput[];
  stream: boolean;
  instructions?: string;
  completion_args?: Payload["completion_args"];
  tools?: ToolPayload[];
};

type PdfParseFn = (buffer: Buffer) => Promise<{ text?: string }>;

function stringifyContent(content: string | VisionContentItem[]) {
  if (typeof content === "string") return content;
  return content
    .map((item) => {
      if (item.type === "text") return item.text;
      return "[image]";
    })
    .join("\n")
    .trim();
}

function mergeWithAdditionalText(
  content: string | VisionContentItem[],
  extra: string,
): string | VisionContentItem[] {
  if (!extra) return content;
  if (typeof content === "string") {
    return content + extra;
  }
  return [...content, { type: "text", text: extra }];
}

function toVisionContent(message: ChatMessagePayload, extra = ""): VisionContentItem[] {
  if (typeof message.content === "string") {
    return [{ type: "text", text: message.content + extra }];
  }
  return extra ? [...message.content, { type: "text", text: extra }] : [...message.content];
}

/** ✅ Correct aliases (and robust fallbacks) */
const FAMILY_ALIASES: Record<string, string[]> = {
  // Core
  "mistral-small-latest": ["mistral-small-latest", "mistral-small"],
  "mistral-medium-latest": ["mistral-medium-latest", "mistral-medium"],
  "mistral-large-latest": ["mistral-large-latest", "mistral-large"],

  // Codestral (code-first chat works via chat/completions)
  "codestral-latest": ["codestral-latest", "codestral"],

  // Pixtral (vision model; we still allow text-only calls)
  "pixtral-large-latest": ["pixtral-large-latest", "pixtral-large"],

  // Magistral: small / medium ONLY
  "magistral-small-latest": ["magistral-small-latest", "magistral-small"],
  "magistral-medium-latest": ["magistral-medium-latest", "magistral-medium"],
  // Defensive: if something sends "magistral-latest", try medium → small → aliases
  "magistral-latest": [
    "magistral-medium-latest",
    "magistral-small-latest",
    "magistral-medium",
    "magistral-small",
  ],

  // Devstral: small / medium ONLY
  "devstral-small-latest": ["devstral-small-latest", "devstral-small"],
  "devstral-medium-latest": ["devstral-medium-latest", "devstral-medium"],
  // Defensive: if something sends "devstral-latest", try medium → small → aliases
  "devstral-latest": [
    "devstral-medium-latest",
    "devstral-small-latest",
    "devstral-medium",
    "devstral-small",
  ],
};

/** Prefer chat/completions first for these */
const PREFER_CHAT: Set<string> = new Set([
  // Core
  "mistral-small-latest", "mistral-small",
  "mistral-medium-latest", "mistral-medium",
  "mistral-large-latest", "mistral-large",

  // Codestral
  "codestral-latest", "codestral",

  // Pixtral
  "pixtral-large-latest", "pixtral-large",

  // Magistral
  "magistral-small-latest", "magistral-small",
  "magistral-medium-latest", "magistral-medium",
  "magistral-latest",

  // Devstral
  "devstral-small-latest", "devstral-small",
  "devstral-medium-latest", "devstral-medium",
  "devstral-latest",
]);

/* --------------------------- Extraction helpers --------------------------- */

const MAX_CHARS_PER_FILE = 60_000;           // cap per file
const MAX_TOTAL_ATTACHMENT_CHARS = 180_000;  // cap across all files

function normalizeWhitespace(s: string) {
  return s
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncateForModel(s: string, filename?: string) {
  if (s.length <= MAX_CHARS_PER_FILE) return s;
  return (
    s.slice(0, MAX_CHARS_PER_FILE) +
    `\n\n[...truncated ${(s.length - MAX_CHARS_PER_FILE).toLocaleString()} chars from ${filename ?? "file"}]`
  );
}

async function extractTextFromPdf(buffer: Buffer, filename: string): Promise<string> {
  let parsedText = "";
  try {
    const pdfParseModule = await import("pdf-parse");
    const pdfParse: PdfParseFn = (pdfParseModule.default ?? pdfParseModule) as PdfParseFn;
    const data = await pdfParse(buffer);
    parsedText = normalizeWhitespace(String(data?.text ?? ""));
    if (parsedText.trim().length >= 50) {
      return parsedText;
    }
  } catch (error) {
    console.error("PDF parse failed (pdf-parse):", error);
  }

  // Fallback: try extracting text via pdfjs directly (handles some edge-case PDFs better)
  try {
    const fallback = await extractTextFromPdfWithPdfJs(buffer);
    if (fallback.trim().length >= 50) {
      return fallback;
    }
  } catch (fallbackError) {
    console.error("PDF parse failed (pdfjs fallback):", fallbackError);
  }

  if (parsedText.trim().length >= 10) {
    return parsedText;
  }

  return (
    `[${filename}] appears to have little/no embedded text or uses an unsupported encoding. ` +
    `If this is a scanned document, try uploading the pages as images so the vision model can OCR them.`
  );
}

type PdfJsTextContentItem = { str?: string };
type PdfJsTextContent = { items: PdfJsTextContentItem[] };
type PdfJsPage = {
  getTextContent(): Promise<PdfJsTextContent>;
};
type PdfJsDocument = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfJsPage>;
  cleanup?: () => Promise<void> | void;
};
type PdfJsLoadingTask = {
  promise: Promise<PdfJsDocument>;
  destroy?: () => void;
};
type PdfJsModule = {
  getDocument: (options: { data: Buffer; useWorkerFetch?: boolean }) => PdfJsLoadingTask;
  GlobalWorkerOptions?: { workerSrc?: string | null };
  disableWorker?: boolean;
};

async function extractTextFromPdfWithPdfJs(buffer: Buffer): Promise<string> {
  const imported = await import("pdfjs-dist/legacy/build/pdf.js");
  const pdfjs = (imported?.default ?? imported) as PdfJsModule;
  if (!pdfjs || typeof pdfjs.getDocument !== "function") {
    throw new Error("pdfjs getDocument is unavailable");
  }
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = undefined;
  }
  pdfjs.disableWorker = true;

  const loadingTask = pdfjs.getDocument({ data: buffer, useWorkerFetch: false });
  const pdf = await loadingTask.promise;
  const maxPages = Math.min(pdf.numPages ?? 0, 40);
  let out = "";

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item) => (typeof item?.str === "string" ? item.str : ""))
      .filter(Boolean);
    if (strings.length) {
      out += `\n\n--- Page ${pageNumber} ---\n${strings.join(" ")}`;
    }
  }

  const normalized = normalizeWhitespace(out);
  if (typeof loadingTask?.destroy === "function") {
    loadingTask.destroy();
  } else if (typeof pdf?.cleanup === "function") {
    await pdf.cleanup();
  }
  return normalized;
}

async function extractTextFromDocx(buffer: Buffer, filename: string): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return normalizeWhitespace(result?.value ?? "");
  } catch (e) {
    console.error("DOCX parse failed:", e);
    return `[${filename}] content extraction for DOCX failed.`;
  }
}

async function extractTextFromXlsx(buffer: Buffer, filename: string): Promise<string> {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buffer, { type: "buffer" });
    let out = "";
    const sheetNames: string[] = wb.SheetNames.slice(0, 10); // safety cap
    for (const name of sheetNames) {
      const ws = wb.Sheets[name];
      if (!ws) continue;
      const csv = XLSX.utils.sheet_to_csv(ws).trim();
      if (csv) {
        out += `\n\n--- Sheet: ${name} ---\n${csv}`;
      }
    }
    return out ? normalizeWhitespace(out) : `[${filename}] spreadsheet appears empty.`;
  } catch (error) {
    console.error("XLSX parse failed:", error);
    return `[${filename}] content extraction for XLS/XLSX failed.`;
  }
}

// --- Unified extractor (replaces your earlier extractTextFromFile) ----------
async function extractTextFromFile(fileData: string, mimeType: string, filename: string): Promise<string> {
  try {
    const buffer = Buffer.from(fileData, "base64");
    const lower = (mimeType || "").toLowerCase();
    const fname = (filename || "").toLowerCase();

    // Plain text-ish
    if (
      lower.startsWith("text/") ||
      lower === "application/json" ||
      lower === "application/xml" ||
      fname.endsWith(".txt") ||
      fname.endsWith(".md")
    ) {
      return normalizeWhitespace(buffer.toString("utf-8"));
    }

    // PDF
    if (lower === "application/pdf" || fname.endsWith(".pdf")) {
      return await extractTextFromPdf(buffer, filename);
    }

    // Word DOCX/DOC
    if (
      lower === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fname.endsWith(".docx")
    ) {
      return await extractTextFromDocx(buffer, filename);
    }
    if (lower === "application/msword" || fname.endsWith(".doc")) {
      return `[${filename}] is a legacy .doc; please convert to .docx for text extraction, or use the vision model if it’s a scan.`;
    }

    // Excel XLSX/XLS
    if (
      lower === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      fname.endsWith(".xlsx") ||
      lower === "application/vnd.ms-excel" ||
      fname.endsWith(".xls")
    ) {
      return await extractTextFromXlsx(buffer, filename);
    }

    // Images → handled by vision path, return empty text here
    if (lower.startsWith("image/")) {
      return "";
    }

    // Generic fallback
    return `[File: ${filename} (${mimeType})] content extraction is not supported for this type.`;
  } catch (error) {
    console.error("Error extracting text from file:", error);
    return `[Error extracting content from ${filename}]`;
  }
}
/* ------------------------------------------------------------------------- */

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Missing MISTRAL_API_KEY" });
    return;
  }

  let payload: Payload;
  try {
    payload =
      typeof req.body === "string" && req.body.length
        ? JSON.parse(req.body)
        : (req.body as Payload) ?? {};
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  const {
    messages = [],
    model = "mistral-small-latest",
    instructions = "",
    completion_args = { temperature: 0.7, max_tokens: 2048, top_p: 1 },
    tools = [],
    attachments = [],
  } = payload || {};

  const families = FAMILY_ALIASES[model] || [model];

  // Build payloads
  const chatMessages: ChatMessagePayload[] = [
    ...(instructions ? [{ role: "system" as const, content: String(instructions) }] : []),
    ...messages
      .filter((m) => m && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content })),
  ];

  // Handle attachments - extract text from files and add to messages
  if (attachments.length > 0) {
    try {
      const imageAttachments = attachments.filter(att => (att?.mimeType || "").startsWith('image/'));
      const textAttachments = attachments.filter(att => !(att?.mimeType || "").startsWith('image/'));

      // Process text-based attachments and extract content (with caps)
      let extractedText = '';
      let totalChars = 0;

      for (const attachment of textAttachments) {
        const rawText = await extractTextFromFile(
          attachment.data,
          attachment.mimeType,
          attachment.filename
        );

        const safe = truncateForModel(normalizeWhitespace(rawText), attachment.filename);
        const chunk =
          `\n\n--- Content from ${attachment.filename} ---\n` +
          safe +
          `\n--- End of ${attachment.filename} ---`;

        if (totalChars + chunk.length > MAX_TOTAL_ATTACHMENT_CHARS) {
          const room = Math.max(0, MAX_TOTAL_ATTACHMENT_CHARS - totalChars);
          if (room > 0) {
            extractedText += chunk.slice(0, room) + "\n\n[...additional attachment content omitted due to length cap]";
            totalChars = MAX_TOTAL_ATTACHMENT_CHARS;
          }
          break;
        } else {
          extractedText += chunk;
          totalChars += chunk.length;
        }
      }

      // For Pixtral models, include images in vision format
      if (imageAttachments.length > 0 && model.includes("pixtral")) {
        const lastUserMessage = chatMessages.filter((m) => m.role === "user").pop();
        if (lastUserMessage) {
          const visionContent = toVisionContent(lastUserMessage, extractedText);

          for (const attachment of imageAttachments) {
            visionContent.push({
              type: "image_url",
              image_url: `data:${attachment.mimeType};base64,${attachment.data}`,
            });
          }

          const lastIndex = chatMessages.lastIndexOf(lastUserMessage);
          if (lastIndex !== -1) {
            chatMessages[lastIndex] = {
              ...lastUserMessage,
              content: visionContent,
            };
          }
        } else if (extractedText) {
          chatMessages.push({
            role: "user",
            content: extractedText.trim(),
          });
        }
      } else if (extractedText) {
        // For non-vision models or when we have extracted text, append to last user message
        const lastUserMessage = chatMessages.filter((m) => m.role === "user").pop();
        if (lastUserMessage) {
          const lastIndex = chatMessages.lastIndexOf(lastUserMessage);
          chatMessages[lastIndex] = {
            ...lastUserMessage,
            content: mergeWithAdditionalText(lastUserMessage.content, extractedText),
          };
        } else {
          chatMessages.push({
            role: "user",
            content: extractedText.trim(),
          });
        }
      }

      // If we have images but not using vision model, add a note
      if (imageAttachments.length > 0 && !model.includes("pixtral")) {
        const lastUserMessage = chatMessages.filter((m) => m.role === "user").pop();
        if (lastUserMessage) {
          const lastIndex = chatMessages.lastIndexOf(lastUserMessage);
          const note = `\n\n[Note: ${imageAttachments.length} image file(s) attached but current model (${model}) doesn't support image analysis. Switch to pixtral-large-latest for image understanding.]`;
          chatMessages[lastIndex] = {
            ...lastUserMessage,
            content: mergeWithAdditionalText(lastUserMessage.content, note),
          };
        }
      }
    } catch (error) {
      console.error('Error processing attachments:', error);
    }
  }

  const convInputs: ConversationInput[] = messages.map((m) => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content : stringifyContent(m.content),
  }));
  const chatBodyBase: ChatRequestBase = {
    messages: chatMessages,
    stream: true,
    temperature: completion_args?.temperature,
    top_p: completion_args?.top_p,
    max_tokens: completion_args?.max_tokens,
    ...(Array.isArray(tools) && tools.length ? { tools } : {}),
  };

  const convBodyBase: ConversationRequestBase = {
    inputs: convInputs,
    stream: true,
    instructions,
    completion_args,
    ...(Array.isArray(tools) && tools.length ? { tools } : {}),
  };

  const abortController = new AbortController();
  res.on("close", () => abortController.abort());

  let lastErrorText = "";
  for (const candidate of families) {
    const order: Array<"chat" | "conv"> = PREFER_CHAT.has(candidate) ? ["chat", "conv"] : ["conv", "chat"];

    for (const which of order) {
      try {
        const { ok, streamable, response, errorText } =
          which === "chat"
            ? await callChatCompletions(candidate, chatBodyBase, apiKey, abortController)
            : await callConversations(candidate, convBodyBase, apiKey, abortController);

        if (ok && streamable && response?.body) {
          setSseHeaders(res);
          const upstreamStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
          for await (const chunk of upstreamStream) {
            if (res.destroyed) break;
            res.write(chunk);
          }
          res.end();
          return;
        } else {
          lastErrorText = errorText || lastErrorText;
        }
      } catch (error) {
        lastErrorText = error instanceof Error ? error.message : String(error);
      }
    }
  }

  res.status(502).json({ error: lastErrorText || "Upstream streaming failed for selected model" });
}

async function callChatCompletions(
  model: string,
  base: ChatRequestBase,
  apiKey: string,
  abortController: AbortController,
) {
  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ ...base, model }),
    signal: abortController.signal,
  });

  if (!response.ok) {
    const txt = await response.text().catch(() => "");
    const err = parseUpstreamError(txt) || txt || `chat/completions upstream error: ${response.status}`;
    return { ok: false, streamable: false, response, errorText: err };
  }

  const ct = response.headers.get("Content-Type") || "";
  const streamable = ct.toLowerCase().includes("text/event-stream");
  if (!streamable) {
    const txt = await response.text().catch(() => "");
    const err = parseUpstreamError(txt) || txt || "chat/completions did not return SSE";
    return { ok: false, streamable: false, response, errorText: err };
  }

  return { ok: true, streamable: true, response, errorText: "" };
}

async function callConversations(
  model: string,
  base: ConversationRequestBase,
  apiKey: string,
  abortController: AbortController,
) {
  const response = await fetch(CONVERSATIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ ...base, model }),
    signal: abortController.signal,
  });

  if (!response.ok) {
    const txt = await response.text().catch(() => "");
    const err = parseUpstreamError(txt) || txt || `conversations upstream error: ${response.status}`;
    return { ok: false, streamable: false, response, errorText: err };
  }

  const ct = response.headers.get("Content-Type") || "";
  const streamable = ct.toLowerCase().includes("text/event-stream");
  if (!streamable) {
    const txt = await response.text().catch(() => "");
    const err = parseUpstreamError(txt) || txt || "conversations did not return SSE";
    return { ok: false, streamable: false, response, errorText: err };
  }

  return { ok: true, streamable: true, response, errorText: "" };
}

function parseUpstreamError(text: string) {
  try {
    const j = JSON.parse(text);
    if (j?.error) return typeof j.error === "string" ? j.error : JSON.stringify(j.error);
  } catch {
    // Ignore JSON parse errors; fall back to empty string.
  }
  return "";
}
