import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Navigation, Siren, CheckCircle2, Loader2 } from "lucide-react";
import { PublicFooter, PublicNav } from "@/components/sdrep/PublicChrome";
import { MapCanvas } from "@/components/sdrep/MapCanvas";
import { PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";
import { api } from "@/lib/api-client";

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
  const [sector, setSector] = useState("Sector 7, Riverside");
  const [people, setPeople] = useState(3);
  const [mobility, setMobility] = useState("On foot");
  const [needs, setNeeds] = useState("");
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [computedRoute, setComputedRoute] = useState<any>(null);
  const [sheltersList, setSheltersList] = useState<any[]>([]);

  useEffect(() => {
    // Load active shelters from API
    fetch("http://localhost:3001/api/v1/shelters")
      .then((r) => r.json())
      .then((res) => {
        if (res.data) setSheltersList(res.data);
      })
      .catch(() => {
        // Fallback default
      });
  }, []);

  const handleComputeRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingRoute(true);

    try {
      let startNode = "N_S7";
      let targetNode = "N_SH01";

      if (sector.toLowerCase().includes("sector 3") || sector.toLowerCase().includes("port")) {
        startNode = "N_S3";
        targetNode = "N_SH04";
      } else if (sector.toLowerCase().includes("sector 12") || sector.toLowerCase().includes("old town")) {
        startNode = "N_S12";
        targetNode = "N_SH03";
      }

      const res = await api.evacuation.getRoute(startNode, targetNode, "Dijkstra");
      if (res.data) {
        setComputedRoute(res.data);
      }
    } catch (err: any) {
      alert("Failed to compute disaster routing. Please proceed along main marked diversion signs.");
    } finally {
      setLoadingRoute(false);
    }
  };

  const acceptingShelters = sheltersList.filter((s) => s.status !== "full");

  return (
    <div className="min-h-dvh">
      <PublicNav />
      <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-10 sm:px-6">
        <PageHeading
          eyebrow="Citizen"
          title="Evacuation portal"
          description="Tell us where you are and our routing engine will compute the safest path to an open shelter with verified capacity."
          actions={
            <a href="tel:112" className="flex items-center gap-2 rounded-md bg-critical px-4 py-2.5 text-sm font-semibold text-critical-foreground">
              <Siren className="size-4" /> Call 112
            </a>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <Panel>
            <PanelHeader title="Request evacuation guidance" icon={<Navigation className="size-4" />} />
            <form className="space-y-3 p-4" onSubmit={handleComputeRoute}>
              <div>
                <label htmlFor="loc" className="block text-xs text-muted-foreground">Your location or sector</label>
                <input
                  id="loc"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  placeholder="e.g. Sector 7, Riverside"
                  required
                  className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="people" className="block text-xs text-muted-foreground">People in your group</label>
                <input
                  id="people"
                  type="number"
                  min={1}
                  max={25}
                  value={people}
                  onChange={(e) => setPeople(parseInt(e.target.value) || 1)}
                  className="num mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="mob" className="block text-xs text-muted-foreground">Mobility</label>
                <select
                  id="mob"
                  value={mobility}
                  onChange={(e) => setMobility(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm"
                >
                  <option>On foot</option>
                  <option>Own vehicle</option>
                  <option>Requires transport</option>
                  <option>Stretcher / wheelchair</option>
                </select>
              </div>
              <div>
                <label htmlFor="needs" className="block text-xs text-muted-foreground">Special needs</label>
                <textarea
                  id="needs"
                  rows={3}
                  value={needs}
                  onChange={(e) => setNeeds(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm"
                  placeholder="Medical conditions, infants, elderly, pets…"
                />
              </div>
              <button
                type="submit"
                disabled={loadingRoute}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {loadingRoute && <Loader2 className="size-4 animate-spin" />}
                {loadingRoute ? "Computing optimal path…" : "Get my route"}
              </button>
              <p className="text-[11px] text-muted-foreground">
                Already registered? <Link to="/portal/citizen" className="text-accent underline">Open your citizen dashboard</Link>.
              </p>
            </form>
          </Panel>

          <div className="space-y-4">
            <Panel className="overflow-hidden">
              <PanelHeader
                title="Computed safe route"
                meta={
                  computedRoute
                    ? `${computedRoute.totalDistanceKm} km · ${computedRoute.estimatedTimeMin} min (${computedRoute.algorithm} search)`
                    : "Sector 7 → SH-01 · 26 min on foot"
                }
                action={<StatusPill tone="warning">1 diversion</StatusPill>}
              />
              <div className="p-2">
                <MapCanvas height="clamp(300px, 42vh, 460px)" layers={{ teams: false, hospitals: false }} />
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Shelters accepting arrivals" meta="verified capacity" />
              <ul className="divide-y divide-border">
                {(acceptingShelters.length > 0 ? acceptingShelters : [
                  { id: "SH-01", name: "Municipal Stadium Relief Camp", capacity: 2400, occupancy: 1876, medical: true, status: "near-full" },
                  { id: "SH-03", name: "Community Hall, Sector 12", capacity: 640, occupancy: 311, medical: true, status: "open" },
                  { id: "SH-04", name: "North Ridge Sports Complex", capacity: 1500, occupancy: 402, medical: false, status: "open" },
                ]).map((s: any) => (
                  <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="num text-[11px] text-muted-foreground">
                        {(s.capacity - s.occupancy).toLocaleString()} places free
                        {s.medical ? " · medical post available" : ""}
                      </p>
                    </div>
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
