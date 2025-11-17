import { streamMistralReply } from "@/lib/chatApi";
import { generateId } from "@/lib/id";
import type { Message } from "@/types/chat";
import { estimateTokensFromChars, recordMistralMetric } from "@/lib/metricsStore";

export type EvalRunResult = {
  model: string;
  content: string;
  durationMs: number;
  tokensEstimated: number;
};

export async function runEvalForModel(prompt: string, model: string): Promise<EvalRunResult> {
  const history: Message[] = [
    {
      id: generateId("eval"),
      role: "user",
      content: prompt,
      timestamp: new Date(),
    },
  ];

  return new Promise((resolve, reject) => {
    let buffer = "";
    const start = performance.now();

    streamMistralReply(
      history,
      {
        model,
        instructions:
          "Evaluation mode: provide your best possible answer and cite assumptions if necessary.",
        completion_args: { temperature: 0.3, max_tokens: 1024, top_p: 1 },
        tools: [],
        attachments: [],
      },
      {
        onStart: () => {
          // no-op
        },
        onToken: (chunk) => {
          buffer += chunk;
        },
        onDone: () => {
          const durationMs = performance.now() - start;
          const tokensEstimated = estimateTokensFromChars(prompt.length + buffer.length);
          recordMistralMetric({
            model,
            promptPreview: `[eval] ${prompt.slice(0, 120)}`,
            timestamp: Date.now(),
            durationMs,
            tokensEstimated,
            success: true,
          });
          resolve({
            model,
            content: buffer.trim(),
            durationMs,
            tokensEstimated,
          });
        },
        onError: (errText) => {
          recordMistralMetric({
            model,
            promptPreview: `[eval] ${prompt.slice(0, 120)}`,
            timestamp: Date.now(),
            durationMs: performance.now() - start,
            tokensEstimated: estimateTokensFromChars(prompt.length),
            success: false,
          });
          reject(new Error(errText));
        },
        onAbort: () => {
          recordMistralMetric({
            model,
            promptPreview: `[eval] ${prompt.slice(0, 120)}`,
            timestamp: Date.now(),
            durationMs: performance.now() - start,
            tokensEstimated: estimateTokensFromChars(prompt.length),
            success: false,
          });
          reject(new Error("Eval aborted"));
        },
      }
    );
  });
}
