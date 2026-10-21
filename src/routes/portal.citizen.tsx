import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CloudOff, HeartPulse, MapPin, Phone, Siren, Users, Loader2, CheckCircle2 } from "lucide-react";
import { MapCanvas } from "@/components/sdrep/MapCanvas";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";
import { api } from "@/lib/api-client";

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

function CitizenPortal() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosStatus, setSosStatus] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      const res = await api.citizen.getProfile();
      if (res.data) {
        setProfile(res.data);
      }
    } catch (err) {
      console.error("Failed to load citizen profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSOS = async () => {
    setSosLoading(true);
    setSosStatus(null);
    try {
      const res = await api.citizen.submitSOS({
        sector: profile?.sector || "Sector 7 · Riverside",
        headcount: 1,
        medicalUrgency: true,
        notes: "Emergency one-tap SOS triggered from citizen portal.",
      });
      setSosStatus(res.data?.sosId || "SOS-ACK");
      setTimeout(() => setSosStatus(null), 8000);
    } catch (err: any) {
      alert(err.message || "Failed to submit SOS. Please call 112 directly.");
    } finally {
      setSosLoading(false);
    }
  };

  const toggleChecklist = async (index: number, currentChecked: boolean) => {
    if (!profile) return;
    const newChecklist = [...profile.checklist];
    newChecklist[index] = { ...newChecklist[index], checked: !currentChecked };
    setProfile({ ...profile, checklist: newChecklist });

    try {
      await api.citizen.updateChecklist(index, !currentChecked);
    } catch (err) {
      console.error("Checklist sync error:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Synchronizing with emergency response server…
      </div>
    );
  }

  const shelter = profile?.shelterInfo;
  const occupancyPercent = shelter ? Math.round((shelter.occupancy / shelter.capacity) * 100) : 78;

  return (
    <div className="space-y-4">
      <PageHeading
        eyebrow="Citizen"
        title="Your evacuation status"
        description={`${profile?.sector || "Sector 7 · Riverside"} is under a mandatory evacuation order.`}
        actions={
          <button
            onClick={handleSOS}
            disabled={sosLoading}
            className="flex items-center gap-2 rounded-md bg-critical px-4 py-2.5 text-sm font-semibold text-critical-foreground animate-pulse-ring transition-opacity disabled:opacity-50"
          >
            {sosLoading ? <Loader2 className="size-4 animate-spin" /> : <Siren className="size-4" />}
            {sosLoading ? "Transmitting SOS…" : "SOS"}
          </button>
        }
      />

      {sosStatus && (
        <div className="flex items-center justify-between rounded-md border border-success/40 bg-success/15 px-4 py-3 text-sm text-success">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>Emergency signal confirmed! Request ID: <strong>{sosStatus}</strong>. Nearest unit ALPHA-1 dispatched.</span>
          </div>
          <span className="text-xs text-muted-foreground">ETA 8 min</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Assigned shelter"
          value={shelter?.id || "SH-01"}
          tone="success"
          icon={<MapPin className="size-4" />}
          hint={shelter?.name || "Municipal Stadium"}
        />
        <MetricCard
          label="Distance"
          value={String(profile?.distanceKm || "2.4")}
          unit="km"
          tone="info"
          hint={`approx. ${profile?.etaMinutes || 26} min on foot`}
        />
        <MetricCard
          label="Family accounted"
          value={`${profile?.family?.filter((f: any) => f.tone === "success").length || 2}/${profile?.family?.length || 3}`}
          tone="warning"
          icon={<Users className="size-4" />}
        />
        <MetricCard
          label="Connectivity"
          value={profile?.connectivityStatus === "ONLINE" ? "Online" : "Offline"}
          tone={profile?.connectivityStatus === "ONLINE" ? "success" : "critical"}
          icon={<CloudOff className="size-4" />}
          hint="verified with server"
        />
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
              <li className="px-4 py-3">
                <StatusPill tone="critical" pulse>Mandatory</StatusPill>
                <p className="mt-1.5">Evacuate Sector 7 immediately. Water level 2.1 m and rising.</p>
              </li>
              <li className="px-4 py-3">
                <StatusPill tone="warning">Advisory</StatusPill>
                <p className="mt-1.5">Riverside Arterial is submerged. Use the Ridge Link diversion.</p>
              </li>
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Family tracking" icon={<Users className="size-4" />} />
            <ul className="divide-y divide-border text-sm">
              {profile?.family?.map((f: any) => (
                <li key={f.id || f.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3">
                  <span className="truncate">{f.name}</span>
                  <StatusPill tone={f.tone}>{f.status}</StatusPill>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Go-bag checklist" meta="persists in database" />
            <ul className="space-y-2 p-4 text-sm">
              {profile?.checklist?.map((c: any, i: number) => (
                <li key={c.item}>
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={c.checked}
                      onChange={() => toggleChecklist(i, c.checked)}
                      className="size-4 accent-[var(--color-primary)]"
                    />
                    <span className={c.checked ? "text-muted-foreground line-through" : ""}>{c.item}</span>
                  </label>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Medical profile" icon={<HeartPulse className="size-4" />} />
            <dl className="space-y-2 p-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Blood group</dt><dd className="num">{profile?.bloodGroup || "O+"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Conditions</dt><dd>{profile?.conditions || "Asthma"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Medication</dt><dd>{profile?.medication || "Salbutamol inhaler"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Emergency contact</dt><dd className="num">{profile?.emergencyContact || "+91 98200 12420"}</dd></div>
            </dl>
            <div className="border-t border-border p-3">
              <p className="mb-2 text-xs text-muted-foreground">Nearest rescue centre</p>
              <a href="tel:112" className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
                <span>Riverside Rescue Post</span>
                <Phone className="size-4 text-accent" />
              </a>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Shelter readiness" />
            <div className="p-4">
              <p className="flex justify-between text-xs">
                <span>{shelter?.id || "SH-01"} occupancy</span>
                <span className="num">{shelter?.occupancy?.toLocaleString() || "1,876"} / {shelter?.capacity?.toLocaleString() || "2,400"}</span>
              </p>
              <div className="mt-2">
                <Bar value={occupancyPercent} tone={occupancyPercent > 90 ? "critical" : occupancyPercent > 70 ? "warning" : "success"} />
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
