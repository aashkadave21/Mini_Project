import { createFileRoute, Link } from "@tanstack/react-router";
import { Navigation, Siren } from "lucide-react";
import { PublicFooter, PublicNav } from "@/components/sdrep/PublicChrome";
import { MapCanvas } from "@/components/sdrep/MapCanvas";
import { PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";
import { shelters } from "@/lib/sdrep-data";

export const Route = createFileRoute("/evacuate")({
  head: () => ({
    meta: [
      { title: "Citizen Evacuation Portal — Find Your Shelter | SDREP" },
      { name: "description", content: "Enter your sector to receive your assigned shelter, safest route, travel time and special assistance options." },
      { property: "og:title", content: "Citizen Evacuation Portal — SDREP" },
      { property: "og:description", content: "Find your assigned shelter and safest evacuation route." },
    ],
  }),
  component: EvacuatePage,
});

function EvacuatePage() {
  return (
    <div className="min-h-dvh">
      <PublicNav />
      <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-10 sm:px-6">
        <PageHeading
          eyebrow="Citizen"
          title="Evacuation portal"
          description="Tell us where you are and we will assign the nearest shelter with available capacity."
          actions={<a href="tel:112" className="flex items-center gap-2 rounded-md bg-critical px-4 py-2.5 text-sm font-semibold text-critical-foreground"><Siren className="size-4" /> Call 112</a>}
        />

        <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <Panel>
            <PanelHeader title="Request evacuation guidance" icon={<Navigation className="size-4" />} />
            <form className="space-y-3 p-4" onSubmit={(e) => e.preventDefault()}>
              <div><label htmlFor="loc" className="block text-xs text-muted-foreground">Your location or sector</label>
                <input id="loc" placeholder="e.g. Sector 7, Riverside" className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm" /></div>
              <div><label htmlFor="people" className="block text-xs text-muted-foreground">People in your group</label>
                <input id="people" type="number" defaultValue={3} className="num mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm" /></div>
              <div><label htmlFor="mob" className="block text-xs text-muted-foreground">Mobility</label>
                <select id="mob" className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm"><option>On foot</option><option>Own vehicle</option><option>Requires transport</option><option>Stretcher / wheelchair</option></select></div>
              <div><label htmlFor="needs" className="block text-xs text-muted-foreground">Special needs</label>
                <textarea id="needs" rows={3} className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm" placeholder="Medical conditions, infants, elderly, pets…" /></div>
              <button className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground">Get my route</button>
              <p className="text-[11px] text-muted-foreground">Already registered? <Link to="/portal/citizen" className="text-accent underline">Open your citizen dashboard</Link>.</p>
            </form>
          </Panel>

          <div className="space-y-4">
            <Panel className="overflow-hidden">
              <PanelHeader title="Suggested route" meta="Sector 7 → SH-01 · 26 min on foot" action={<StatusPill tone="warning">1 diversion</StatusPill>} />
              <div className="p-2"><MapCanvas height="clamp(300px, 42vh, 460px)" layers={{ teams: false, hospitals: false }} /></div>
            </Panel>

            <Panel>
              <PanelHeader title="Shelters accepting arrivals" />
              <ul className="divide-y divide-border">
                {shelters.filter((s) => s.status !== "full").map((s) => (
                  <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                    <div className="min-w-0"><p className="truncate text-sm">{s.name}</p><p className="num text-[11px] text-muted-foreground">{s.capacity - s.occupancy} places free{s.medical ? " · medical post" : ""}</p></div>
                    <StatusPill tone={s.status === "near-full" ? "warning" : "success"}>{s.status}</StatusPill>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
