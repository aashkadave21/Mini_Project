import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Navigation, Users, MapPin, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { MapCanvas } from "@/components/sdrep/MapCanvas";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";
import { api } from "@/lib/api-client";
import { evacRoutes, shelters } from "@/lib/sdrep-data";

export const Route = createFileRoute("/control/evacuation")({
  head: () => ({
    meta: [
      { title: "Evacuation Coordination — SDREP Control Centre" },
      { name: "description", content: "Manage evacuation corridors, sector clearance progress and shelter assignment across the affected area." },
      { property: "og:title", content: "Evacuation Coordination — SDREP" },
      { property: "og:description", content: "Corridor planning and sector clearance tracking." },
    ],
  }),
  component: EvacuationPage,
});

const sectors = [
  { id: "S-3", name: "Port", population: 4200, cleared: 3810, order: "MANDATORY" },
  { id: "S-7", name: "Riverside", population: 6100, cleared: 3520, order: "MANDATORY" },
  { id: "S-9", name: "Civic", population: 2800, cleared: 2610, order: "ADVISORY" },
  { id: "S-12", name: "Old Town", population: 3400, cleared: 1980, order: "MANDATORY" },
  { id: "S-18", name: "North Ridge", population: 1900, cleared: 420, order: "STANDBY" },
];

function EvacuationPage() {
  const [recomputing, setRecomputing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [routes, setRoutes] = useState<any[]>(evacRoutes);

  const fetchCorridors = async () => {
    try {
      const res = await api.evacuation.getCorridors();
      if (res.data?.routes) {
        setRoutes(res.data.routes);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    fetchCorridors();
  }, []);

  const handleRecompute = async () => {
    setRecomputing(true);
    setFeedback(null);
    try {
      const res = await api.evacuation.recalculateAll();
      setFeedback(res.message);
      if (res.data) {
        setRoutes(res.data);
      }
      setTimeout(() => setFeedback(null), 7000);
    } catch (err: any) {
      alert(err.message || "Failed to recompute evacuation corridors.");
    } finally {
      setRecomputing(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeading
        eyebrow="Evacuation"
        title="Corridor & sector coordination"
        description="Track clearance per sector, monitor corridor viability and reassign shelters when capacity is exceeded."
        actions={
          <button
            onClick={handleRecompute}
            disabled={recomputing}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {recomputing ? <Loader2 className="size-3.5 animate-spin" /> : <Navigation className="size-3.5" />}
            {recomputing ? "Computing Dijkstra paths…" : "Recompute all routes"}
          </button>
        }
      />

      {feedback && (
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-xs text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Sectors under order" value="4" tone="critical" icon={<MapPin className="size-4" />} hint="1 on standby" />
        <MetricCard label="Population in scope" value="18,400" tone="info" icon={<Users className="size-4" />} />
        <MetricCard label="Cleared" value="12,340" tone="success" delta="67%" />
        <MetricCard label="Corridors active" value={routes.length} tone="warning" hint="1 rerouted" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel className="overflow-hidden">
          <PanelHeader title="Evacuation corridors" icon={<Navigation className="size-4" />} />
          <div className="p-2">
            <MapCanvas height="clamp(340px, 46vh, 560px)" layers={{ teams: false, hospitals: false }} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Sector clearance" />
          <ul className="divide-y divide-border">
            {sectors.map((s) => {
              const pct = (s.cleared / s.population) * 100;
              return (
                <li key={s.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      <span className="num text-muted-foreground">{s.id}</span> {s.name}
                    </span>
                    <StatusPill tone={s.order === "MANDATORY" ? "critical" : s.order === "ADVISORY" ? "warning" : "info"}>
                      {s.order}
                    </StatusPill>
                  </div>
                  <div className="mt-2">
                    <Bar value={pct} tone={pct > 85 ? "success" : pct > 50 ? "warning" : "critical"} />
                  </div>
                  <p className="num mt-1 text-[11px] text-muted-foreground">
                    {s.cleared.toLocaleString()} / {s.population.toLocaleString()} · {pct.toFixed(0)}%
                  </p>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Corridor assignments" meta="calculated via Dijkstra shortest path engine" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {["Corridor", "Origin", "Destination shelter", "Capacity", "Travel", "State"].map((h) => (
                  <th key={h} className="label-eyebrow px-4 py-2 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {routes.map((r, i) => {
                const s = shelters[i % shelters.length]!;
                const pct = (s.occupancy / s.capacity) * 100;
                return (
                  <tr key={r.id} className="hover:bg-surface-2">
                    <td className="num px-4 py-3">{r.id}</td>
                    <td className="px-4 py-3">{r.label?.split("·")[1]?.split("→")[0]?.trim() || r.originSector}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <ArrowRight className="size-3.5 text-muted-foreground" /> {s.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-28"><Bar value={pct} tone={pct >= 99 ? "critical" : pct >= 75 ? "warning" : "success"} /></div>
                    </td>
                    <td className="num px-4 py-3">{r.travelTimeMin || [26, 14, 9][i]} min</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={i === 0 ? "critical" : i === 2 ? "warning" : "success"}>
                        {i === 0 ? "Rerouted" : i === 2 ? "Congested" : "Optimal"}
                      </StatusPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
