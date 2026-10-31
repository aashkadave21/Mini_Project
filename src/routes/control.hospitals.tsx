import { createFileRoute } from "@tanstack/react-router";
import {
  Ambulance,
  BedDouble,
  Droplet,
  HeartPulse,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Crosshair,
  Building2,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/control/hospitals")({
  head: () => ({
    meta: [
      { title: "Hospital Capacity & Medical Routing — SDREP Control Centre" },
      { name: "description", content: "Track bed availability, ICU capacity, ambulance arrivals, declare diversions, and evaluate automatic casualty diversion re-routing." },
      { property: "og:title", content: "Hospital Capacity & Medical Routing — SDREP" },
      { property: "og:description", content: "Medical surge capacity oversight and automated casualty diversion." },
    ],
  }),
  component: HospitalsPage,
});

const bloodStatic = [
  { group: "O-", units: 12, min: 20 },
  { group: "O+", units: 64, min: 40 },
  { group: "A+", units: 38, min: 30 },
  { group: "B+", units: 27, min: 30 },
  { group: "AB+", units: 9, min: 10 },
];

function HospitalsPage() {
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Scenario F: Routing Simulator state
  const [casualtySector, setCasualtySector] = useState<string>("Sector 7 · Riverside");
  const [casualtyPos, setCasualtyPos] = useState<[number, number]>([19.092, 72.862]);
  const [requiredBeds, setRequiredBeds] = useState(2);
  const [requiresICU, setRequiresICU] = useState(false);
  const [routingResult, setRoutingResult] = useState<any | null>(null);
  const [evaluatingRouting, setEvaluatingRouting] = useState(false);

  const fetchHospitals = useCallback(async () => {
    try {
      const res = await api.hospital.getAll();
      if (res.data) {
        setHospitals(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch hospitals:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHospitals();
  }, [fetchHospitals]);

  // Scenario F: Capacity Override (Set Beds to 0 or manual value)
  const handleUpdateCapacity = async (id: string, updates: { bedsFree?: number; icuFree?: number; diversion?: boolean; diversionReason?: string }) => {
    try {
      const res = await api.hospital.updateCapacity(id, updates);
      setActionFeedback(res.message);
      await fetchHospitals();
      setTimeout(() => setActionFeedback(null), 6000);
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message}`);
    }
  };

  // Scenario F: Toggle Diversion
  const handleToggleDiversion = async (h: any) => {
    try {
      const newDiversion = !h.diversion;
      const res = await api.hospital.updateCapacity(h.id, {
        diversion: newDiversion,
        diversionReason: newDiversion ? "Emergency saturation diversion declared by Control Centre" : undefined,
      });
      setActionFeedback(res.message);
      await fetchHospitals();
      setTimeout(() => setActionFeedback(null), 6000);
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message}`);
    }
  };

  // Scenario F: Evaluate Casualty Re-routing Algorithm
  const handleEvaluateCasualtyRouting = async () => {
    setEvaluatingRouting(true);
    try {
      const res = await api.facilities.findSuitable({
        type: "HOSPITAL",
        location: casualtyPos,
        requiredBeds,
        requiresICU,
      });
      setRoutingResult(res.data);
    } catch (err: any) {
      setActionFeedback(`Routing error: ${err.message}`);
    } finally {
      setEvaluatingRouting(false);
    }
  };

  const handleSectorChange = (sector: string) => {
    setCasualtySector(sector);
    if (sector.includes("Sector 7")) setCasualtyPos([19.092, 72.862]);
    else if (sector.includes("Sector 3")) setCasualtyPos([19.062, 72.848]);
    else if (sector.includes("Sector 12")) setCasualtyPos([19.083, 72.895]);
    else setCasualtyPos([19.076, 72.889]);
  };

  const totalBedsFree = hospitals.reduce((a, h) => a + (h.bedsFree || 0), 0);
  const totalICUFree = hospitals.reduce((a, h) => a + (h.icuFree || 0), 0);
  const divertingHospitals = hospitals.filter((h) => h.diversion).length;

  return (
    <div className="space-y-4">
      <PageHeading
        eyebrow="Medical Capacity & Allocation (Scenario F)"
        title="Hospital Surge Capacity & Casualty Diversion"
        description="Override facility bed capacities, declare hospital diversions, and demonstrate automatic casualty re-routing to the next most suitable trauma centre."
        actions={
          <button
            onClick={fetchHospitals}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs hover:bg-surface-3 transition-colors"
          >
            <RefreshCw className="size-3.5" /> Refresh Telemetry
          </button>
        }
      />

      {actionFeedback && (
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-xs text-success font-medium">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Metric strip */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Beds available" value={totalBedsFree} tone={totalBedsFree < 20 ? "critical" : "warning"} icon={<BedDouble className="size-4" />} />
        <MetricCard label="ICU available" value={totalICUFree} tone={totalICUFree < 5 ? "critical" : "warning"} icon={<HeartPulse className="size-4" />} hint="critical threshold" />
        <MetricCard label="Facilities under diversion" value={divertingHospitals} tone={divertingHospitals > 0 ? "critical" : "success"} icon={<Ambulance className="size-4" />} />
        <MetricCard label="Blood units below min" value="3" tone="critical" icon={<Droplet className="size-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left: Interactive Hospital Cards with Override Controls (Scenario F) */}
        <Panel>
          <PanelHeader title="Facility Surge Status & Capacity Overrides (Scenario F)" meta={`${hospitals.length} partner facilities`} />
          <ul className="divide-y divide-border">
            {hospitals.map((h) => (
              <li key={h.id} className="p-4 space-y-3 hover:bg-surface-2/40 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-bold flex items-center gap-2">
                      {h.name}
                      {h.diversion && (
                        <span className="rounded bg-critical/20 px-2 py-0.5 text-[10px] font-bold text-critical animate-pulse">
                          DIVERSION ACTIVE
                        </span>
                      )}
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Coordinates: [{h.pos?.[0]?.toFixed(3)}, {h.pos?.[1]?.toFixed(3)}] · Triage load: {h.triageLoad}%
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleDiversion(h)}
                      className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                        h.diversion
                          ? "bg-success/20 text-success hover:bg-success/30"
                          : "bg-critical/20 text-critical hover:bg-critical/30"
                      }`}
                    >
                      {h.diversion ? "Lift Diversion" : "Declare Diversion"}
                    </button>
                    <button
                      onClick={() => handleUpdateCapacity(h.id, { bedsFree: 0, icuFree: 0 })}
                      className="rounded border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning hover:bg-warning/20 transition-colors"
                      title="Simulate complete bed saturation"
                    >
                      Set Beds = 0
                    </button>
                    <button
                      onClick={() => handleUpdateCapacity(h.id, { bedsFree: 50, icuFree: 10 })}
                      className="rounded border border-border bg-surface-2 px-2 py-1 text-xs hover:bg-surface-3 transition-colors"
                      title="Restore surge capacity"
                    >
                      Reset +50 Beds
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 text-xs bg-surface-1 p-3 rounded-lg border border-border">
                  <div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Beds Free</span>
                      <span className="font-mono font-bold text-foreground">{h.bedsFree}/{h.beds}</span>
                    </div>
                    <div className="mt-1">
                      <Bar value={((h.beds - h.bedsFree) / h.beds) * 100} tone={h.bedsFree <= 2 ? "critical" : h.bedsFree < 15 ? "warning" : "success"} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>ICU Free</span>
                      <span className="font-mono font-bold text-foreground">{h.icuFree}/{h.icu}</span>
                    </div>
                    <div className="mt-1">
                      <Bar value={((h.icu - h.icuFree) / h.icu) * 100} tone={h.icuFree <= 1 ? "critical" : "success"} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Inbound Ambulances</span>
                      <span className="font-mono font-bold text-foreground">{h.incoming}</span>
                    </div>
                    <div className="mt-1">
                      <Bar value={(h.incoming / 20) * 100} tone={h.incoming > 10 ? "critical" : "info"} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Right: Casualty Routing & Diversion Simulator (Scenario F) */}
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Casualty Re-Routing Simulator (Scenario F)" icon={<Crosshair className="size-4 text-primary" />} />
            <div className="p-4 space-y-3 text-xs">
              <p className="text-[11px] text-muted-foreground">
                Simulate emergency casualty dispatch. If the nearest hospital is under diversion or has 0 beds, the algorithm automatically re-routes to the next optimal trauma facility.
              </p>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Casualty Incident Sector</label>
                <select
                  value={casualtySector}
                  onChange={(e) => handleSectorChange(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-surface-2 p-2 text-xs"
                >
                  <option value="Sector 7 · Riverside">Sector 7 · Riverside (Near HSP-2 Riverside Trauma)</option>
                  <option value="Sector 3 · Port">Sector 3 · Port (Near HSP-1 City General)</option>
                  <option value="Sector 18 · North Ridge">Sector 18 · North Ridge (Near HSP-3 North Ridge)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Required Beds</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={requiredBeds}
                    onChange={(e) => setRequiredBeds(Number(e.target.value))}
                    className="mt-1 w-full rounded border border-border bg-surface-2 p-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">ICU Required?</label>
                  <div className="mt-1 flex items-center gap-2 h-8">
                    <input
                      type="checkbox"
                      checked={requiresICU}
                      onChange={(e) => setRequiresICU(e.target.checked)}
                      className="size-4 accent-[var(--color-primary)]"
                    />
                    <span className="text-xs">Require ICU Bed</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleEvaluateCasualtyRouting}
                disabled={evaluatingRouting}
                className="w-full rounded bg-primary py-2 font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
              >
                {evaluatingRouting ? <RefreshCw className="size-3.5 animate-spin" /> : <Crosshair className="size-3.5" />}
                {evaluatingRouting ? "Running Allocation Algorithm…" : "Evaluate Casualty Routing"}
              </button>

              {routingResult && (
                <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">{routingResult.facility?.name}</span>
                    <StatusPill tone={routingResult.diversionWarning ? "warning" : "success"}>
                      {routingResult.diversionWarning ? "Diverted" : "Direct Routing"}
                    </StatusPill>
                  </div>
                  <p className="text-muted-foreground">{routingResult.rationale}</p>
                  {routingResult.diversionWarning && (
                    <div className="rounded bg-critical/10 p-2 text-critical text-[11px] font-medium border border-critical/30">
                      ⚠️ Diversion Triggered: {routingResult.diversionWarning}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono border-t border-border pt-2 text-muted-foreground">
                    <span>Distance: {routingResult.distanceKm} km</span>
                    <span>Free Beds: {routingResult.facility?.bedsFree}</span>
                  </div>
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Regional Blood Bank Inventory" icon={<Droplet className="size-4" />} />
            <ul className="space-y-3 p-4">
              {bloodStatic.map((b) => (
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
    </div>
  );
}
