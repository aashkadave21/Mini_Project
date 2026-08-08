import { createFileRoute } from "@tanstack/react-router";
import { Boxes, Tent, Users, HeartPulse } from "lucide-react";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";
import { shelters } from "@/lib/sdrep-data";

export const Route = createFileRoute("/control/shelters")({
  head: () => ({
    meta: [
      { title: "Shelter Network — SDREP Control Centre" },
      { name: "description", content: "Monitor relief camp occupancy, incoming evacuees, medical availability and supply levels across the shelter network." },
      { property: "og:title", content: "Shelter Network — SDREP" },
      { property: "og:description", content: "Capacity and supply oversight for relief shelters." },
    ],
  }),
  component: SheltersPage,
});

function SheltersPage() {
  const total = shelters.reduce((a, s) => a + s.capacity, 0);
  const occupied = shelters.reduce((a, s) => a + s.occupancy, 0);

  return (
    <div className="space-y-4">
      <PageHeading eyebrow="Resources" title="Shelter network" description="Live occupancy, intake pressure and consumable stock for every registered relief camp." />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Total capacity" value={total.toLocaleString()} icon={<Tent className="size-4" />} tone="info" />
        <MetricCard label="Currently sheltered" value={occupied.toLocaleString()} tone="warning" icon={<Users className="size-4" />} delta={`${((occupied / total) * 100).toFixed(0)}%`} />
        <MetricCard label="Incoming evacuees" value={shelters.reduce((a, s) => a + s.incoming, 0)} tone="critical" hint="next 90 min" />
        <MetricCard label="Medical-capable camps" value={shelters.filter((s) => s.medical).length} tone="success" icon={<HeartPulse className="size-4" />} />
      </div>

      <Panel>
        <PanelHeader title="Shelter register" icon={<Boxes className="size-4" />} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {["ID", "Shelter", "Occupancy", "Load", "Incoming", "Medical", "Water", "Food", "Status"].map((h) => (
                  <th key={h} className="label-eyebrow px-4 py-2 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shelters.map((s, i) => {
                const pct = (s.occupancy / s.capacity) * 100;
                const water = [62, 18, 88, 74, 33][i]!;
                const food = [55, 22, 79, 81, 41][i]!;
                return (
                  <tr key={s.id} className="hover:bg-surface-2">
                    <td className="num px-4 py-3 text-muted-foreground">{s.id}</td>
                    <td className="px-4 py-3">{s.name}</td>
                    <td className="num px-4 py-3">{s.occupancy}/{s.capacity}</td>
                    <td className="px-4 py-3"><div className="w-24"><Bar value={pct} tone={pct >= 99 ? "critical" : pct >= 75 ? "warning" : "success"} /></div></td>
                    <td className="num px-4 py-3">{s.incoming}</td>
                    <td className="px-4 py-3">{s.medical ? <StatusPill tone="success">Yes</StatusPill> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3"><div className="w-20"><Bar value={water} tone={water < 30 ? "critical" : water < 60 ? "warning" : "success"} /></div></td>
                    <td className="px-4 py-3"><div className="w-20"><Bar value={food} tone={food < 30 ? "critical" : food < 60 ? "warning" : "success"} /></div></td>
                    <td className="px-4 py-3">
                      <StatusPill tone={s.status === "full" ? "critical" : s.status === "near-full" ? "warning" : "success"}>{s.status}</StatusPill>
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
