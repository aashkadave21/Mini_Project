import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  Ambulance,
  ArrowUpRight,
  Building2,
  Layers,
  Radio,
  Route as RouteIcon,
  Signal,
  Timer,
  TriangleAlert,
  Users,
  WifiOff,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  X,
  Zap,
  Crosshair,
  Activity,
  Clock,
  ShieldCheck,
  Flame,
  Waves,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar as RBar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MapCanvas } from "@/components/sdrep/MapCanvas";
import { ModalPortal } from "@/components/sdrep/ModalPortal";
import { Bar, MetricCard, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/control/")(
  {
    head: () => ({
      meta: [
        { title: "Disaster Control Centre — SDREP Operations Dashboard" },
        {
          name: "description",
          content:
            "Live command-centre dashboard: interactive hazard map, active incidents, rescue team status, shelter capacity and evacuation analytics.",
        },
        { property: "og:title", content: "Disaster Control Centre — SDREP" },
        {
          property: "og:description",
          content: "Real-time situational awareness for disaster response operations.",
        },
      ],
    }),
    component: ControlDashboard,
  }
);

const axis = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 10,
  tickLine: false,
  axisLine: false,
};

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--color-popover-foreground)",
};

function ControlDashboard() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [shelters, setShelters] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [roads, setRoads] = useState<any[]>([]);
  const [priorityQueue, setPriorityQueue] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // Interactive Incident Drawer & Scenario Evaluation State
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [compatibleVehicles, setCompatibleVehicles] = useState<any[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [dispatchFeedback, setDispatchFeedback] = useState<string | null>(null);
  const [raceFeedback, setRaceFeedback] = useState<{ attempt1?: string; attempt2?: string; error?: string } | null>(null);
  const [facilityRecommendation, setFacilityRecommendation] = useState<any | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [incRes, shelterRes, hospitalRes, teamRes, analyticsRes, statsRes, routeRes, queueRes] = await Promise.allSettled([
        api.public.getIncidents(),
        api.shelter.getAll(),
        api.hospital.getAll(),
        api.rescue.getAllTeams(),
        api.analytics.getOverview(),
        api.public.getStatistics(),
        api.evacuation.getCorridors(),
        api.incidents.getPriorityQueue(),
      ]);

      if (incRes.status === "fulfilled" && incRes.value.data) setIncidents(incRes.value.data);
      if (shelterRes.status === "fulfilled" && shelterRes.value.data) setShelters(shelterRes.value.data);
      if (hospitalRes.status === "fulfilled" && hospitalRes.value.data) setHospitals(hospitalRes.value.data);
      if (teamRes.status === "fulfilled" && teamRes.value.data) setTeams(teamRes.value.data);
      if (analyticsRes.status === "fulfilled" && analyticsRes.value.data) setAnalytics(analyticsRes.value.data);
      if (statsRes.status === "fulfilled" && statsRes.value.data) setStats(statsRes.value.data);
      if (routeRes.status === "fulfilled" && routeRes.value.data) {
        setRoutes(routeRes.value.data.routes || []);
        setRoads(routeRes.value.data.roads || []);
      }
      if (queueRes.status === "fulfilled" && queueRes.value.data) setPriorityQueue(queueRes.value.data);

      setLastUpdated(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (err) {
      console.error("Dashboard data fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectIncident = async (inc: any) => {
    setSelectedIncident(inc);
    setDispatchFeedback(null);
    setRaceFeedback(null);
    setFacilityRecommendation(null);
    setLoadingVehicles(true);
    try {
      const res = await api.rescue.getSuitableVehicles(inc.id);
      if (res.data?.suitableVehicles) {
        setCompatibleVehicles(res.data.suitableVehicles);
      }
    } catch (err: any) {
      console.warn("Failed to load suitable vehicles for incident:", err);
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleAssignVehicle = async (teamId: string) => {
    if (!selectedIncident) return;
    try {
      const res = await api.rescue.assignVehicle(teamId, selectedIncident.id);
      setDispatchFeedback(res.message);
      await fetchAll();
      handleSelectIncident({ ...selectedIncident, status: "dispatched" });
    } catch (err: any) {
      setDispatchFeedback(`Assignment error: ${err.message}`);
    }
  };

  const handleSimulateRaceCondition = async (teamId: string) => {
    if (!selectedIncident) return;
    setRaceFeedback({ attempt1: "Firing simultaneous Request 1...", attempt2: "Firing simultaneous Request 2..." });
    try {
      const [p1, p2] = await Promise.allSettled([
        api.rescue.assignVehicle(teamId, selectedIncident.id),
        api.rescue.assignVehicle(teamId, selectedIncident.id),
      ]);

      const att1 = p1.status === "fulfilled" ? `Req #1 SUCCESS (HTTP 200): ${p1.value.message}` : `Req #1 FAILED: ${(p1 as any).reason.message}`;
      const att2 = p2.status === "fulfilled" ? `Req #2 SUCCESS: ${p2.value.message}` : `Req #2 REJECTED (HTTP 409 Conflict): ${(p2 as any).reason.message}`;

      setRaceFeedback({
        attempt1: att1,
        attempt2: att2,
      });
      await fetchAll();
    } catch (err: any) {
      setRaceFeedback({ error: err.message });
    }
  };

  const handleFindFacility = async () => {
    if (!selectedIncident) return;
    try {
      const res = await api.facilities.findSuitable({
        type: "HOSPITAL",
        location: selectedIncident.pos,
        requiredBeds: selectedIncident.victims || 1,
      });
      setFacilityRecommendation(res.data);
    } catch (err: any) {
      setFacilityRecommendation({ error: err.message });
    }
  };


  useEffect(() => {
    fetchAll();

    // Set up SSE for real-time updates
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("http://localhost:3001/api/v1/events?role=CONTROL_CENTRE_ADMIN");
      eventSource.onmessage = () => {
        // Re-fetch on any backend event
        fetchAll();
      };
      eventSource.addEventListener("INCIDENT_UPDATED", () => fetchAll());
      eventSource.addEventListener("MISSION_UPDATED", () => fetchAll());
      eventSource.addEventListener("SHELTER_OCCUPANCY_CHANGED", () => fetchAll());
      eventSource.addEventListener("HOSPITAL_DIVERSION_CHANGED", () => fetchAll());
      eventSource.addEventListener("SOS_ALERT", () => fetchAll());
    } catch {
      // SSE not available, fall back to polling
    }

    // Poll every 30 seconds as fallback
    const interval = setInterval(fetchAll, 30000);

    return () => {
      eventSource?.close();
      clearInterval(interval);
    };
  }, [fetchAll]);

  const critical = incidents.filter((i) => i.severity === "critical" && i.status !== "resolved");
  const activeIncidents = incidents.filter((i) => i.status !== "resolved" && i.status !== "cancelled");

  const casualtyColors = ["var(--color-success)", "var(--color-warning)", "var(--color-critical)", "var(--color-muted-foreground)"];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="size-5 animate-spin" />
        Loading operational dashboard…
      </div>
    );
  }

  const deployedTeams = teams.filter((t) => t.status !== "available").length;

  // Build dynamic route recommendations from actual evacuation corridors
  const routeRecommendations = routes.slice(0, 3).map((r: any) => {
    const hasBlockedSegment = r.segments?.some((segId: string) => {
      // We'd need road state here; for now use hazard exposure
      return false;
    });
    let tone: "critical" | "warning" | "success" = "success";
    let note = `${r.label} — ${r.distanceKm?.toFixed(1) || "?"} km, est. ${r.travelTimeMin || "?"} min`;
    if (r.hazardExposureScore > 5) {
      tone = "critical";
      note += ` — HIGH hazard exposure (score ${r.hazardExposureScore?.toFixed(1)})`;
    } else if (r.hazardExposureScore > 2) {
      tone = "warning";
      note += ` — moderate hazard exposure`;
    }
    return { r: r.id, note, tone };
  });

  // Fall back to static recommendations only if no routes loaded
  const displayRoutes =
    routeRecommendations.length > 0
      ? routeRecommendations
      : [
          { r: "No routes", note: "No evacuation routes computed yet. Use the Evacuation tab to recalculate.", tone: "warning" as const },
        ];

  return (
    <div className="space-y-4">
      {/* Last updated indicator */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Live operational data</span>
        <button
          onClick={fetchAll}
          className="flex items-center gap-1 rounded px-2 py-1 hover:bg-surface-2 transition-colors"
        >
          <RefreshCw className="size-3" />
          {lastUpdated ? `Updated ${lastUpdated}` : "Refresh"}
        </button>
      </div>

      {/* Metric strip — all values from real API data */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Active incidents"
          value={activeIncidents.length}
          tone="critical"
          icon={<TriangleAlert className="size-4" />}
          hint={`${critical.length} critical`}
        />
        <MetricCard
          label="People evacuated"
          value={stats ? stats.peopleEvacuated.toLocaleString() : "—"}
          tone="success"
          icon={<Users className="size-4" />}
          hint="total shelter occupancy"
        />
        <MetricCard
          label="Pending evacuation"
          value={stats ? stats.pendingEvacuation.toLocaleString() : "—"}
          tone="warning"
          icon={<RouteIcon className="size-4" />}
          hint="incoming + open SOS"
        />
        <MetricCard
          label="Teams deployed"
          value={`${deployedTeams}/${teams.length}`}
          tone="info"
          icon={<Radio className="size-4" />}
          hint={`${teams.length - deployedTeams} available`}
        />
        <MetricCard
          label="Avg response"
          value={stats?.avgResponseMinutes !== null && stats?.avgResponseMinutes !== undefined ? String(stats.avgResponseMinutes) : "—"}
          unit="min"
          tone="warning"
          icon={<Timer className="size-4" />}
          hint="from completed missions"
        />
        <MetricCard
          label="Shelter load"
          value={stats ? String(stats.shelterLoadPercent) : "—"}
          unit="%"
          tone={stats?.shelterLoadPercent >= 90 ? "critical" : stats?.shelterLoadPercent >= 70 ? "warning" : "success"}
          icon={<Building2 className="size-4" />}
          hint={`${shelters.filter((s) => s.status === "near-full" || s.status === "full").length} near/full capacity`}
        />
      </div>

      {/* Map + intelligence */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Live operational map"
            meta={`${lastUpdated ? `updated ${lastUpdated}` : "loading"}`}
            icon={<Layers className="size-4" />}
            action={
              <div className="hidden items-center gap-1.5 sm:flex">
                {["Hazards", "Roads", "Routes", "Assets"].map((l) => (
                  <span
                    key={l}
                    className="rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    {l}
                  </span>
                ))}
              </div>
            }
          />
          <div className="p-2">
            <MapCanvas
              height="clamp(360px, 52vh, 620px)"
              incidents={incidents}
              roads={roads}
              routes={routes}
              shelters={shelters}
              hospitals={hospitals}
              teams={teams}
              onIncidentClick={handleSelectIncident}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
            {[
              ["bg-critical", "Blocked road / critical incident"],
              ["bg-flood", "Flooded segment / flood zone"],
              ["bg-fire", "Fire perimeter"],
              ["bg-warning", "Congestion"],
              ["bg-accent", "Evacuation route & assets"],
              ["bg-success", "Clear / shelter open"],
            ].map(([c, label]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${c}`} aria-hidden />
                {label}
              </span>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          {/* Priority Queue (Scenario B) */}
          <Panel>
            <PanelHeader
              title="Priority Queue (Scenario B)"
              meta={`${priorityQueue.length} ranked`}
              icon={<Zap className="size-4 text-warning" />}
              action={
                <button
                  onClick={fetchAll}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Recalculate
                </button>
              }
            />
            <div className="p-3 text-[11px] text-muted-foreground border-b border-border bg-surface-2/40">
              Formula: Severity (Crit: 100, Warn: 50, Info: 20) + (Victims × 2) + (Age × 0.75/m). Tie-breaker: Earliest arrival.
            </div>
            <ul className="max-h-60 divide-y divide-border overflow-y-auto">
              {priorityQueue.length === 0 ? (
                <li className="p-4 text-center text-xs text-muted-foreground">No pending items in queue.</li>
              ) : (
                priorityQueue.map((item, idx) => (
                  <li
                    key={item.id}
                    onClick={() => handleSelectIncident(item)}
                    className="cursor-pointer px-3 py-2.5 hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1 font-mono text-[11px] font-bold">
                        <span className="flex size-4 items-center justify-center rounded-full bg-primary/20 text-[10px] text-primary">
                          #{idx + 1}
                        </span>
                        {item.id}
                      </span>
                      <span className="font-mono text-xs font-bold text-primary">
                        {item.priorityScore} pts
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs font-medium">{item.title}</p>
                    <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{item.severity?.toUpperCase()} · {item.victims} victims</span>
                      <span>Age: {item.waitMinutes ?? item.ageMinutes ?? 0}m (+{(item.waitingTimeScore ?? item.scoreBreakdown?.starvationAgingBonus ?? 0).toFixed(1)} pts)</span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Active incidents" meta={`${critical.length} critical`} icon={<TriangleAlert className="size-4" />} />
            <ul className="max-h-56 divide-y divide-border overflow-y-auto">
              {activeIncidents.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">No active incidents.</li>
              ) : (
                activeIncidents.map((i) => (
                  <li
                    key={i.id}
                    onClick={() => handleSelectIncident(i)}
                    className="cursor-pointer px-4 py-3 transition-colors hover:bg-surface-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="num text-[11px] text-muted-foreground">{i.id}</span>
                      <StatusPill
                        tone={i.severity === "critical" ? "critical" : i.severity === "warning" ? "warning" : "info"}
                        pulse={i.severity === "critical"}
                      >
                        {i.severity}
                      </StatusPill>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">{i.title}</p>
                    <p className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="truncate">{i.sector}</span>
                      <span className="num shrink-0">{i.victims} affected · {i.reported}</span>
                    </p>
                  </li>
                ))
              )}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Route recommendations" icon={<RouteIcon className="size-4" />} />
            <ul className="divide-y divide-border">
              {displayRoutes.map((x) => (
                <li key={x.r} className="flex items-start gap-3 px-4 py-3">
                  <StatusPill tone={x.tone}>{x.r}</StatusPill>
                  <p className="min-w-0 flex-1 text-xs text-muted-foreground">{x.note}</p>
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Shelter capacity" icon={<Building2 className="size-4" />} />
            <ul className="space-y-3 p-4">
              {shelters.slice(0, 4).map((s) => {
                const pct = s.capacity > 0 ? (s.occupancy / s.capacity) * 100 : 0;
                return (
                  <li key={s.id}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{s.name}</span>
                      <span className="num shrink-0 text-muted-foreground">
                        {s.occupancy}/{s.capacity}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <Bar value={pct} tone={pct >= 99 ? "critical" : pct >= 75 ? "warning" : "success"} />
                    </div>
                  </li>
                );
              })}
              {shelters.length === 0 && (
                <li className="text-center text-xs text-muted-foreground">Loading shelter data…</li>
              )}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="System warnings" icon={<AlertTriangle className="size-4" />} />
            <ul className="divide-y divide-border text-xs">
              {hospitals.filter((h) => h.diversion).map((h) => (
                <li key={h.id} className="flex items-center gap-2 px-4 py-2.5">
                  <Ambulance className="size-3.5 shrink-0 text-critical" />
                  <span className="min-w-0 flex-1 truncate">{h.name} — DIVERSION active{h.diversionReason ? `: ${h.diversionReason}` : ""}</span>
                </li>
              ))}
              {hospitals.filter((h) => h.triageLoad > 85).map((h) => (
                <li key={`load-${h.id}`} className="flex items-center gap-2 px-4 py-2.5">
                  <Ambulance className="size-3.5 shrink-0 text-warning" />
                  <span className="min-w-0 flex-1 truncate">{h.name} at {h.triageLoad}% triage load</span>
                </li>
              ))}
              {teams.filter((t) => t.fuel < 25).map((t) => (
                <li key={`fuel-${t.id}`} className="flex items-center gap-2 px-4 py-2.5">
                  <Signal className="size-3.5 shrink-0 text-warning" />
                  <span className="min-w-0 flex-1 truncate">{t.callsign} — low fuel ({t.fuel}%)</span>
                </li>
              ))}
              {shelters.filter((s) => s.status === "full").map((s) => (
                <li key={`full-${s.id}`} className="flex items-center gap-2 px-4 py-2.5">
                  <WifiOff className="size-3.5 shrink-0 text-critical" />
                  <span className="min-w-0 flex-1 truncate">{s.name} — AT CAPACITY (no new intake)</span>
                </li>
              ))}
              {hospitals.filter((h) => !h.diversion && h.triageLoad <= 85).length === hospitals.length &&
               teams.filter((t) => t.fuel < 25).length === 0 &&
               shelters.filter((s) => s.status === "full").length === 0 && (
                <li className="px-4 py-2.5 text-muted-foreground text-center">No active system warnings.</li>
              )}
            </ul>
          </Panel>
        </div>
      </div>

      {/* Analytics — all from backend */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <PanelHeader title="Congestion trend" meta="derived from road states" />
          <div className="h-40 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.congestionTrend || []}>
                <CartesianGrid stroke="var(--color-grid-line)" vertical={false} />
                <XAxis dataKey="t" {...axis} />
                <YAxis {...axis} width={26} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="congestion" stroke="var(--color-warning)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="throughput" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Evacuation progress" meta={stats ? `${stats.shelterLoadPercent}% capacity used` : ""} />
          <div className="h-40 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.evacuationProgress || []}>
                <defs>
                  <linearGradient id="evac" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-grid-line)" vertical={false} />
                <XAxis dataKey="t" {...axis} />
                <YAxis {...axis} width={34} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="evacuated" stroke="var(--color-success)" fill="url(#evac)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Response time by sector" meta="minutes (completed missions)" />
          <div className="h-40 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.responseTimes || []}>
                <CartesianGrid stroke="var(--color-grid-line)" vertical={false} />
                <XAxis dataKey="sector" {...axis} />
                <YAxis {...axis} width={26} />
                <Tooltip contentStyle={tooltipStyle} />
                <RBar dataKey="minutes" radius={[4, 4, 0, 0]} fill="var(--color-primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Triage distribution"
            meta={analytics?.totalCasualties ? `${analytics.totalCasualties} assessed` : "from triage records"}
          />
          <div className="flex h-40 items-center p-3">
            {analytics?.casualtyStats && analytics.casualtyStats.some((c: any) => c.value > 0) ? (
              <>
                <ResponsiveContainer width="55%" height="100%">
                  <PieChart>
                    <Pie data={analytics.casualtyStats} dataKey="value" innerRadius={30} outerRadius={52} paddingAngle={3} stroke="none">
                      {analytics.casualtyStats.map((_: any, idx: number) => (
                        <Cell key={idx} fill={casualtyColors[idx]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="flex-1 space-y-1.5 text-[11px]">
                  {analytics.casualtyStats.map((c: any, idx: number) => (
                    <li key={c.name} className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: casualtyColors[idx] }} aria-hidden />
                      <span className="flex-1 text-muted-foreground">{c.name}</span>
                      <span className="num">{c.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="w-full text-center text-xs text-muted-foreground">No triage cases recorded yet.</p>
            )}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Hospital readiness" icon={<Ambulance className="size-4" />} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {["Facility", "Beds free", "ICU free", "Incoming", "Triage load", "Status"].map((h) => (
                  <th key={h} className="label-eyebrow px-4 py-2 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {hospitals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-sm text-muted-foreground">
                    Loading hospital data…
                  </td>
                </tr>
              ) : (
                hospitals.map((h) => (
                  <tr key={h.id} className="transition-colors hover:bg-surface-2">
                    <td className="px-4 py-2.5">
                      {h.name}
                      {h.diversion && <span className="ml-2 rounded-sm bg-critical/20 px-1.5 py-0.5 text-[10px] font-bold text-critical">DIVERSION</span>}
                    </td>
                    <td className="num px-4 py-2.5">{h.bedsFree}/{h.beds}</td>
                    <td className="num px-4 py-2.5">{h.icuFree}/{h.icu}</td>
                    <td className="num px-4 py-2.5">{h.incoming}</td>
                    <td className="px-4 py-2.5">
                      <div className="w-28">
                        <Bar value={h.triageLoad} tone={h.triageLoad > 90 ? "critical" : h.triageLoad > 70 ? "warning" : "success"} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone={h.diversion ? "critical" : h.triageLoad > 90 ? "critical" : h.triageLoad > 70 ? "warning" : "success"}>
                        {h.diversion ? "Diverting" : h.triageLoad > 90 ? "Saturated" : h.triageLoad > 70 ? "Strained" : "Accepting"}
                      </StatusPill>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Incident Action Drawer / Modal (Scenarios C, E, F) */}
      <ModalPortal
        isOpen={Boolean(selectedIncident)}
        onClose={() => {
          setSelectedIncident(null);
          setDispatchFeedback(null);
          setRaceFeedback(null);
        }}
        title={
          selectedIncident ? (
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary">{selectedIncident.id}</span>
                <StatusPill tone={selectedIncident.severity === "critical" ? "critical" : "warning"}>
                  {selectedIncident.severity}
                </StatusPill>
                <StatusPill tone={selectedIncident.status === "dispatched" ? "info" : "warning"}>
                  {selectedIncident.status}
                </StatusPill>
                {selectedIncident.priorityScore !== undefined && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">
                    Priority #{selectedIncident.priorityRank || "—"} · {selectedIncident.priorityScore} pts (+{selectedIncident.waitingTimeScore ?? 0} aging)
                  </span>
                )}
              </div>
              <h3 className="mt-1 text-lg font-bold">{selectedIncident.title}</h3>
            </div>
          ) : undefined
        }
        description={
          selectedIncident ? (
            <div>
              <p className="text-xs text-muted-foreground">
                {selectedIncident.sector} · Coordinates: [{selectedIncident.pos?.[0]?.toFixed(4)}, {selectedIncident.pos?.[1]?.toFixed(4)}] · {selectedIncident.victims} affected
              </p>
              {selectedIncident.description && (
                <p className="mt-1 text-xs italic text-foreground/80">{selectedIncident.description}</p>
              )}
            </div>
          ) : undefined
        }
        maxWidth="max-w-2xl"
      >
        {selectedIncident && (
          <>
            {dispatchFeedback && (
              <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-xs text-success">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>{dispatchFeedback}</span>
              </div>
            )}

            {raceFeedback && (
              <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs space-y-1">
                <p className="font-semibold text-warning flex items-center gap-1.5">
                  <ShieldAlert className="size-4" /> Scenario E: Atomic Concurrency & Double-Booking Test
                </p>
                {raceFeedback.attempt1 && <p className="text-muted-foreground font-mono">{raceFeedback.attempt1}</p>}
                {raceFeedback.attempt2 && <p className="text-critical font-mono font-semibold">{raceFeedback.attempt2}</p>}
                {raceFeedback.error && <p className="text-critical">{raceFeedback.error}</p>}
              </div>
            )}

            {/* Scenario C: Vehicle Compatibility & Single Assignment */}
            <div className="space-y-2 border border-border rounded-lg p-3 bg-surface-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Radio className="size-3.5" /> Compatible Vehicles (Scenario C)
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  Incident Type: <strong className="text-primary">{selectedIncident.type?.toUpperCase()}</strong>
                </span>
              </div>

              {loadingVehicles ? (
                <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <RefreshCw className="size-3.5 animate-spin" /> Evaluating vehicle capability matrix...
                </div>
              ) : compatibleVehicles.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">No compatible vehicles currently available in fleet.</p>
              ) : (
                <div className="space-y-2">
                  {compatibleVehicles.map((v) => (
                    <div key={v.teamId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface p-2.5 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{v.callsign}</span>
                          <span className="text-muted-foreground">({v.unit})</span>
                          <StatusPill tone="success">Equipped</StatusPill>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Distance: {v.distanceKm} km · ETA: ~{v.estimatedTimeMin} min · Fuel: {v.fuel}%
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAssignVehicle(v.teamId)}
                          className="rounded bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                        >
                          Assign Vehicle
                        </button>
                        <button
                          onClick={() => handleSimulateRaceCondition(v.teamId)}
                          title="Simulate 2 operators simultaneously assigning this exact unit"
                          className="rounded border border-warning/50 bg-warning/10 px-2.5 py-1.5 font-medium text-warning hover:bg-warning/20 transition-colors cursor-pointer"
                        >
                          Test Race (409)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scenario F: Facility Selection / Diversion Check */}
            <div className="space-y-2 border border-border rounded-lg p-3 bg-surface-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="size-3.5" /> Emergency Facility Routing (Scenario F)
                </h4>
                <button
                  onClick={handleFindFacility}
                  className="text-xs text-primary font-medium hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Crosshair className="size-3" /> Find Best Hospital / Shelter
                </button>
              </div>

              {facilityRecommendation && (
                <div className="rounded border border-border bg-surface p-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{facilityRecommendation.facility?.name}</span>
                    <StatusPill tone={facilityRecommendation.diversionWarning ? "warning" : "success"}>
                      {facilityRecommendation.diversionWarning ? "Diverted" : "Direct Routing"}
                    </StatusPill>
                  </div>
                  <p className="text-muted-foreground">{facilityRecommendation.rationale}</p>
                  {facilityRecommendation.diversionWarning && (
                    <p className="text-critical text-[11px] font-medium">⚠️ {facilityRecommendation.diversionWarning}</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </ModalPortal>
    </div>
  );
}

