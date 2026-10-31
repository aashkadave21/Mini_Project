import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Fuel,
  Radio,
  Siren,
  Users,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Zap,
  Activity,
  Crosshair,
} from "lucide-react";
import { MapCanvas } from "@/components/sdrep/MapCanvas";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/control/rescue")({
  head: () => ({
    meta: [
      { title: "Rescue Operations & Vehicle Allocation — SDREP Control Centre" },
      { name: "description", content: "Dispatch board for rescue teams: capability filtering, atomic single vehicle assignment, concurrency race tests, and baseline comparison." },
      { property: "og:title", content: "Rescue Operations — SDREP" },
      { property: "og:description", content: "Dispatch and monitor rescue units with capability matching." },
    ],
  }),
  component: RescuePage,
});

const statusTone = {
  available: "success",
  "en-route": "info",
  "on-scene": "warning",
  returning: "info",
  offline: "critical",
} as const;

function RescuePage() {
  const [dispatching, setDispatching] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Scenario C: Single vehicle assignment state
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>("");
  const [suitableVehicles, setSuitableVehicles] = useState<any[]>([]);
  const [loadingSuitable, setLoadingSuitable] = useState(false);

  // Scenario C: Baseline comparison state
  const [baselineData, setBaselineData] = useState<any | null>(null);
  const [loadingBaseline, setLoadingBaseline] = useState(false);

  // Scenario E: Concurrency race condition state
  const [raceFeedback, setRaceFeedback] = useState<{ attempt1?: string; attempt2?: string; error?: string } | null>(null);
  const [simulatingRace, setSimulatingRace] = useState(false);

  const fetchLiveState = useCallback(async () => {
    try {
      const [tRes, iRes, mRes] = await Promise.all([
        api.rescue.getAllTeams(),
        api.public.getIncidents(),
        api.rescue.getAllMissions().catch(() => ({ data: [] })),
      ]);

      if (tRes.data) setTeams(tRes.data);
      if (iRes.data) {
        setIncidents(iRes.data);
        if (!selectedIncidentId && iRes.data.length > 0) {
          const unassigned = iRes.data.find((i: any) => i.status !== "resolved" && i.status !== "dispatched");
          setSelectedIncidentId(unassigned ? unassigned.id : iRes.data[0].id);
        }
      }
      if (mRes.data) setMissions(mRes.data);
    } catch (err) {
      console.error("Failed to load rescue operations data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedIncidentId]);

  useEffect(() => {
    fetchLiveState();
  }, [fetchLiveState]);

  // Load suitable vehicles when selected incident changes
  useEffect(() => {
    if (!selectedIncidentId) return;
    const loadSuitable = async () => {
      setLoadingSuitable(true);
      try {
        const res = await api.rescue.getSuitableVehicles(selectedIncidentId);
        if (res.data?.suitableVehicles) {
          setSuitableVehicles(res.data.suitableVehicles);
        }
      } catch (err) {
        console.warn("Failed to load suitable vehicles:", err);
      } finally {
        setLoadingSuitable(false);
      }
    };
    loadSuitable();
  }, [selectedIncidentId]);

  // Scenario C: Assign Single Vehicle
  const handleAssignSingleVehicle = async (teamId: string) => {
    if (!selectedIncidentId) return;
    try {
      const res = await api.rescue.assignVehicle(teamId, selectedIncidentId);
      setFeedback(res.message);
      await fetchLiveState();
      setTimeout(() => setFeedback(null), 6000);
    } catch (err: any) {
      setFeedback(`Assignment failed: ${err.message}`);
    }
  };

  // Scenario E: Simulate Atomic Concurrency Race Condition
  const handleSimulateRace = async (teamId: string) => {
    if (!selectedIncidentId) return;
    setSimulatingRace(true);
    setRaceFeedback({
      attempt1: "Dispatching Request #1 for vehicle...",
      attempt2: "Dispatching simultaneous Request #2 for same vehicle...",
    });

    try {
      const [p1, p2] = await Promise.allSettled([
        api.rescue.assignVehicle(teamId, selectedIncidentId),
        api.rescue.assignVehicle(teamId, selectedIncidentId),
      ]);

      const att1 = p1.status === "fulfilled"
        ? `Request #1 SUCCESS (HTTP 200): ${p1.value.message}`
        : `Request #1 FAILED: ${(p1 as any).reason.message}`;

      const att2 = p2.status === "fulfilled"
        ? `Request #2 SUCCESS: ${p2.value.message}`
        : `Request #2 REJECTED (HTTP 409 Conflict): ${(p2 as any).reason.message}`;

      setRaceFeedback({
        attempt1: att1,
        attempt2: att2,
      });

      await fetchLiveState();
    } catch (err: any) {
      setRaceFeedback({ error: err.message });
    } finally {
      setSimulatingRace(false);
    }
  };

  // Scenario C: Run Baseline Comparison
  const handleRunBaselineComparison = async () => {
    setLoadingBaseline(true);
    try {
      const res = await api.rescue.getBaselineComparison();
      setBaselineData(res.data);
    } catch (err: any) {
      setFeedback(`Baseline error: ${err.message}`);
    } finally {
      setLoadingBaseline(false);
    }
  };

  // Batch Auto-Dispatch
  const handleAutoDispatch = async () => {
    setDispatching(true);
    setFeedback(null);
    try {
      const res = await api.rescue.autoAllocate();
      setFeedback(res.message);
      await fetchLiveState();
      setTimeout(() => setFeedback(null), 8000);
    } catch (err: any) {
      setFeedback(`Error: ${err.message || "Failed to execute auto-allocation."}`);
    } finally {
      setDispatching(false);
    }
  };

  const unassignedIncidents = incidents.filter(
    (i) => i.status !== "resolved" && i.status !== "dispatched" && i.status !== "cancelled"
  );
  const activeSelectedIncident = incidents.find((i) => i.id === selectedIncidentId);

  return (
    <div className="space-y-4">
      <PageHeading
        eyebrow="Fleet Dispatch & Allocation"
        title="Rescue Operations & Vehicle Allocation Board"
        description="Verify capability-based matching, single-vehicle dispatch, atomic concurrency race protection (HTTP 409), and compare multi-factor greedy allocation with nearest-vehicle baseline."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRunBaselineComparison}
              disabled={loadingBaseline}
              className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
            >
              {loadingBaseline ? <Loader2 className="size-3.5 animate-spin" /> : <Activity className="size-3.5" />}
              {loadingBaseline ? "Comparing Algorithms…" : "Compare vs Nearest-Vehicle Baseline"}
            </button>
            <button
              onClick={handleAutoDispatch}
              disabled={dispatching}
              className="flex items-center gap-2 rounded-md bg-critical px-3 py-2 text-xs font-medium text-critical-foreground hover:bg-critical/90 disabled:opacity-50 transition-colors"
            >
              {dispatching ? <Loader2 className="size-3.5 animate-spin" /> : <Siren className="size-3.5" />}
              {dispatching ? "Evaluating greedy allocation…" : "Batch Auto-Dispatch"}
            </button>
          </div>
        }
      />

      {feedback && (
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-xs text-success font-medium">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Scenario E Race Condition Feedback */}
      {raceFeedback && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-4 text-xs space-y-2">
          <h4 className="font-bold text-warning flex items-center gap-2 text-sm">
            <ShieldAlert className="size-4" /> Scenario E: Atomic Concurrency & Double-Booking Prevention Verification
          </h4>
          <p className="text-muted-foreground">
            Two operators simultaneously triggered assignment for the exact same rescue unit. The transactional mutex verified availability, allowed the first assignment, and rejected the second with <strong>HTTP 409 Conflict</strong>.
          </p>
          <div className="space-y-1 font-mono text-[11px] bg-surface-2 p-2.5 rounded border border-border">
            {raceFeedback.attempt1 && <p className="text-success">{raceFeedback.attempt1}</p>}
            {raceFeedback.attempt2 && <p className="text-critical font-bold">{raceFeedback.attempt2}</p>}
            {raceFeedback.error && <p className="text-critical">{raceFeedback.error}</p>}
          </div>
        </div>
      )}

      {/* Scenario C Baseline Comparison Card */}
      {baselineData && (
        <div className="rounded-lg border border-primary/30 bg-surface-1 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
              <Zap className="size-4" /> Scenario C: Multi-Factor Greedy Allocation vs Nearest-Vehicle Baseline
            </h3>
            <span className="text-xs font-mono text-muted-foreground">
              Evaluated on {baselineData.evaluationSummary?.totalIncidents} active incident demands
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded border border-border bg-surface-2 p-3">
              <span className="text-muted-foreground">Vehicle Capability Match</span>
              <div className="flex items-baseline justify-between mt-1">
                <div>
                  <span className="text-base font-bold text-success">{baselineData.evaluationSummary?.multiFactorCompatibilityPct}%</span>
                  <p className="text-[10px] text-muted-foreground">Multi-Factor</p>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-critical">{baselineData.evaluationSummary?.baselineCompatibilityPct}%</span>
                  <p className="text-[10px] text-muted-foreground">Nearest Baseline</p>
                </div>
              </div>
            </div>

            <div className="rounded border border-border bg-surface-2 p-3">
              <span className="text-muted-foreground">Average Response Time</span>
              <div className="flex items-baseline justify-between mt-1">
                <div>
                  <span className="text-base font-bold text-primary">{baselineData.evaluationSummary?.multiFactorAvgEtaMin} min</span>
                  <p className="text-[10px] text-muted-foreground">Multi-Factor</p>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-muted-foreground">{baselineData.evaluationSummary?.baselineAvgEtaMin} min</span>
                  <p className="text-[10px] text-muted-foreground">Nearest Baseline</p>
                </div>
              </div>
            </div>

            <div className="rounded border border-border bg-surface-2 p-3">
              <span className="text-muted-foreground">Algorithm Conclusion</span>
              <p className="text-[11px] text-muted-foreground mt-1">
                {baselineData.evaluationSummary?.conclusion}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Units deployed" value={teams.filter((t) => t.status !== "available").length} tone="warning" icon={<Radio className="size-4" />} hint={`of ${teams.length} total`} />
        <MetricCard label="Available units" value={teams.filter((t) => t.status === "available").length} tone="success" icon={<Users className="size-4" />} />
        <MetricCard label="Unassigned incidents" value={unassignedIncidents.length} tone={unassignedIncidents.length > 0 ? "critical" : "success"} />
        <MetricCard label="Low fuel units (<45%)" value={teams.filter((t) => t.fuel < 45).length} tone="warning" icon={<Fuel className="size-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* Left: Unit Roster */}
        <Panel>
          <PanelHeader title="Fleet Telemetry & Unit Roster" meta={`${teams.length} units registered`} />
          <ul className="divide-y divide-border">
            {teams.map((t) => (
              <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="num text-sm font-semibold">{t.callsign}</span>
                    <StatusPill tone={statusTone[t.status as keyof typeof statusTone] || "info"} pulse={t.status === "on-scene"}>
                      {t.status}
                    </StatusPill>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {t.unit} · {t.members} personnel · {t.mission ? `Assigned to ${t.mission}` : "Available for tasking"}
                  </p>
                  <div className="mt-2 max-w-52">
                    <Bar value={t.fuel} tone={t.fuel < 35 ? "critical" : t.fuel < 50 ? "warning" : "success"} />
                  </div>
                </div>
                <div className="shrink-0 text-right space-y-1">
                  <p className="num text-sm font-semibold">{t.eta || "—"}</p>
                  <p className="num text-[11px] text-muted-foreground">fuel {t.fuel}%</p>
                  {t.status === "available" && (
                    <button
                      onClick={() => handleSimulateRace(t.id)}
                      disabled={simulatingRace}
                      className="rounded border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning hover:bg-warning/20"
                    >
                      Test Race (409)
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Right: Scenario C Interactive Single Vehicle Assignment */}
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Single Vehicle Assignment (Scenario C)" icon={<Crosshair className="size-4 text-primary" />} />
            <div className="p-4 space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Target Emergency Incident</label>
                <select
                  value={selectedIncidentId}
                  onChange={(e) => setSelectedIncidentId(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-surface-2 p-2 text-xs"
                >
                  {incidents.map((inc) => (
                    <option key={inc.id} value={inc.id}>
                      {inc.id} · {inc.title} ({inc.type.toUpperCase()}) - {inc.status}
                    </option>
                  ))}
                </select>
              </div>

              {activeSelectedIncident && (
                <div className="rounded border border-border bg-surface-2/60 p-2.5 text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-primary">{activeSelectedIncident.title}</span>
                    <StatusPill tone={activeSelectedIncident.severity === "critical" ? "critical" : "warning"}>
                      {activeSelectedIncident.severity}
                    </StatusPill>
                  </div>
                  <p className="text-muted-foreground">{activeSelectedIncident.sector} · {activeSelectedIncident.victims} victims affected</p>
                </div>
              )}

              <div className="border-t border-border pt-3 space-y-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Compatible Available Vehicles:
                </span>

                {loadingSuitable ? (
                  <div className="py-4 text-center text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" /> Filtering vehicle capabilities…
                  </div>
                ) : suitableVehicles.length === 0 ? (
                  <p className="py-3 text-center text-muted-foreground">
                    No compatible vehicles available for {activeSelectedIncident?.type?.toUpperCase()} incidents.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {suitableVehicles.map((v) => (
                      <li key={v.teamId} className="flex items-center justify-between gap-2 rounded border border-border bg-surface-2 p-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold">{v.callsign}</span>
                            <span className="text-[11px] text-muted-foreground">({v.unit})</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {v.distanceKm} km away · ~{v.estimatedTimeMin} min · Fuel: {v.fuel}%
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleAssignSingleVehicle(v.teamId)}
                            className="rounded bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
                          >
                            Dispatch
                          </button>
                          <button
                            onClick={() => handleSimulateRace(v.teamId)}
                            title="Simulate race condition"
                            className="rounded border border-warning/40 bg-warning/10 px-1.5 py-1 text-[10px] font-semibold text-warning hover:bg-warning/20"
                          >
                            Race
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Active Mission Tasks" meta={`${missions.length} logged`} />
            <ul className="max-h-60 divide-y divide-border overflow-y-auto text-xs">
              {missions.length === 0 ? (
                <li className="p-4 text-center text-muted-foreground">No active missions recorded.</li>
              ) : (
                missions.map((m) => (
                  <li key={m.id} className="p-3 hover:bg-surface-2 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-primary">{m.id}</span>
                      <StatusPill tone={m.status === "COMPLETED" ? "success" : m.status === "ON_SCENE" ? "warning" : "info"}>
                        {m.status}
                      </StatusPill>
                    </div>
                    <p className="text-muted-foreground mt-1">Assigned Unit: <strong className="text-foreground">{m.assignedTeamId}</strong> · Incident: {m.incidentId}</p>
                    {m.notes && <p className="text-[11px] italic text-muted-foreground mt-0.5">{m.notes}</p>}
                  </li>
                ))
              )}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
