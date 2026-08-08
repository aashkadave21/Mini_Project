import { createFileRoute } from "@tanstack/react-router";
import { PublicFooter, PublicNav } from "@/components/sdrep/PublicChrome";
import { MapCanvas } from "@/components/sdrep/MapCanvas";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";
import { incidents, shelters } from "@/lib/sdrep-data";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "Live Disaster Status — Public Feed | SDREP" },
      { name: "description", content: "Public situational feed: active incidents, evacuation orders by sector, shelter availability and road closures, updated continuously." },
      { property: "og:title", content: "Live Disaster Status — SDREP" },
      { property: "og:description", content: "Public feed of active incidents, shelters and road closures." },
    ],
  }),
  component: StatusPage,
});

function StatusPage() {
  return (
    <div className="min-h-dvh">
      <PublicNav />
      <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-10 sm:px-6">
        <PageHeading eyebrow="Public feed" title="Live disaster status" description="Cyclone Marut · Red alert in force. Information is refreshed every 60 seconds." actions={<StatusPill tone="critical" pulse>Red alert</StatusPill>} />

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard label="Active incidents" value={incidents.length} tone="critical" />
          <MetricCard label="Shelters open" value={shelters.filter((s) => s.status !== "full").length} tone="success" />
          <MetricCard label="Roads closed" value="2" tone="warning" />
          <MetricCard label="Rainfall" value="88" unit="mm/h" tone="info" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Panel className="overflow-hidden">
            <PanelHeader title="Public hazard map" meta="hazards & shelters only" />
            <div className="p-2"><MapCanvas height="clamp(320px, 46vh, 520px)" layers={{ teams: false, incidents: true, hospitals: true }} /></div>
          </Panel>

          <div className="space-y-4">
            <Panel>
              <PanelHeader title="Current incidents" />
              <ul className="divide-y divide-border">
                {incidents.map((i) => (
                  <li key={i.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm">{i.title}</span>
                      <StatusPill tone={i.severity === "critical" ? "critical" : i.severity === "warning" ? "warning" : "info"}>{i.severity}</StatusPill>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{i.sector}</p>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel>
              <PanelHeader title="Shelter availability" />
              <ul className="space-y-3 p-4">
                {shelters.map((s) => {
                  const pct = (s.occupancy / s.capacity) * 100;
                  return (
                    <li key={s.id}>
                      <p className="flex justify-between gap-2 text-xs"><span className="truncate">{s.name}</span><span className="num shrink-0 text-muted-foreground">{Math.max(0, s.capacity - s.occupancy)} free</span></p>
                      <div className="mt-1.5"><Bar value={pct} tone={pct >= 99 ? "critical" : pct >= 75 ? "warning" : "success"} /></div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
