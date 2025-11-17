import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  getMistralMetrics,
  subscribeToMetrics,
  type MistralCallMetric,
} from "@/lib/metricsStore";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

export default function Dashboard() {
  const [metrics, setMetrics] = useState<MistralCallMetric[]>(() => getMistralMetrics());

  useEffect(() => {
    const unsubscribe = subscribeToMetrics(setMetrics);
    return unsubscribe;
  }, []);

  const summary = useMemo(() => {
    const totalRequests = metrics.length;
    const totalTokens = metrics.reduce((sum, entry) => sum + entry.tokensEstimated, 0);
    const totalLatency = metrics.reduce((sum, entry) => sum + entry.durationMs, 0);
    const successCount = metrics.filter((entry) => entry.success).length;
    return {
      totalRequests,
      totalTokens,
      avgLatency: totalRequests ? totalLatency / totalRequests : 0,
      successRate: totalRequests ? (successCount / totalRequests) * 100 : 0,
    };
  }, [metrics]);

  const chartData = useMemo(() => {
    return [...metrics]
      .slice(0, 20)
      .reverse()
      .map((entry) => ({
        label: new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        tokens: entry.tokensEstimated,
        latency: Number((entry.durationMs / 1000).toFixed(2)),
      }));
  }, [metrics]);

  return (
    <div className="min-h-screen bg-background text-foreground font-pixel">
      <header className="border-b-8 border-border px-4 py-4 sm:px-8 sm:py-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Insights</p>
          <h1 className="text-xl sm:text-2xl">Mistral Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="border-4 border-border font-pixel text-[10px]">
            <Link to="/">← Back to chat</Link>
          </Button>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-8 sm:py-8 space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total requests" value={summary.totalRequests.toLocaleString()} />
          <MetricCard label="Tokens processed" value={summary.totalTokens.toLocaleString()} />
          <MetricCard
            label="Average latency"
            value={`${summary.avgLatency.toFixed(0)} ms`}
            helper="last 200 calls"
          />
          <MetricCard
            label="Success rate"
            value={`${summary.successRate.toFixed(1)}%`}
            helper={`${metrics.filter((m) => m.success).length}/${metrics.length || 1} successful`}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="border-4 border-border bg-card px-4 py-4">
            <h2 className="text-[12px] uppercase tracking-widest mb-3">Tokens per call</h2>
            {chartData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#444" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="tokens" stroke="#f97316" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No metrics yet. Start chatting to collect data." />
            )}
          </div>
          <div className="border-4 border-border bg-card px-4 py-4">
            <h2 className="text-[12px] uppercase tracking-widest mb-3">Latency (seconds)</h2>
            {chartData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#444" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="latency" fill="#22d3ee" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No calls to chart yet." />
            )}
          </div>
        </section>

        <section className="border-4 border-border bg-card px-4 py-4 overflow-auto">
          <h2 className="text-[12px] uppercase tracking-widest mb-3">Recent calls</h2>
          {metrics.length ? (
            <table className="w-full text-[10px] sm:text-[11px]">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-normal">Time</th>
                  <th className="py-2 pr-3 font-normal">Model</th>
                  <th className="py-2 pr-3 font-normal">Latency</th>
                  <th className="py-2 pr-3 font-normal">Tokens</th>
                  <th className="py-2 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {metrics.slice(0, 12).map((entry) => {
                  const entryDate = new Date(entry.timestamp);
                  const dateLabel = entryDate.toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  });
                  const timeLabel = entryDate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });
                  return (
                    <tr key={entry.id} className="border-t border-border/40">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <div>{dateLabel}</div>
                        <div className="text-[9px] text-muted-foreground">{timeLabel}</div>
                      </td>
                      <td className="py-2 pr-3">{entry.model}</td>
                      <td className="py-2 pr-3">{entry.durationMs.toFixed(0)} ms</td>
                      <td className="py-2 pr-3">{entry.tokensEstimated}</td>
                      <td className="py-2">
                        <span
                          className={`px-2 py-1 border-2 ${
                            entry.success
                              ? "border-emerald-500 text-emerald-500"
                              : "border-destructive text-destructive"
                          }`}
                        >
                          {entry.success ? "success" : "error"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState message="No history yet." />
          )}
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="border-4 border-border bg-card px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-2xl mt-2">{value}</p>
      {helper && <p className="text-[9px] text-muted-foreground mt-1">{helper}</p>}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-[10px] text-muted-foreground">{message}</p>;
}
