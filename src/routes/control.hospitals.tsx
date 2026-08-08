import { createFileRoute } from "@tanstack/react-router";
import { Ambulance, BedDouble, Droplet, HeartPulse } from "lucide-react";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";
import { hospitals } from "@/lib/sdrep-data";

export const Route = createFileRoute("/control/hospitals")({
  head: () => ({
    meta: [
      { title: "Hospital Capacity — SDREP Control Centre" },
      { name: "description", content: "Track bed availability, ICU capacity, ambulance arrivals and blood stock across partner hospitals." },
      { property: "og:title", content: "Hospital Capacity — SDREP" },
      { property: "og:description", content: "Medical surge capacity oversight during disaster response." },
    ],
  }),
  component: HospitalsPage,
});

const blood = [
  { group: "O-", units: 12, min: 20 },
  { group: "O+", units: 64, min: 40 },
  { group: "A+", units: 38, min: 30 },
  { group: "B+", units: 27, min: 30 },
  { group: "AB+", units: 9, min: 10 },
];

function HospitalsPage() {
  return (
    <div className="space-y-4">
      <PageHeading eyebrow="Resources" title="Hospital capacity" description="Surge readiness across partner facilities, with live ICU and blood-bank pressure." />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Beds available" value={hospitals.reduce((a, h) => a + h.bedsFree, 0)} tone="warning" icon={<BedDouble className="size-4" />} />
        <MetricCard label="ICU available" value={hospitals.reduce((a, h) => a + h.icuFree, 0)} tone="critical" icon={<HeartPulse className="size-4" />} hint="critical threshold" />
        <MetricCard label="Ambulances inbound" value={hospitals.reduce((a, h) => a + h.incoming, 0)} tone="info" icon={<Ambulance className="size-4" />} />
        <MetricCard label="Blood units below min" value="3" tone="critical" icon={<Droplet className="size-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel>
          <PanelHeader title="Facility status" />
          <ul className="divide-y divide-border">
            {hospitals.map((h) => (
              <li key={h.id} className="px-4 py-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <p className="truncate text-sm font-medium">{h.name}</p>
                  <StatusPill tone={h.triageLoad > 90 ? "critical" : h.triageLoad > 70 ? "warning" : "success"}>
                    {h.triageLoad > 90 ? "Saturated" : h.triageLoad > 70 ? "Strained" : "Accepting"}
                  </StatusPill>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {[
                    { l: "Beds", used: h.beds - h.bedsFree, cap: h.beds },
                    { l: "ICU", used: h.icu - h.icuFree, cap: h.icu },
                    { l: "Triage load", used: h.triageLoad, cap: 100 },
                  ].map((m) => {
                    const pct = (m.used / m.cap) * 100;
                    return (
                      <div key={m.l}>
                        <p className="flex justify-between text-[11px] text-muted-foreground">
                          <span>{m.l}</span>
                          <span className="num">{m.used}/{m.cap}</span>
                        </p>
                        <div className="mt-1"><Bar value={pct} tone={pct > 90 ? "critical" : pct > 70 ? "warning" : "success"} /></div>
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Regional blood bank" icon={<Droplet className="size-4" />} />
          <ul className="space-y-3 p-4">
            {blood.map((b) => (
              <li key={b.group}>
                <p className="flex justify-between text-xs">
                  <span className="num font-semibold">{b.group}</span>
                  <span className={`num ${b.units < b.min ? "text-critical" : "text-muted-foreground"}`}>{b.units} units</span>
                </p>
                <div className="mt-1.5"><Bar value={(b.units / (b.min * 2)) * 100} tone={b.units < b.min ? "critical" : "success"} /></div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
