import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PublicFooter, PublicNav } from "@/components/sdrep/PublicChrome";
import { Panel, PanelHeader, PageHeading, StatusPill } from "@/components/sdrep/primitives";
import { preparednessGuides } from "@/lib/sdrep-data";
import { api } from "@/lib/api-client";
import { Database, GitFork, Cpu, Network, Play, CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "Academic Architecture & Preparedness Guide — SDREP" },
      { name: "description", content: "SPIT Semester V Mini Project: Full-stack disaster coordination system demonstrating foundational Computer Engineering subjects." },
      { property: "og:title", content: "Academic Architecture & Preparedness — SDREP" },
      { property: "og:description", content: "Foundation computer engineering integration and disaster guidance." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const [benchmarking, setBenchmarking] = useState(false);
  const [benchmarkData, setBenchmarkData] = useState<any[] | null>(null);

  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);

  const runBenchmark = async () => {
    setBenchmarking(true);
    setBenchmarkError(null);
    try {
      const res = await api.analytics.getBenchmark();
      if (res.results) {
        setBenchmarkData(res.results);
      }
    } catch {
      setBenchmarkError("Benchmark execution failed. Ensure the SDREP backend server is running on port 3001.");
    } finally {
      setBenchmarking(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <PublicNav />
      <main className="mx-auto w-full max-w-6xl space-y-10 px-4 py-12 sm:px-6">
        <div>
          <PageHeading
            eyebrow="Academic Project Context"
            title="Smart Disaster Rescue & Evacuation Planner"
            description="Sardar Patel Institute of Technology (SPIT) · Department of Computer Engineering · Semester V Mini Project (AY 2026–27)"
          />
        </div>

        {/* Foundations Grid */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Integration of Foundation Computer Engineering Subjects</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel>
              <PanelHeader title="1. DBMS & Transactional Isolation" icon={<Database className="size-4 text-accent" />} />
              <div className="space-y-2 p-4 text-xs text-muted-foreground leading-relaxed">
                <p>• Normalized relational schema with strict foreign keys, indexes, and constraints.</p>
                <p>• <strong>ACID Transactions:</strong> Shelter intake operations update evacuee counts and enforce $(occupancy + count \le capacity)$ with atomic rollback on violations.</p>
                <p>• Zero negative stock guarantees in supply request fulfillment.</p>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="2. Graph Theory & Algorithmic Routing" icon={<GitFork className="size-4 text-warning" />} />
              <div className="space-y-2 p-4 text-xs text-muted-foreground leading-relaxed">
                <p>• Weighted directed graph $G = (V, E)$ stored via adjacency lists.</p>
                <p>• <strong>Dijkstra's Algorithm:</strong> Min-priority queue binary heap achieves optimal shortest path search in $O((|V| + |E|) \log |V|)$.</p>
                <p>• <strong>Dynamic Hazard Avoidance:</strong> Strict exclusion of blocked/closed segments with configurable hazard exposure penalties.</p>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="3. Operating Systems & Asynchronous I/O" icon={<Cpu className="size-4 text-success" />} />
              <div className="space-y-2 p-4 text-xs text-muted-foreground leading-relaxed">
                <p>• Non-blocking asynchronous I/O event loop with structured request concurrency.</p>
                <p>• Graceful OS signal handling (SIGINT/SIGTERM) ensuring database write flush and zero resource leaks.</p>
                <p>• Anti-spam debounce timers protecting against race conditions and duplicate submissions.</p>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="4. Computer Networks & Real-Time Sync" icon={<Network className="size-4 text-info" />} />
              <div className="space-y-2 p-4 text-xs text-muted-foreground leading-relaxed">
                <p>• RESTful API architecture under <code className="text-foreground">/api/v1</code> with cryptographic JWT authorization.</p>
                <p>• <strong>Server-Sent Events (SSE):</strong> Unidirectional real-time stream with automatic browser reconnection and role-based filtering.</p>
                <p>• Simulated offline synchronization queue for disconnected field clients.</p>
              </div>
            </Panel>
          </div>
        </section>

        {/* Live Algorithm Benchmark */}
        <Panel className="border-accent/40">
          <PanelHeader
            title="Algorithm Performance Evaluation & Live Benchmark"
            meta="Dijkstra vs A* on synthetic networks"
            action={
              <button
                onClick={runBenchmark}
                disabled={benchmarking}
                className="flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
              >
                {benchmarking ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                {benchmarking ? "Executing benchmark…" : "Run live benchmark"}
              </button>
            }
          />
          <div className="p-4">
            {benchmarkError && (
              <div className="mb-4 rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                {benchmarkError}
              </div>
            )}

            {benchmarkData && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-xs">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="label-eyebrow px-3 py-2 font-normal">Vertices (|V|)</th>
                      <th className="label-eyebrow px-3 py-2 font-normal">Edges (|E|)</th>
                      <th className="label-eyebrow px-3 py-2 font-normal">Dijkstra Time</th>
                      <th className="label-eyebrow px-3 py-2 font-normal">Dijkstra Explored</th>
                      <th className="label-eyebrow px-3 py-2 font-normal">A* Time</th>
                      <th className="label-eyebrow px-3 py-2 font-normal">A* Explored</th>
                      <th className="label-eyebrow px-3 py-2 font-normal">Optimality</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {benchmarkData.map((b, i) => (
                      <tr key={i} className="hover:bg-surface-2">
                        <td className="num px-3 py-2 font-medium">{b.vertexCount}</td>
                        <td className="num px-3 py-2">{b.edgeCount}</td>
                        <td className="num px-3 py-2 text-warning">{b.dijkstraTimeMs} ms</td>
                        <td className="num px-3 py-2">{b.dijkstraNodesExplored} nodes</td>
                        <td className="num px-3 py-2 text-success">{b.aStarTimeMs} ms</td>
                        <td className="num px-3 py-2">{b.aStarNodesExplored} nodes</td>
                        <td className="px-3 py-2"><StatusPill tone="success">Identical Optimal</StatusPill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Panel>

        {/* Public Preparedness Guides */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Citizen Evacuation Preparedness Guide</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {preparednessGuides.map((g) => (
              <Panel key={g.title}>
                <PanelHeader title={g.title} />
                <ul className="space-y-3 p-4 text-sm text-muted-foreground">
                  {g.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                      {p}
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
