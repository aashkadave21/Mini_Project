import { createFileRoute } from "@tanstack/react-router";
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
import { Bar, MetricCard, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";
import {
  casualtyStats,
  congestionTrend,
  evacuationProgress,
  hospitals,
  incidents,
  responseTimes,
  shelters,
  teams,
} from "@/lib/sdrep-data";

export const Route = createFileRoute("/control/")({
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
});

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
  const critical = incidents.filter((i) => i.severity === "critical");
  const casualtyColors = ["var(--color-success)", "var(--color-warning)", "var(--color-critical)", "var(--color-muted-foreground)"];

  return (
    <div className="space-y-4">
      {/* Metric strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Active incidents" value={incidents.length} tone="critical" icon={<TriangleAlert className="size-4" />} delta="+2" hint="last 30 min" />
        <MetricCard label="People evacuated" value="9,350" tone="success" icon={<Users className="size-4" />} delta="+750" hint="last hour" />
        <MetricCard label="Pending evacuation" value="1,650" tone="warning" icon={<RouteIcon className="size-4" />} delta="-420" hint="Sector 7 focus" />
        <MetricCard label="Teams deployed" value={`${teams.filter((t) => t.status !== "available").length}/${teams.length}`} tone="info" icon={<Radio className="size-4" />} hint="1 available" />
        <MetricCard label="Avg response" value="9.8" unit="min" tone="warning" icon={<Timer className="size-4" />} delta="+1.4" hint="vs target 8.0" />
        <MetricCard label="Shelter load" value="78" unit="%" tone="warning" icon={<Building2 className="size-4" />} hint="2 near capacity" />
      </div>

      {/* Map + intelligence */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Live operational map"
            meta="12 layers · updated 3s ago"
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
            <MapCanvas height="clamp(360px, 52vh, 620px)" />
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
          <Panel>
            <PanelHeader title="Active incidents" meta={`${critical.length} critical`} icon={<TriangleAlert className="size-4" />} />
            <ul className="max-h-72 divide-y divide-border overflow-y-auto">
              {incidents.map((i) => (
                <li key={i.id} className="cursor-pointer px-4 py-3 transition-colors hover:bg-surface-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="num text-[11px] text-muted-foreground">{i.id}</span>
                    <StatusPill tone={i.severity === "critical" ? "critical" : i.severity === "warning" ? "warning" : "info"} pulse={i.severity === "critical"}>
                      {i.severity}
                    </StatusPill>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">{i.title}</p>
                  <p className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate">{i.sector}</span>
                    <span className="num shrink-0">{i.victims} affected · T+{i.reported}</span>
                  </p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Route recommendations" icon={<RouteIcon className="size-4" />} />
            <ul className="divide-y divide-border">
              {[
                { r: "Route A", note: "Riverside Arterial submerged — divert via Ridge Link", tone: "critical" as const },
                { r: "Route B", note: "Optimal, 14 min to North Ridge Sports Complex", tone: "success" as const },
                { r: "Route C", note: "Congestion 68% — stagger dispatch by 6 min", tone: "warning" as const },
              ].map((x) => (
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
                const pct = (s.occupancy / s.capacity) * 100;
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
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="System warnings" icon={<AlertTriangle className="size-4" />} />
            <ul className="divide-y divide-border text-xs">
              <li className="flex items-center gap-2 px-4 py-2.5">
                <Signal className="size-3.5 shrink-0 text-warning" />
                <span className="min-w-0 flex-1 truncate">Sector 18 mesh degraded — 2 nodes down</span>
              </li>
              <li className="flex items-center gap-2 px-4 py-2.5">
                <WifiOff className="size-3.5 shrink-0 text-critical" />
                <span className="min-w-0 flex-1 truncate">Dock Road CCTV cluster offline</span>
              </li>
              <li className="flex items-center gap-2 px-4 py-2.5">
                <Ambulance className="size-3.5 shrink-0 text-info" />
                <span className="min-w-0 flex-1 truncate">Riverside Trauma at 94% triage load</span>
              </li>
            </ul>
          </Panel>
        </div>
      </div>

      {/* Analytics */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <PanelHeader title="Congestion trend" meta="6 h" />
          <div className="h-40 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={congestionTrend}>
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
          <PanelHeader title="Evacuation progress" meta="85%" />
          <div className="h-40 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evacuationProgress}>
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
          <PanelHeader title="Response time by sector" meta="minutes" />
          <div className="h-40 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={responseTimes}>
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
          <PanelHeader title="Triage distribution" meta="1,191 assessed" />
          <div className="flex h-40 items-center p-3">
            <ResponsiveContainer width="55%" height="100%">
              <PieChart>
                <Pie data={casualtyStats} dataKey="value" innerRadius={30} outerRadius={52} paddingAngle={3} stroke="none">
                  {casualtyStats.map((_, idx) => (
                    <Cell key={idx} fill={casualtyColors[idx]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="flex-1 space-y-1.5 text-[11px]">
              {casualtyStats.map((c, idx) => (
                <li key={c.name} className="flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ background: casualtyColors[idx] }} aria-hidden />
                  <span className="flex-1 text-muted-foreground">{c.name}</span>
                  <span className="num">{c.value}</span>
                </li>
              ))}
            </ul>
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
              {hospitals.map((h) => (
                <tr key={h.id} className="transition-colors hover:bg-surface-2">
                  <td className="px-4 py-2.5">{h.name}</td>
                  <td className="num px-4 py-2.5">{h.bedsFree}/{h.beds}</td>
                  <td className="num px-4 py-2.5">{h.icuFree}/{h.icu}</td>
                  <td className="num px-4 py-2.5">{h.incoming}</td>
                  <td className="px-4 py-2.5">
                    <div className="w-28">
                      <Bar value={h.triageLoad} tone={h.triageLoad > 90 ? "critical" : h.triageLoad > 70 ? "warning" : "success"} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill tone={h.triageLoad > 90 ? "critical" : h.triageLoad > 70 ? "warning" : "success"}>
                      {h.triageLoad > 90 ? "Saturated" : h.triageLoad > 70 ? "Strained" : "Accepting"}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
