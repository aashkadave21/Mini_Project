import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Fuel, Package, Radio, Siren } from "lucide-react";
import { MapCanvas } from "@/components/sdrep/MapCanvas";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";
import { incidents, roads } from "@/lib/sdrep-data";

export const Route = createFileRoute("/portal/rescue")({
  head: () => ({
    meta: [
      { title: "Rescue Team Portal — Missions & Navigation | SDREP" },
      { name: "description", content: "Field portal for rescue units: assigned missions, victim queue, live navigation, equipment inventory and incident reporting." },
      { property: "og:title", content: "Rescue Team Portal — SDREP" },
      { property: "og:description", content: "Mission tasking and field navigation for rescue units." },
    ],
  }),
  component: RescuePortal,
});

const victims = [
  { id: "V-2201", name: "Unnamed male, ~60", triage: "Red", note: "Trapped, first floor", tone: "critical" as const },
  { id: "V-2202", name: "Family of 4", triage: "Yellow", note: "Rooftop, Sector 7", tone: "warning" as const },
  { id: "V-2203", name: "Dialysis patient", triage: "Yellow", note: "Needs transport", tone: "warning" as const },
  { id: "V-2204", name: "3 residents", triage: "Green", note: "Awaiting boat", tone: "success" as const },
];

const equipment = [
  { item: "Inflatable boats", have: 2, need: 4 },
  { item: "Life jackets", have: 18, need: 20 },
  { item: "Cutting gear", have: 1, need: 1 },
  { item: "Stretchers", have: 3, need: 6 },
];

function RescuePortal() {
  return (
    <div className="space-y-4">
      <PageHeading
        eyebrow="ALPHA-1 · NDRF Water Rescue"
        title="Mission board"
        description="On-scene at INC-4471 · Sector 7 embankment breach."
        actions={
          <button className="flex items-center gap-2 rounded-md bg-success px-3 py-2 text-xs font-semibold text-success-foreground">
            <CheckCircle2 className="size-3.5" /> Complete mission
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Active mission" value="INC-4471" tone="critical" icon={<Siren className="size-4" />} hint="on scene 38 min" />
        <MetricCard label="Victims in queue" value={victims.length} tone="warning" />
        <MetricCard label="Vehicle fuel" value="62" unit="%" tone="warning" icon={<Fuel className="size-4" />} hint="range 140 km" />
        <MetricCard label="Comms" value="Strong" tone="success" icon={<Radio className="size-4" />} hint="Rescue tactical net" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel className="overflow-hidden">
          <PanelHeader title="Live navigation" meta="next waypoint 320 m" />
          <div className="p-2"><MapCanvas height="clamp(320px, 44vh, 520px)" layers={{ shelters: true, hospitals: false }} /></div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Victim queue" />
            <ul className="divide-y divide-border">
              {victims.map((v) => (
                <li key={v.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="num text-[11px] text-muted-foreground">{v.id}</span>
                    <StatusPill tone={v.tone}>{v.triage}</StatusPill>
                  </div>
                  <p className="mt-1 truncate text-sm">{v.name}</p>
                  <p className="text-[11px] text-muted-foreground">{v.note}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Equipment inventory" icon={<Package className="size-4" />} />
            <ul className="space-y-3 p-4">
              {equipment.map((e) => (
                <li key={e.item}>
                  <p className="flex justify-between text-xs"><span>{e.item}</span><span className="num text-muted-foreground">{e.have}/{e.need}</span></p>
                  <div className="mt-1.5"><Bar value={(e.have / e.need) * 100} tone={e.have < e.need / 2 ? "critical" : e.have < e.need ? "warning" : "success"} /></div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Road status ahead" />
            <ul className="divide-y divide-border text-xs">
              {roads.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <span className="truncate">{r.name}</span>
                  <StatusPill tone={r.state === "blocked" ? "critical" : r.state === "flooded" ? "info" : r.state === "congested" ? "warning" : "success"}>{r.state}</StatusPill>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="File incident report" />
            <form className="space-y-3 p-4" onSubmit={(e) => e.preventDefault()}>
              <label className="block text-xs text-muted-foreground" htmlFor="inc">Related incident</label>
              <select id="inc" className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm">
                {incidents.map((i) => <option key={i.id}>{i.id} — {i.title}</option>)}
              </select>
              <label className="block text-xs text-muted-foreground" htmlFor="obs">Field observation</label>
              <textarea id="obs" rows={3} className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm" placeholder="Describe hazards, casualties, resources required…" />
              <button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Submit report</button>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  );
}
