import { createFileRoute } from "@tanstack/react-router";
import {
  Boxes,
  Tent,
  Users,
  HeartPulse,
  RefreshCw,
  CheckCircle2,
  SlidersHorizontal,
  Crosshair,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/control/shelters")({
  head: () => ({
    meta: [
      { title: "Shelter Network & Evacuee Allocation — SDREP Control Centre" },
      { name: "description", content: "Monitor relief camp occupancy, override shelter capacities, and evaluate automated evacuee diversion when camps are full." },
      { property: "og:title", content: "Shelter Network & Evacuee Allocation — SDREP" },
      { property: "og:description", content: "Capacity management and evacuee intake allocation." },
    ],
  }),
  component: SheltersPage,
});

function SheltersPage() {
  const [shelters, setShelters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Scenario F: Evacuee routing simulator
  const [evacueeOrigin, setEvacueeOrigin] = useState("Sector 7 · Riverside");
  const [evacueePos, setEvacueePos] = useState<[number, number]>([19.092, 72.862]);
  const [evacueeCount, setEvacueeCount] = useState(25);
  const [routingResult, setRoutingResult] = useState<any | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const fetchShelters = useCallback(async () => {
    try {
      const res = await api.shelter.getAll();
      if (res.data) setShelters(res.data);
    } catch (err) {
      console.error("Failed to load shelters:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShelters();
  }, [fetchShelters]);

  // Scenario F: Override Shelter Capacity
  const handleUpdateCapacity = async (id: string, updates: { capacity?: number; occupancy?: number; status?: string }) => {
    try {
      const res = await api.shelter.updateCapacity(id, updates);
      setFeedback(res.message);
      await fetchShelters();
      setTimeout(() => setFeedback(null), 6000);
    } catch (err: any) {
      setFeedback(`Error updating shelter: ${err.message}`);
    }
  };

  // Scenario F: Evaluate Evacuee Shelter Allocation
  const handleEvaluateEvacueeAllocation = async () => {
    setEvaluating(true);
    try {
      const res = await api.facilities.findSuitable({
        type: "SHELTER",
        location: evacueePos,
        requiredBeds: evacueeCount,
      });
      setRoutingResult(res.data);
    } catch (err: any) {
      setFeedback(`Allocation error: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  const handleOriginChange = (sector: string) => {
    setEvacueeOrigin(sector);
    if (sector.includes("Sector 7")) setEvacueePos([19.092, 72.862]);
    else if (sector.includes("Sector 3")) setEvacueePos([19.062, 72.848]);
    else if (sector.includes("Sector 12")) setEvacueePos([19.083, 72.895]);
    else setEvacueePos([19.076, 72.889]);
  };

  const total = shelters.reduce((a, s) => a + (s.capacity || 0), 0);
  const occupied = shelters.reduce((a, s) => a + (s.occupancy || 0), 0);
  const fullShelters = shelters.filter((s) => s.status === "full" || s.occupancy >= s.capacity).length;

  return (
    <div className="space-y-4">
      <PageHeading
        eyebrow="Shelter Capacity & Allocation (Scenario F)"
        title="Relief Shelter Network & Evacuee Allocation"
        description="Monitor real-time relief camp loads, mark shelters as full to test capacity limits, and observe automated evacuee diversion to the nearest available camp."
        actions={
          <button
            onClick={fetchShelters}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs hover:bg-surface-3 transition-colors"
          >
            <RefreshCw className="size-3.5" /> Refresh Network
          </button>
        }
      />

      {feedback && (
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-xs text-success font-medium">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Total capacity" value={total.toLocaleString()} icon={<Tent className="size-4" />} tone="info" />
        <MetricCard label="Currently sheltered" value={occupied.toLocaleString()} tone="warning" icon={<Users className="size-4" />} delta={`${total > 0 ? ((occupied / total) * 100).toFixed(0) : 0}%`} />
        <MetricCard label="Shelters full" value={fullShelters} tone={fullShelters > 0 ? "critical" : "success"} hint="requiring diversion" />
        <MetricCard label="Medical-capable camps" value={shelters.filter((s) => s.medical).length} tone="success" icon={<HeartPulse className="size-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left: Shelter Register with Interactive Capacity Overrides (Scenario F) */}
        <Panel>
          <PanelHeader title="Shelter Register & Quick Capacity Overrides (Scenario F)" icon={<Boxes className="size-4" />} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["ID", "Shelter", "Occupancy / Cap", "Load", "Medical", "Status", "Capacity Action"].map((h) => (
                    <th key={h} className="label-eyebrow px-4 py-2 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shelters.map((s) => {
                  const pct = s.capacity > 0 ? (s.occupancy / s.capacity) * 100 : 0;
                  return (
                    <tr key={s.id} className="hover:bg-surface-2 transition-colors">
                      <td className="num px-4 py-3 text-muted-foreground font-mono">{s.id}</td>
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="num px-4 py-3 font-mono">{s.occupancy}/{s.capacity}</td>
                      <td className="px-4 py-3">
                        <div className="w-24">
                          <Bar value={pct} tone={pct >= 99 ? "critical" : pct >= 75 ? "warning" : "success"} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {s.medical ? <StatusPill tone="success">Yes</StatusPill> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={s.status === "full" ? "critical" : s.status === "near-full" ? "warning" : "success"}>
                          {s.status}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {s.status === "full" || s.occupancy >= s.capacity ? (
                            <button
                              onClick={() => handleUpdateCapacity(s.id, { occupancy: Math.max(0, s.capacity - 100), status: "open" })}
                              className="rounded bg-success/20 px-2 py-0.5 text-[11px] font-semibold text-success hover:bg-success/30"
                              title="Free up 100 shelter spaces"
                            >
                              Free Space
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateCapacity(s.id, { occupancy: s.capacity, status: "full" })}
                              className="rounded bg-critical/20 px-2 py-0.5 text-[11px] font-semibold text-critical hover:bg-critical/30"
                              title="Set occupancy = capacity (Mark Full)"
                            >
                              Mark Full
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateCapacity(s.id, { capacity: s.capacity + 200 })}
                            className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] hover:bg-surface-3"
                            title="Expand temporary capacity by 200"
                          >
                            +200 Cap
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Right: Evacuee Batch Intake & Re-routing Simulator (Scenario F) */}
        <Panel>
          <PanelHeader title="Evacuee Allocation & Diversion Router (Scenario F)" icon={<Crosshair className="size-4 text-primary" />} />
          <div className="p-4 space-y-3 text-xs">
            <p className="text-[11px] text-muted-foreground">
              Simulate evacuee batch intake. When nearest shelter is full or has reached threshold, the allocation algorithm routes to the next closest facility with available beds.
            </p>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Evacuee Origin Sector</label>
              <select
                value={evacueeOrigin}
                onChange={(e) => handleOriginChange(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-surface-2 p-2 text-xs"
              >
                <option value="Sector 7 · Riverside">Sector 7 · Riverside (Nearest: SH-01 Municipal Stadium)</option>
                <option value="Sector 12 · Old Town">Sector 12 · Old Town (Nearest: SH-03 Community Hall)</option>
                <option value="Sector 3 · Port">Sector 3 · Port (Nearest: SH-05 Dockyard Union Hall)</option>
                <option value="Sector 18 · North Ridge">Sector 18 · North Ridge (Nearest: SH-04 North Ridge Complex)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Evacuee Group Size</label>
              <input
                type="number"
                min={1}
                max={500}
                value={evacueeCount}
                onChange={(e) => setEvacueeCount(Number(e.target.value))}
                className="mt-1 w-full rounded border border-border bg-surface-2 p-1.5 text-xs font-mono"
              />
            </div>

            <button
              onClick={handleEvaluateEvacueeAllocation}
              disabled={evaluating}
              className="w-full rounded bg-primary py-2 font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
            >
              {evaluating ? <RefreshCw className="size-3.5 animate-spin" /> : <Crosshair className="size-3.5" />}
              {evaluating ? "Evaluating Optimal Shelter…" : "Evaluate Shelter Routing"}
            </button>

            {routingResult && (
              <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">{routingResult.facility?.name}</span>
                  <StatusPill tone={routingResult.diversionWarning ? "warning" : "success"}>
                    {routingResult.diversionWarning ? "Diverted" : "Primary Shelter"}
                  </StatusPill>
                </div>
                <p className="text-muted-foreground">{routingResult.rationale}</p>
                {routingResult.diversionWarning && (
                  <div className="rounded bg-critical/10 p-2 text-critical text-[11px] font-medium border border-critical/30">
                    ⚠️ Capacity Diversion: {routingResult.diversionWarning}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono border-t border-border pt-2 text-muted-foreground">
                  <span>Distance: {routingResult.distanceKm} km</span>
                  <span>Free Capacity: {routingResult.facility ? routingResult.facility.capacity - routingResult.facility.occupancy : 0}</span>
                </div>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
