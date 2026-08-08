import { createFileRoute } from "@tanstack/react-router";
import { Layers, Locate, Ruler } from "lucide-react";
import { useState } from "react";
import { MapCanvas } from "@/components/sdrep/MapCanvas";
import { Panel, PanelHeader, PageHeading, StatusPill } from "@/components/sdrep/primitives";
import { hazardZones, roads, evacRoutes } from "@/lib/sdrep-data";

export const Route = createFileRoute("/control/map")({
  head: () => ({
    meta: [
      { title: "Live Hazard Map — SDREP Control Centre" },
      { name: "description", content: "Full-screen geospatial view of hazards, blocked roads, evacuation routes and deployed assets." },
      { property: "og:title", content: "Live Hazard Map — SDREP" },
      { property: "og:description", content: "Geospatial situational awareness for disaster operations." },
    ],
  }),
  component: LiveMapPage,
});

const layerKeys = ["hazards", "roads", "routes", "shelters", "hospitals", "teams", "incidents"] as const;

function LiveMapPage() {
  const [on, setOn] = useState<Record<(typeof layerKeys)[number], boolean>>({
    hazards: true, roads: true, routes: true, shelters: true, hospitals: true, teams: true, incidents: true,
  });

  return (
    <div className="space-y-4">
      <PageHeading
        eyebrow="Geospatial"
        title="Live hazard map"
        description="Toggle operational layers, inspect hazard perimeters and trace evacuation corridors."
        actions={
          <>
            <button className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs hover:bg-surface-3">
              <Ruler className="size-3.5" /> Measure
            </button>
            <button className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
              <Locate className="size-3.5" /> Recenter
            </button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Layers" icon={<Layers className="size-4" />} />
            <ul className="p-3">
              {layerKeys.map((k) => (
                <li key={k}>
                  <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-2 text-sm capitalize hover:bg-surface-2">
                    {k}
                    <input
                      type="checkbox"
                      checked={on[k]}
                      onChange={() => setOn((p) => ({ ...p, [k]: !p[k] }))}
                      className="size-4 accent-[var(--color-primary)]"
                    />
                  </label>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Road status" />
            <ul className="divide-y divide-border text-xs">
              {roads.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <span className="truncate">{r.name}</span>
                  <StatusPill tone={r.state === "blocked" ? "critical" : r.state === "flooded" ? "info" : r.state === "congested" ? "warning" : "success"}>
                    {r.state}
                  </StatusPill>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Hazard zones" />
            <ul className="divide-y divide-border text-xs">
              {hazardZones.map((z) => (
                <li key={z.id} className="px-4 py-2.5">
                  <p className="font-medium">{z.label}</p>
                  <p className="num text-muted-foreground">{z.id} · {z.kind}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel className="overflow-hidden">
          <PanelHeader title="Operational theatre" meta={`${evacRoutes.length} active corridors`} />
          <div className="p-2">
            <MapCanvas height="clamp(420px, 68vh, 800px)" layers={on} zoom={13} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
