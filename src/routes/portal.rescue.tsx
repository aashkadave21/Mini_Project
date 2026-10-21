import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Fuel, Package, Radio, Siren, Loader2, AlertCircle } from "lucide-react";
import { MapCanvas } from "@/components/sdrep/MapCanvas";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";
import { api } from "@/lib/api-client";

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

function RescuePortal() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [observation, setObservation] = useState("");
  const [selectedIncident, setSelectedIncident] = useState("INC-4471");
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchActive = async () => {
    try {
      const res = await api.rescue.getActive();
      if (res.data) {
        setData(res.data);
        if (res.data.mission?.incidentId) {
          setSelectedIncident(res.data.mission.incidentId);
        } else if (res.data.incidents?.length > 0) {
          setSelectedIncident(res.data.incidents[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load rescue operations board:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActive();
  }, []);

  const handleCompleteMission = async () => {
    if (!data?.mission) return;
    setSubmitting(true);
    try {
      await api.rescue.updateMissionStatus(
        data.mission.id,
        "COMPLETED",
        "Mission completed. All sector victims triaged and transferred to relief corridor."
      );
      setFeedback(`Mission ${data.mission.id} marked COMPLETED. Unit returned to readiness pool.`);
      await fetchActive();
    } catch (err: any) {
      alert(err.message || "Failed to complete mission.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!observation.trim()) return;

    setSubmitting(true);
    try {
      await api.rescue.submitReport(selectedIncident, observation);
      setFeedback(`Observation report filed for incident ${selectedIncident}.`);
      setObservation("");
      setTimeout(() => setFeedback(null), 6000);
    } catch (err: any) {
      alert(err.message || "Failed to submit observation report.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Acquiring mission tasking telemetry…
      </div>
    );
  }

  const team = data?.team;
  const mission = data?.mission;
  const victims = data?.victims || [];
  const equipment = data?.equipment || [];
  const roads = data?.roads || [];
  const incidents = data?.incidents || [];

  return (
    <div className="space-y-4">
      <PageHeading
        eyebrow={`${team?.callsign || "ALPHA-1"} · ${team?.unit || "NDRF Water Rescue"}`}
        title="Mission board"
        description={
          mission?.status === "COMPLETED"
            ? "Current mission COMPLETED. Unit standing by for next tasking."
            : `On-scene at ${mission?.incidentId || "INC-4471"} · Sector 7 embankment breach.`
        }
        actions={
          mission?.status !== "COMPLETED" ? (
            <button
              onClick={handleCompleteMission}
              disabled={submitting}
              className="flex items-center gap-2 rounded-md bg-success px-3 py-2 text-xs font-semibold text-success-foreground hover:bg-success/90 disabled:opacity-50"
            >
              <CheckCircle2 className="size-3.5" />
              {submitting ? "Submitting…" : "Complete mission"}
            </button>
          ) : (
            <StatusPill tone="success">Standby Available</StatusPill>
          )
        }
      />

      {feedback && (
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-xs text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Active mission"
          value={mission?.incidentId || "Standby"}
          tone={mission?.status === "COMPLETED" ? "success" : "critical"}
          icon={<Siren className="size-4" />}
          hint={mission?.status === "COMPLETED" ? "Awaiting dispatch" : "on scene 38 min"}
        />
        <MetricCard label="Victims in queue" value={victims.length} tone="warning" />
        <MetricCard
          label="Vehicle fuel"
          value={String(team?.fuel || "62")}
          unit="%"
          tone={team?.fuel < 40 ? "critical" : "warning"}
          icon={<Fuel className="size-4" />}
          hint={`range ${(team?.fuel || 62) * 2.2} km`}
        />
        <MetricCard label="Comms" value="Strong" tone="success" icon={<Radio className="size-4" />} hint="Rescue tactical net" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel className="overflow-hidden">
          <PanelHeader title="Live navigation" meta="next waypoint 320 m" />
          <div className="p-2">
            <MapCanvas height="clamp(320px, 44vh, 520px)" layers={{ shelters: true, hospitals: false }} />
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Victim queue" meta={`${victims.length} records`} />
            <ul className="divide-y divide-border">
              {victims.map((v: any) => (
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
              {equipment.map((e: any) => (
                <li key={e.item}>
                  <p className="flex justify-between text-xs">
                    <span>{e.item}</span>
                    <span className="num text-muted-foreground">{e.have}/{e.need}</span>
                  </p>
                  <div className="mt-1.5">
                    <Bar
                      value={(e.have / e.need) * 100}
                      tone={e.have < e.need / 2 ? "critical" : e.have < e.need ? "warning" : "success"}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Road status ahead" meta="hazard awareness" />
            <ul className="divide-y divide-border text-xs">
              {roads.map((r: any) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <span className="truncate">{r.name}</span>
                  <StatusPill
                    tone={
                      r.state === "blocked"
                        ? "critical"
                        : r.state === "flooded"
                        ? "info"
                        : r.state === "congested"
                        ? "warning"
                        : "success"
                    }
                  >
                    {r.state}
                  </StatusPill>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="File incident report" />
            <form className="space-y-3 p-4" onSubmit={handleReportSubmit}>
              <label className="block text-xs text-muted-foreground" htmlFor="inc">Related incident</label>
              <select
                id="inc"
                value={selectedIncident}
                onChange={(e) => setSelectedIncident(e.target.value)}
                className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm"
              >
                {incidents.map((i: any) => (
                  <option key={i.id} value={i.id}>{i.id} — {i.title}</option>
                ))}
              </select>
              <label className="block text-xs text-muted-foreground" htmlFor="obs">Field observation</label>
              <textarea
                id="obs"
                rows={3}
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm"
                placeholder="Describe hazards, casualties, resources required…"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? "Recording…" : "Submit report"}
              </button>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  );
}
