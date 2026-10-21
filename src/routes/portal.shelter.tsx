import { useEffect, useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Boxes, HandHeart, Tent, Users, Loader2, CheckCircle2, UserPlus, AlertCircle } from "lucide-react";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/portal/shelter")({
  head: () => ({
    meta: [
      { title: "Shelter Administrator Portal — SDREP" },
      { name: "description", content: "Manage relief camp occupancy, intake of incoming evacuees, food, water and medical inventory, supply requests and volunteers." },
      { property: "og:title", content: "Shelter Administrator Portal — SDREP" },
      { property: "og:description", content: "Occupancy, inventory and volunteer management for relief camps." },
    ],
  }),
  component: ShelterPortal,
});

function ShelterPortal() {
  const { user } = useAuth();
  const shelterId = user?.associatedEntityId || "SH-01";

  const [shelter, setShelter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Supply Request form state
  const [resource, setResource] = useState("Drinking water (L)");
  const [quantity, setQuantity] = useState(1000);
  const [urgency, setUrgency] = useState("Critical (< 2 h)");

  // Evacuee Intake modal/form state
  const [showIntakeForm, setShowIntakeForm] = useState(false);
  const [intakeName, setIntakeName] = useState("");
  const [intakeCount, setIntakeCount] = useState(1);
  const [intakeSector, setIntakeSector] = useState("Sector 7");
  const [intakeMobility, setIntakeMobility] = useState("On foot");

  const fetchShelter = useCallback(async () => {
    try {
      const res = await api.shelter.getShelter(shelterId);
      if (res.data) {
        setShelter(res.data);
      }
    } catch (err) {
      console.error("Failed to load shelter details:", err);
    } finally {
      setLoading(false);
    }
  }, [shelterId]);

  useEffect(() => {
    fetchShelter();
  }, [fetchShelter]);

  const handleSupplyRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    setErrorMessage(null);
    try {
      await api.shelter.requestSupplies(shelterId, {
        resource,
        quantity: Number(quantity),
        urgency,
      });
      setFeedback(`Supply requisition for ${quantity} units of ${resource} successfully logged to Control Centre.`);
      await fetchShelter();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit supply requisition.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEvacueeIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intakeName.trim()) return;

    setSubmitting(true);
    setFeedback(null);
    setErrorMessage(null);
    try {
      await api.shelter.registerIntake(shelterId, {
        fullName: intakeName.trim(),
        familyCount: Number(intakeCount),
        originSector: intakeSector,
        mobilityNeeds: intakeMobility,
      });
      setFeedback(`Intake complete: Registered ${intakeName} (+${intakeCount - 1} family members). Occupancy updated.`);
      setIntakeName("");
      setIntakeCount(1);
      setShowIntakeForm(false);
      await fetchShelter();
    } catch (err: any) {
      setErrorMessage(err.message || "Capacity violation or intake registration error.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Connecting to camp occupancy and logistics database…
      </div>
    );
  }

  const capacity = shelter?.capacity || 2400;
  const occupancy = shelter?.occupancy || 1876;
  const incoming = shelter?.incoming || 220;
  const bedsFree = Math.max(0, capacity - occupancy);
  const occupancyPct = Math.round((occupancy / capacity) * 100);

  const inventory = [
    { item: "Drinking water (L)", stock: shelter?.waterStock || 4200, target: 9000 },
    { item: "Ready meals", stock: shelter?.foodStock || 1580, target: 3600 },
    { item: "Blankets", stock: shelter?.blanketsStock || 1720, target: 2000 },
    { item: "Medical kits", stock: shelter?.medicalKitsStock || 46, target: 120 },
    { item: "Sanitation supplies", stock: shelter?.sanitationStock || 310, target: 400 },
  ];

  const incomingBatches = shelter?.incomingBatches || [
    { batch: "BT-11", from: "Sector 7", persons: 84, eta: "18 min", needs: "Medical" },
    { batch: "BT-12", from: "Sector 7", persons: 62, eta: "34 min", needs: "Infants" },
    { batch: "BT-13", from: "Sector 12", persons: 74, eta: "71 min", needs: "Elderly" },
  ];

  const volunteers = shelter?.volunteers || [
    { name: "R. Nair", role: "Intake desk", shift: "20:00–04:00", tone: "success" },
    { name: "P. Sharma", role: "Medical support", shift: "22:00–06:00", tone: "success" },
    { name: "J. Fernandes", role: "Kitchen", shift: "unassigned", tone: "warning" },
    { name: "A. Khan", role: "Logistics", shift: "16:00–00:00", tone: "info" },
  ];

  return (
    <div className="space-y-4">
      <PageHeading
        eyebrow={`${shelter?.id || shelterId} · ${shelter?.name || "Relief Camp"}`}
        title="Shelter operations"
        description={`Camp is at ${occupancyPct}% capacity with ${incoming} evacuees expected in the next 90 minutes.`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowIntakeForm(!showIntakeForm)}
              className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              <UserPlus className="size-3.5" /> Evacuee intake
            </button>
            <button
              onClick={() => {
                const el = document.getElementById("sup-form");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
            >
              <Boxes className="size-3.5" /> Request supplies
            </button>
          </div>
        }
      />

      {feedback && (
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-xs text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-md border border-critical/30 bg-critical/10 px-4 py-3 text-xs text-critical">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {showIntakeForm && (
        <Panel className="border-accent">
          <PanelHeader title="Register evacuee intake" icon={<UserPlus className="size-4 text-accent" />} />
          <form className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={handleEvacueeIntake}>
            <div>
              <label className="block text-xs text-muted-foreground" htmlFor="iname">Head of family name</label>
              <input
                id="iname"
                required
                value={intakeName}
                onChange={(e) => setIntakeName(e.target.value)}
                placeholder="e.g. Ramesh Patil"
                className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground" htmlFor="icount">Family headcount</label>
              <input
                id="icount"
                type="number"
                min={1}
                max={20}
                value={intakeCount}
                onChange={(e) => setIntakeCount(parseInt(e.target.value) || 1)}
                className="num mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground" htmlFor="isector">Origin sector</label>
              <select
                id="isector"
                value={intakeSector}
                onChange={(e) => setIntakeSector(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm"
              >
                <option>Sector 7 · Riverside</option>
                <option>Sector 3 · Port</option>
                <option>Sector 12 · Old Town</option>
                <option>Sector 9 · Civic</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
              >
                {submitting ? "Committing transaction…" : "Confirm intake"}
              </button>
            </div>
          </form>
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Occupancy" value={occupancy.toLocaleString()} tone="warning" icon={<Users className="size-4" />} hint={`capacity ${capacity.toLocaleString()}`} />
        <MetricCard label="Incoming" value={incoming} tone="critical" hint="ETA 40–90 min" />
        <MetricCard label="Beds free" value={bedsFree} tone={bedsFree > 100 ? "success" : "critical"} icon={<Tent className="size-4" />} />
        <MetricCard label="Volunteers on shift" value={`${volunteers.filter((v: any) => v.available).length}/${volunteers.length}`} tone="info" icon={<HandHeart className="size-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Inventory levels" meta="live stock records" />
          <ul className="space-y-3.5 p-4">
            {inventory.map((r) => {
              const pct = (r.stock / r.target) * 100;
              return (
                <li key={r.item}>
                  <p className="flex justify-between text-xs">
                    <span>{r.item}</span>
                    <span className="num text-muted-foreground">{r.stock.toLocaleString()} / {r.target.toLocaleString()}</span>
                  </p>
                  <div className="mt-1.5"><Bar value={pct} tone={pct < 35 ? "critical" : pct < 65 ? "warning" : "success"} /></div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Incoming evacuee batches" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Batch", "From", "Persons", "ETA", "Needs"].map((h) => (
                    <th key={h} className="label-eyebrow px-4 py-2 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {incomingBatches.map((r: any) => (
                  <tr key={r.batch || r[0]} className="hover:bg-surface-2">
                    <td className="num px-4 py-2.5">{r.batch || r[0]}</td>
                    <td className="px-4 py-2.5">{r.from || r[1]}</td>
                    <td className="num px-4 py-2.5">{r.persons || r[2]}</td>
                    <td className="num px-4 py-2.5">{r.eta || r[3]}</td>
                    <td className="px-4 py-2.5"><StatusPill tone="info">{r.needs || r[4]}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Volunteer roster" icon={<HandHeart className="size-4" />} />
          <ul className="divide-y divide-border">
            {volunteers.map((v: any) => (
              <li key={v.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{v.name}</p>
                  <p className="text-[11px] text-muted-foreground">{v.role}</p>
                </div>
                <StatusPill tone={v.tone || "info"}>{v.shift}</StatusPill>
              </li>
            ))}
          </ul>
        </Panel>

        <div id="sup-form">
          <Panel>
            <PanelHeader title="Supply request" meta="routed to logistics coordinator" />
            <form className="space-y-3 p-4" onSubmit={handleSupplyRequest}>
              <label className="block text-xs text-muted-foreground" htmlFor="sup">Resource</label>
              <select
                id="sup"
                value={resource}
                onChange={(e) => setResource(e.target.value)}
                className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm"
              >
                {inventory.map((i) => <option key={i.item} value={i.item}>{i.item}</option>)}
              </select>
              <label className="block text-xs text-muted-foreground" htmlFor="qty">Quantity</label>
              <input
                id="qty"
                type="number"
                min={10}
                max={10000}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 100)}
                className="num w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm"
              />
              <label className="block text-xs text-muted-foreground" htmlFor="urg">Urgency</label>
              <select
                id="urg"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm"
              >
                <option>Critical (&lt; 2 h)</option>
                <option>High (&lt; 6 h)</option>
                <option>Routine</option>
              </select>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? "Submitting requisition…" : "Send to control centre"}
              </button>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  );
}
