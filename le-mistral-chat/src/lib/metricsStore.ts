// src/lib/metricsStore.ts
import { generateId } from "@/lib/id";
export type MistralCallMetric = {
  id: string;
  model: string;
  promptPreview: string;
  timestamp: number;
  durationMs: number;
  tokensEstimated: number;
  success: boolean;
};

type MetricsListener = (metrics: MistralCallMetric[]) => void;

const STORAGE_KEY = "mistral:metrics";
const MAX_METRICS = 200;

let metricsCache: MistralCallMetric[] = loadFromStorage();
const listeners = new Set<MetricsListener>();

function loadFromStorage(): MistralCallMetric[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const { id, model, promptPreview, timestamp, durationMs, tokensEstimated, success } =
            entry as Partial<MistralCallMetric>;
          if (
            typeof id === "string" &&
            typeof model === "string" &&
            typeof promptPreview === "string" &&
            typeof timestamp === "number" &&
            typeof durationMs === "number" &&
            typeof tokensEstimated === "number" &&
            typeof success === "boolean"
          ) {
            return entry as MistralCallMetric;
          }
          return null;
        })
        .filter((entry): entry is MistralCallMetric => Boolean(entry));
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

function persist() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metricsCache));
  } catch {
    // ignore quota/storage failures
  }
}

function notify() {
  const snapshot = [...metricsCache];
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // ignore listener errors
    }
  });
}

export function recordMistralMetric(metric: Omit<MistralCallMetric, "id"> & { id?: string }) {
  const entry: MistralCallMetric = {
    id: metric.id ?? generateId("metric"),
    ...metric,
  };
  metricsCache = [entry, ...metricsCache].slice(0, MAX_METRICS);
  persist();
  notify();
}

export function getMistralMetrics(): MistralCallMetric[] {
  return [...metricsCache];
}

export function subscribeToMetrics(listener: MetricsListener): () => void {
  listeners.add(listener);
  listener([...metricsCache]);
  return () => {
    listeners.delete(listener);
  };
}

export function estimateTokensFromChars(charCount: number): number {
  if (charCount <= 0) return 0;
  return Math.max(1, Math.ceil(charCount / 4));
}
