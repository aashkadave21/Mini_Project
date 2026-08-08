import { createFileRoute } from "@tanstack/react-router";
import { CloudOff, HeartPulse, MapPin, Phone, Siren, Users } from "lucide-react";
import { MapCanvas } from "@/components/sdrep/MapCanvas";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";

export const Route = createFileRoute("/portal/citizen")({
  head: () => ({
    meta: [
      { title: "Citizen Portal — Your Evacuation Status | SDREP" },
      { name: "description", content: "Your alerts, assigned shelter, live evacuation route, family tracking, medical profile and one-tap SOS." },
      { property: "og:title", content: "Citizen Portal — SDREP" },
      { property: "og:description", content: "Personal evacuation status and emergency assistance." },
    ],
  }),
  component: CitizenPortal,
});

const family = [
  { name: "Meera Iyer", status: "At shelter SH-01", tone: "success" as const },
  { name: "Rohan Iyer", status: "En route · Route A", tone: "warning" as const },
  { name: "Kamala Iyer", status: "Unreachable · 22 min", tone: "critical" as const },
];

const checklist = [
  "Identity documents & cash",
  "3 days of medication",
  "Drinking water (4 L per person)",
  "Torch, power bank, whistle",
  "Mains power and gas switched off",
];

function CitizenPortal() {
  return (
    <div className="space-y-4">
      <PageHeading
        eyebrow="Citizen"
        title="Your evacuation status"
        description="Sector 7 · Riverside is under a mandatory evacuation order."
        actions={
          <button className="flex items-center gap-2 rounded-md bg-critical px-4 py-2.5 text-sm font-semibold text-critical-foreground animate-pulse-ring">
            <Siren className="size-4" /> SOS
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Assigned shelter" value="SH-01" tone="success" icon={<MapPin className="size-4" />} hint="Municipal Stadium" />
        <MetricCard label="Distance" value="2.4" unit="km" tone="info" hint="approx. 26 min on foot" />
        <MetricCard label="Family accounted" value="2/3" tone="warning" icon={<Users className="size-4" />} />
        <MetricCard label="Connectivity" value="Offline" tone="critical" icon={<CloudOff className="size-4" />} hint="cached 4 min ago" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="overflow-hidden">
          <PanelHeader title="Your route to safety" meta="Route A · updated 4 min ago" />
          <div className="p-2"><MapCanvas height="clamp(320px, 44vh, 520px)" layers={{ teams: false }} /></div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Active alerts" />
            <ul className="divide-y divide-border text-sm">
              <li className="px-4 py-3"><StatusPill tone="critical" pulse>Mandatory</StatusPill><p className="mt-1.5">Evacuate Sector 7 immediately. Water level 2.1 m and rising.</p></li>
              <li className="px-4 py-3"><StatusPill tone="warning">Advisory</StatusPill><p className="mt-1.5">Riverside Arterial is submerged. Use the Ridge Link diversion.</p></li>
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Family tracking" icon={<Users className="size-4" />} />
            <ul className="divide-y divide-border text-sm">
              {family.map((f) => (
                <li key={f.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3">
                  <span className="truncate">{f.name}</span>
                  <StatusPill tone={f.tone}>{f.status}</StatusPill>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Go-bag checklist" />
            <ul className="space-y-2 p-4 text-sm">
              {checklist.map((c, i) => (
                <li key={c}><label className="flex cursor-pointer items-center gap-2.5"><input type="checkbox" defaultChecked={i < 3} className="size-4 accent-[var(--color-primary)]" />{c}</label></li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Medical profile" icon={<HeartPulse className="size-4" />} />
            <dl className="space-y-2 p-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Blood group</dt><dd className="num">O+</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Conditions</dt><dd>Asthma</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Medication</dt><dd>Salbutamol inhaler</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Emergency contact</dt><dd className="num">+91 98••• ••420</dd></div>
            </dl>
            <div className="border-t border-border p-3">
              <p className="mb-2 text-xs text-muted-foreground">Nearest rescue centre</p>
              <a href="tel:112" className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"><span>Riverside Rescue Post</span><Phone className="size-4 text-accent" /></a>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Shelter readiness" />
            <div className="p-4"><p className="flex justify-between text-xs"><span>SH-01 occupancy</span><span className="num">1876 / 2400</span></p><div className="mt-2"><Bar value={78} tone="warning" /></div></div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
