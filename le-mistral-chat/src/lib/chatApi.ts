// root/src/lib/chatApi.ts
import { resolveApiPath } from "@/lib/apiBase";
import { generateId } from "@/lib/id";
import type { Message } from "@/types/chat";

type StreamContentChunk = { text?: string };
type StreamChoiceDelta = { content?: string | StreamContentChunk[] };
type StreamChoice = {
  delta?: StreamChoiceDelta;
  message?: StreamChoiceDelta;
};
type StreamEvent = {
  type?: string;
  content?: unknown;
  error?: unknown;
  choices?: StreamChoice[];
};

type ToolPayload = Record<string, unknown>;

function extractDataJsonFromFrame(frame: string): StreamEvent | null {
  const lines = frame.split(/\r?\n/);
  const dataLine = lines.find((l) => l.trim().startsWith("data:"));
  if (!dataLine) return null;
  const jsonStr = dataLine.slice(dataLine.indexOf("data:") + 5).trim();
  if (!jsonStr || jsonStr === "[DONE]") return null;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function getChatUrl() {
  return resolveApiPath("/api/chat");
}

function getImageUrl() {
  return resolveApiPath("/api/generate-image");
}

function extractTextFromDeltaContent(content: string | StreamContentChunk[] | undefined): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((chunk) => (typeof chunk?.text === "string" ? chunk.text : ""))
      .join("");
  }
  return "";
}

function getTitleUrl() {
  return resolveApiPath("/api/title");
}

export function initialAssistantGreeting(): Message {
  return {
    id: generateId("assistant"),
    role: "assistant",
    content: "Hello! How can I help you today?",
    timestamp: new Date(),
  };
}

// Helper function to convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

export async function streamMistralReply(
  history: Message[],
  {
    model = "mistral-small-latest",
    instructions = "Sample Instructions",
    completion_args = { temperature: 0.7, max_tokens: 2048, top_p: 1 },
    tools = [],
    attachments = [],
    signal,
  }: {
    model?: string;
    instructions?: string;
    completion_args?: { temperature?: number; max_tokens?: number; top_p?: number };
    tools?: ToolPayload[];
    attachments?: Array<{
      type: string;
      data: string;
      filename: string;
      mimeType: string;
    }>;
    signal?: AbortSignal;
  },
  callbacks: {
    onStart: (assistantId: string) => void;
    onToken: (chunk: string, assistantId: string) => void;
    onDone: (assistantId: string) => void;
    onError: (errText: string, assistantId: string) => void;
    onAbort?: (assistantId: string) => void;
    /** Optional: if you ever want to pre-generate the assistantId on the caller side */
    assistantId?: string;
  }
) {
  const PROXY_URL = getChatUrl();

  const {
    onStart,
    onToken,
    onDone,
    onError,
    assistantId: presetAssistantId,
  } = callbacks;

  // 🔑 Generate an assistantId and notify the UI *immediately* so
  // the “typing” bubble can appear even before the network call completes.
  const assistantId = presetAssistantId ?? generateId("assistant");
  onStart(assistantId);

  let res: Response;
  try {
    res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: history.map(({ role, content }) => ({ role, content })),
        model,
        instructions,
        completion_args,
        tools,
        attachments,
      }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      callbacks.onAbort?.(assistantId);
    } else {
      const message =
        error instanceof Error ? error.message : "Network error while contacting chat API.";
      onError(message, assistantId);
    }
    return;
  }

  if (!res.ok) {
    let errText = `API error ${res.status}`;
    try {
      const txt = await res.text();
      try {
        const j = JSON.parse(txt);
        errText = j?.error || txt || errText;
      } catch {
        errText = txt || errText;
      }
    } catch {
      // ignore
    }
    onError(errText, assistantId);
    return;
  }

  if (!res.body) {
    onError("No response body from server.", assistantId);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() || "";

      for (const frame of frames) {
        const evt = extractDataJsonFromFrame(frame);
        if (!evt) continue;

        // Conversations-style delta
        if (evt.type === "message.output.delta") {
          const chunk = typeof evt.content === "string" ? evt.content : "";
          if (chunk) onToken(chunk, assistantId);
          continue;
        }
        if (evt.type === "conversation.response.done") {
          onDone(assistantId);
          continue;
        }
        if (evt.error) {
          onError(String(evt.error), assistantId);
          return;
        }

        // Chat Completions-style streaming
        if (Array.isArray(evt.choices) && evt.choices.length > 0) {
          const choice = evt.choices[0];
          const delta = choice?.delta || choice?.message || {};
          const piece = extractTextFromDeltaContent(delta?.content);
          if (piece) onToken(piece, assistantId);
          continue;
        }
      }
    }
    onDone(assistantId);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      callbacks.onAbort?.(assistantId);
    } else {
      const message = error instanceof Error ? error.message : "Stream read error";
      onError(message, assistantId);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

export async function generateImagesViaAgent(
  prompt: string,
  options?: { signal?: AbortSignal }
): Promise<{ images: Array<{ mime: string; base64: string }> }> {
  const url = getImageUrl();
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
    signal: options?.signal,
  });
  const txt = await r.text();
  if (!r.ok) {
    throw new Error(txt || `Image API error ${r.status}`);
  }
  const data = JSON.parse(txt);
  return data;
}

// Helper to prepare attachments for API
export async function prepareAttachments(
  files: File[]
): Promise<
  Array<{
    type: string;
    data: string;
    filename: string;
    mimeType: string;
  }>
> {
  const attachments = [];

  for (const file of files) {
    const base64Data = await fileToBase64(file);
    attachments.push({
      type: file.type.split("/")[0], // 'image', 'application', etc.
      data: base64Data,
      filename: file.name,
      mimeType: file.type,
    });
  }

  return attachments;
}

export async function generateSessionTitle(prompt: string): Promise<string | null> {
  const question = prompt?.trim();
  if (!question) return null;
  const url = getTitleUrl();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: question }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || `Title API error ${res.status}`);
    }
    const data = await res.json();
    const title = typeof data?.title === "string" ? data.title.trim() : "";
    return title || null;
  } catch (error) {
    console.error("generateSessionTitle error:", error);
    return null;
  }
}
