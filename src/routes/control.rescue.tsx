import { createFileRoute } from "@tanstack/react-router";
import { Fuel, Radio, Siren, Users } from "lucide-react";
import { MapCanvas } from "@/components/sdrep/MapCanvas";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";
import { dispatchLog, incidents, teams } from "@/lib/sdrep-data";

export const Route = createFileRoute("/control/rescue")({
  head: () => ({
    meta: [
      { title: "Rescue Operations — SDREP Control Centre" },
      { name: "description", content: "Dispatch board for rescue teams: mission assignment, unit readiness, fuel state and live dispatch log." },
      { property: "og:title", content: "Rescue Operations — SDREP" },
      { property: "og:description", content: "Dispatch and monitor rescue units in real time." },
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
  return (
    <div className="space-y-4">
      <PageHeading
        eyebrow="Dispatch"
        title="Rescue operations board"
        description="Assign units to incidents, monitor readiness and track vehicle endurance."
        actions={
          <button className="flex items-center gap-2 rounded-md bg-critical px-3 py-2 text-xs font-medium text-critical-foreground">
            <Siren className="size-3.5" /> Emergency dispatch
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Units deployed" value="5" tone="warning" icon={<Radio className="size-4" />} hint="of 6 total" />
        <MetricCard label="Personnel in field" value="30" tone="info" icon={<Users className="size-4" />} />
        <MetricCard label="Unassigned incidents" value={incidents.filter((i) => i.status === "unassigned").length} tone="critical" />
        <MetricCard label="Low fuel units" value="2" tone="warning" icon={<Fuel className="size-4" />} hint="< 45%" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Panel>
          <PanelHeader title="Unit roster" meta="live telemetry" />
          <ul className="divide-y divide-border">
            {teams.map((t) => (
              <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="num text-sm font-semibold">{t.callsign}</span>
                    <StatusPill tone={statusTone[t.status]} pulse={t.status === "on-scene"}>{t.status}</StatusPill>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {t.unit} · {t.members} personnel · {t.mission ? `Mission ${t.mission}` : "Awaiting tasking"}
                  </p>
                  <div className="mt-2 max-w-52">
                    <Bar value={t.fuel} tone={t.fuel < 35 ? "critical" : t.fuel < 50 ? "warning" : "success"} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="num text-sm">{t.eta}</p>
                  <p className="num text-[11px] text-muted-foreground">fuel {t.fuel}%</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <PanelHeader title="Asset positions" />
            <div className="p-2">
              <MapCanvas height="300px" layers={{ hazards: true, teams: true, incidents: true, roads: false, routes: false, shelters: false, hospitals: false }} />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Dispatch log" meta="audit trail" />
            <ul className="max-h-72 divide-y divide-border overflow-y-auto text-xs">
              {dispatchLog.map((d) => (
                <li key={d.time} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="num shrink-0 text-muted-foreground">{d.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{d.action}</span>
                    <span className="num text-[10px] text-muted-foreground">{d.actor} → {d.target}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
