import { createFileRoute } from "@tanstack/react-router";
import { Ambulance, BedDouble, Droplet, HeartPulse } from "lucide-react";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";

export const Route = createFileRoute("/portal/hospital")({
  head: () => ({
    meta: [
      { title: "Hospital Portal — Casualty Intake & Triage | SDREP" },
      { name: "description", content: "Hospital-side view of incoming casualties, ambulance arrivals, triage queue, bed and ICU capacity and blood inventory." },
      { property: "og:title", content: "Hospital Portal — SDREP" },
      { property: "og:description", content: "Casualty intake, triage and capacity management." },
    ],
  }),
  component: HospitalPortal,
});

const arrivals = [
  { unit: "AMB-14", eta: "3 min", triage: "Red", cases: 1, tone: "critical" as const },
  { unit: "AMB-07", eta: "9 min", triage: "Yellow", cases: 3, tone: "warning" as const },
  { unit: "HELI-2", eta: "12 min", triage: "Red", cases: 2, tone: "critical" as const },
  { unit: "AMB-22", eta: "21 min", triage: "Green", cases: 5, tone: "success" as const },
];

const triageQueue = [
  { id: "C-8841", tag: "Red", desc: "Crush injury, hypotensive", wait: "0 min" },
  { id: "C-8840", tag: "Red", desc: "Smoke inhalation, intubated", wait: "4 min" },
  { id: "C-8836", tag: "Yellow", desc: "Open tibia fracture", wait: "18 min" },
  { id: "C-8829", tag: "Yellow", desc: "Hypothermia, elderly", wait: "26 min" },
  { id: "C-8817", tag: "Green", desc: "Lacerations, ambulatory", wait: "51 min" },
];

const blood = [
  { group: "O-", units: 12, min: 20 },
  { group: "O+", units: 64, min: 40 },
  { group: "A+", units: 38, min: 30 },
  { group: "B+", units: 27, min: 30 },
];

function HospitalPortal() {
  return (
    <div className="space-y-4">
      <PageHeading
        eyebrow="HSP-1 · City General Hospital"
        title="Casualty intake"
        description="Mass casualty protocol active. Emergency department at 88% triage load."
        actions={<button className="flex items-center gap-2 rounded-md bg-critical px-3 py-2 text-xs font-semibold text-critical-foreground"><HeartPulse className="size-3.5" /> Declare diversion</button>}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Beds free" value="72" unit="/640" tone="warning" icon={<BedDouble className="size-4" />} />
        <MetricCard label="ICU free" value="5" unit="/48" tone="critical" icon={<HeartPulse className="size-4" />} />
        <MetricCard label="Inbound casualties" value="11" tone="critical" icon={<Ambulance className="size-4" />} hint="next 25 min" />
        <MetricCard label="Blood below minimum" value="1" tone="warning" icon={<Droplet className="size-4" />} hint="O-negative" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel>
          <PanelHeader title="Triage queue" meta="live" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="border-b border-border text-left">{["Case", "Tag", "Presentation", "Waiting"].map((h) => <th key={h} className="label-eyebrow px-4 py-2 font-normal">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {triageQueue.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-2">
                    <td className="num px-4 py-2.5 text-muted-foreground">{c.id}</td>
                    <td className="px-4 py-2.5"><StatusPill tone={c.tag === "Red" ? "critical" : c.tag === "Yellow" ? "warning" : "success"} pulse={c.tag === "Red"}>{c.tag}</StatusPill></td>
                    <td className="px-4 py-2.5">{c.desc}</td>
                    <td className="num px-4 py-2.5">{c.wait}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Ambulance arrivals" icon={<Ambulance className="size-4" />} />
            <ul className="divide-y divide-border">
              {arrivals.map((a) => (
                <li key={a.unit} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3">
                  <div className="min-w-0"><p className="num text-sm font-semibold">{a.unit}</p><p className="text-[11px] text-muted-foreground">{a.cases} casualties · ETA {a.eta}</p></div>
                  <StatusPill tone={a.tone} pulse={a.tone === "critical"}>{a.triage}</StatusPill>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Blood inventory" icon={<Droplet className="size-4" />} />
            <ul className="space-y-3 p-4">
              {blood.map((b) => (
                <li key={b.group}>
                  <p className="flex justify-between text-xs"><span className="num font-semibold">{b.group}</span><span className={`num ${b.units < b.min ? "text-critical" : "text-muted-foreground"}`}>{b.units} units</span></p>
                  <div className="mt-1.5"><Bar value={(b.units / (b.min * 2)) * 100} tone={b.units < b.min ? "critical" : "success"} /></div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
