import { useEffect, useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Ambulance, BedDouble, Droplet, HeartPulse, Loader2, CheckCircle2, UserPlus, AlertCircle } from "lucide-react";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

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

function HospitalPortal() {
  const { user } = useAuth();
  const hospitalId = user?.associatedEntityId || "HSP-1";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New Casualty Triage Intake form
  const [showTriageForm, setShowTriageForm] = useState(false);
  const [tag, setTag] = useState("Red");
  const [presentation, setPresentation] = useState("");

  const fetchHospital = useCallback(async () => {
    try {
      const res = await api.hospital.getDetails(hospitalId);
      if (res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error("Failed to load hospital operations:", err);
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    fetchHospital();
  }, [fetchHospital]);

  const handleToggleDiversion = async () => {
    setSubmitting(true);
    try {
      const isCurrentlyDiverting = Boolean(data?.diversion);
      const res = await api.hospital.declareDiversion(hospitalId, !isCurrentlyDiverting, "Surge capacity threshold protocol");
      setFeedback(res.message);
      await fetchHospital();
      setTimeout(() => setFeedback(null), 8000);
    } catch (err: any) {
      alert(err.message || "Failed to update diversion status.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTriageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presentation.trim()) return;

    setSubmitting(true);
    try {
      const res = await api.hospital.addTriageCase(hospitalId, {
        tag,
        desc: presentation.trim(),
      });
      setFeedback(res.message);
      setPresentation("");
      setShowTriageForm(false);
      await fetchHospital();
    } catch (err: any) {
      alert(err.message || "Failed to register triage casualty.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Loading clinical surge and casualty intake registry…
      </div>
    );
  }

  const triageQueue = data?.triageQueue || [];
  const arrivals = data?.ambulances || [];
  const blood = data?.blood || [];
  const isDiverting = Boolean(data?.diversion);

  return (
    <div className="space-y-4">
      <PageHeading
        eyebrow={`${data?.id || hospitalId} · ${data?.name || "Hospital"}`}
        title="Casualty intake"
        description={
          isDiverting
            ? "⚠️ HOSPITAL DIVERSION ACTIVE. Inbound emergency traffic redirected to auxiliary trauma centres."
            : `Mass casualty protocol active. Emergency department at ${data?.triageLoad || 88}% triage load.`
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTriageForm(!showTriageForm)}
              className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80"
            >
              <UserPlus className="size-3.5" /> Intake casualty
            </button>
            <button
              onClick={handleToggleDiversion}
              disabled={submitting}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-white transition-colors ${
                isDiverting ? "bg-success hover:bg-success/90" : "bg-critical hover:bg-critical/90"
              }`}
            >
              <HeartPulse className="size-3.5" />
              {isDiverting ? "Lift diversion" : "Declare diversion"}
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

      {showTriageForm && (
        <Panel className="border-accent">
          <PanelHeader title="Intake casualty to triage queue" icon={<UserPlus className="size-4 text-accent" />} />
          <form className="grid gap-3 p-4 sm:grid-cols-3" onSubmit={handleTriageSubmit}>
            <div>
              <label className="block text-xs text-muted-foreground" htmlFor="ttag">Triage tag</label>
              <select
                id="ttag"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm"
              >
                <option value="Red">Red · Immediate / Resuscitation</option>
                <option value="Yellow">Yellow · Delayed / Urgent</option>
                <option value="Green">Green · Minimal / Ambulatory</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground" htmlFor="pdesc">Clinical presentation</label>
              <input
                id="pdesc"
                required
                value={presentation}
                onChange={(e) => setPresentation(e.target.value)}
                placeholder="e.g. Blunt abdominal trauma, tachycardic"
                className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
              >
                {submitting ? "Admitting…" : "Admit to queue"}
              </button>
            </div>
          </form>
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Beds free"
          value={String(data?.bedsFree || "72")}
          unit={`/${data?.beds || 640}`}
          tone={data?.bedsFree < 30 ? "critical" : "warning"}
          icon={<BedDouble className="size-4" />}
        />
        <MetricCard
          label="ICU free"
          value={String(data?.icuFree || "5")}
          unit={`/${data?.icu || 48}`}
          tone="critical"
          icon={<HeartPulse className="size-4" />}
        />
        <MetricCard
          label="Inbound casualties"
          value={String(data?.incoming || "11")}
          tone="critical"
          icon={<Ambulance className="size-4" />}
          hint="next 25 min"
        />
        <MetricCard
          label="Blood below minimum"
          value={String(blood.filter((b: any) => b.units < b.min).length || "1")}
          tone="warning"
          icon={<Droplet className="size-4" />}
          hint="O-negative alert"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel>
          <PanelHeader title="Triage queue" meta="prioritized by clinical urgency" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Case", "Tag", "Presentation", "Waiting"].map((h) => (
                    <th key={h} className="label-eyebrow px-4 py-2 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {triageQueue.map((c: any) => (
                  <tr key={c.id} className="hover:bg-surface-2">
                    <td className="num px-4 py-2.5 text-muted-foreground">{c.id}</td>
                    <td className="px-4 py-2.5">
                      <StatusPill
                        tone={c.tag === "Red" ? "critical" : c.tag === "Yellow" ? "warning" : "success"}
                        pulse={c.tag === "Red"}
                      >
                        {c.tag}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-2.5">{c.presentation || c.desc}</td>
                    <td className="num px-4 py-2.5">{c.wait || c.wait_time}</td>
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
              {arrivals.map((a: any) => (
                <li key={a.id || a.unit} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="num text-sm font-semibold">{a.unit}</p>
                    <p className="text-[11px] text-muted-foreground">{a.cases} casualties · ETA {a.eta}</p>
                  </div>
                  <StatusPill tone={a.tone || (a.triage === "Red" ? "critical" : "warning")} pulse={a.triage === "Red"}>
                    {a.triage}
                  </StatusPill>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Blood inventory" icon={<Droplet className="size-4" />} />
            <ul className="space-y-3 p-4">
              {blood.map((b: any) => (
                <li key={b.group || b.blood_group}>
                  <p className="flex justify-between text-xs">
                    <span className="num font-semibold">{b.group || b.blood_group}</span>
                    <span className={`num ${b.units < b.min ? "text-critical" : "text-muted-foreground"}`}>{b.units} units</span>
                  </p>
                  <div className="mt-1.5">
                    <Bar
                      value={(b.units / ((b.min || b.min_threshold) * 2)) * 100}
                      tone={b.units < (b.min || b.min_threshold) ? "critical" : "success"}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
