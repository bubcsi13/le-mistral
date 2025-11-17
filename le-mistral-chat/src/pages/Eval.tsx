import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { runEvalForModel, type EvalRunResult } from "@/lib/evalRunner";
import { estimateTokensFromChars } from "@/lib/metricsStore";

const AVAILABLE_MODELS = [
  "mistral-small-latest",
  "mistral-medium-latest",
  "mistral-large-latest",
  "codestral-latest",
  "pixtral-large-latest",
];

type ViewResult =
  | (EvalRunResult & { status: "success"; rating?: "up" | "down" | null })
  | { model: string; status: "error"; error: string; rating?: "up" | "down" | null };

export default function Eval() {
  const [prompt, setPrompt] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>([
    "mistral-small-latest",
    "mistral-large-latest",
  ]);
  const [results, setResults] = useState<ViewResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const handleToggleModel = (model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!prompt.trim() || !selectedModels.length) {
      return;
    }
    setIsRunning(true);
    try {
      const evals = await Promise.all(
        selectedModels.map(async (model) => {
          try {
            const data = await runEvalForModel(prompt, model);
            return { ...data, status: "success" as const };
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            return { model, status: "error" as const, error: errMsg };
          }
        })
      );
      setResults(evals);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRating = (model: string, rating: "up" | "down") => {
    setResults((prev) =>
      prev.map((entry) => (entry.model === model ? { ...entry, rating } : entry))
    );
  };

  const comparisonStats = useMemo(() => {
    if (!results.length) return [];
    return results.map((entry) => ({
      model: entry.model,
      rating: entry.rating ?? null,
      duration: entry.status === "success" ? `${entry.durationMs.toFixed(0)} ms` : "—",
      tokens:
        entry.status === "success" ? entry.tokensEstimated.toLocaleString() : "—",
    }));
  }, [results]);

  return (
    <div className="min-h-screen bg-background text-foreground font-pixel">
      <header className="border-b-8 border-border px-4 py-4 sm:px-8 sm:py-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Evaluation</p>
          <h1 className="text-xl sm:text-2xl">Multi-model playground</h1>
        </div>
        <Button asChild variant="outline" className="border-4 border-border font-pixel text-[10px]">
          <Link to="/">← Back to chat</Link>
        </Button>
      </header>

      <main className="px-4 py-6 sm:px-8 sm:py-8 space-y-6">
        <section className="border-4 border-border bg-card p-4 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="eval-prompt" className="text-[10px] uppercase tracking-widest">
                Prompt
              </label>
              <textarea
                id="eval-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="mt-2 w-full border-4 border-border bg-background text-foreground p-3 text-[11px] min-h-[120px]"
                placeholder="Ask a question or paste a test prompt..."
              />
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest mb-2">Select models</p>
              <div className="flex flex-wrap gap-3">
                {AVAILABLE_MODELS.map((model) => (
                  <label
                    key={model}
                    className={`flex items-center gap-2 border-4 px-3 py-2 text-[10px] cursor-pointer ${
                      selectedModels.includes(model)
                        ? "border-primary bg-primary/20"
                        : "border-border bg-background"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(model)}
                      onChange={() => handleToggleModel(model)}
                    />
                    {model}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <p className="text-[9px] text-muted-foreground">
                Tokens estimated:{" "}
                {estimateTokensFromChars(prompt.length * selectedModels.length)}
              </p>
              <Button
                type="submit"
                disabled={!prompt.trim() || !selectedModels.length || isRunning}
                className="border-4 border-border font-pixel text-[10px]"
              >
                {isRunning ? "Evaluating..." : "Run evaluation"}
              </Button>
            </div>
          </form>
        </section>

        {results.length > 0 && (
          <>
            <section className="grid gap-4 md:grid-cols-2">
              {results.map((entry) => (
                <article key={entry.model} className="border-4 border-border bg-card p-4 space-y-3">
                  <header className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest">{entry.model}</p>
                      <p className="text-[9px] text-muted-foreground">
                        {entry.status === "success"
                          ? `${entry.tokensEstimated.toLocaleString()} tokens • ${entry.durationMs.toFixed(
                              0
                            )} ms`
                          : "Request failed"}
                      </p>
                    </div>
                    {entry.status === "success" && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleRating(entry.model, "up")}
                          className={`px-2 py-1 border-2 ${
                            entry.rating === "up"
                              ? "border-emerald-500 text-emerald-500"
                              : "border-border"
                          }`}
                        >
                          👍
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRating(entry.model, "down")}
                          className={`px-2 py-1 border-2 ${
                            entry.rating === "down"
                              ? "border-destructive text-destructive"
                              : "border-border"
                          }`}
                        >
                          👎
                        </button>
                      </div>
                    )}
                  </header>
                  <div className="text-[11px] whitespace-pre-wrap bg-background/60 border-4 border-border px-3 py-2">
                    {entry.status === "success" ? entry.content || "(empty response)" : entry.error}
                  </div>
                </article>
              ))}
            </section>

            <section className="border-4 border-border bg-card px-4 py-4 overflow-auto">
              <h2 className="text-[12px] uppercase tracking-widest mb-3">Model comparison</h2>
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-normal">Model</th>
                    <th className="py-2 pr-3 font-normal">Rating</th>
                    <th className="py-2 pr-3 font-normal">Latency</th>
                    <th className="py-2 font-normal">Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonStats.map((row) => (
                    <tr key={row.model} className="border-t border-border/40">
                      <td className="py-2 pr-3">{row.model}</td>
                      <td className="py-2 pr-3">
                        {row.rating === "up"
                          ? "👍"
                          : row.rating === "down"
                            ? "👎"
                            : "—"}
                      </td>
                      <td className="py-2 pr-3">{row.duration}</td>
                      <td className="py-2">{row.tokens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
