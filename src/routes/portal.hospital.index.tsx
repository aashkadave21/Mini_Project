import { useEffect, useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  UserPlus,
  HeartPulse,
  BedDouble,
  Ambulance,
  Droplet,
  Package,
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  History,
  UserCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  ShieldCheck,
  Lock,
  Hospital,
  Activity,
} from "lucide-react";
import { RoleGuard } from "@/components/sdrep/RoleGuard";
import { PortalShell, type PortalTabGroup } from "@/components/sdrep/PortalShell";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill, EmptyState } from "@/components/sdrep/primitives";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/portal/hospital/")({
  head: () => ({
    meta: [
      { title: "Hospital Portal — Casualty Intake & Triage | SDREP" },
      { name: "description", content: "Clinical intake command, mass-casualty triage sorting, ICU capacity, ambulance arrivals, and blood inventory." },
    ],
  }),
  component: HospitalDashboardPage,
});

const hospitalNavGroups: PortalTabGroup[] = [
  {
    label: "Clinical Operations",
    items: [
      { id: "overview", label: "Hospital Overview", icon: LayoutDashboard },
      { id: "intake", label: "Casualty Intake", icon: UserPlus },
      { id: "triage", label: "Triage Queue", icon: HeartPulse, badge: "MCI", badgeTone: "critical" },
      { id: "beds", label: "Beds & ICU", icon: BedDouble },
      { id: "ambulances", label: "Ambulance Arrivals", icon: Ambulance, badge: "4 inbound", badgeTone: "warning" },
    ],
  },
  {
    label: "Medical Logistics",
    items: [
      { id: "blood", label: "Blood Inventory", icon: Droplet, badge: "Low O-", badgeTone: "critical" },
      { id: "supplies", label: "Medical Supplies", icon: Package },
      { id: "diversion", label: "Diversion Status", icon: AlertTriangle },
      { id: "transfers", label: "Patient Transfers", icon: ArrowRightLeft },
    ],
  },
  {
    label: "Governance & Audit",
    items: [
      { id: "reports", label: "Reports & Analytics", icon: BarChart3 },
      { id: "audit", label: "Audit Log", icon: History },
      { id: "profile", label: "Profile & Settings", icon: UserCheck },
    ],
  },
];

function HospitalDashboardPage() {
  return (
    <RoleGuard allowedRoles={["HOSPITAL_STAFF"]} loginRoute="/portal/hospital/login" portalTitle="Hospital Operations Portal">
      <HospitalDashboardContent />
    </RoleGuard>
  );
}

function HospitalDashboardContent() {
  const { user } = useAuth();
  const hospitalId = user?.associatedEntityId || "HSP-1";
  const [activeTab, setActiveTab] = useState("overview");

  const [data, setData] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Casualty intake form
  const [tag, setTag] = useState("Red");
  const [presentation, setPresentation] = useState("");

  // Triage filter
  const [triageFilter, setTriageFilter] = useState<"ALL" | "Red" | "Yellow" | "Green">("ALL");

  // Diversion modal
  const [showDiversionModal, setShowDiversionModal] = useState(false);
  const [diversionReason, setDiversionReason] = useState("Critical surge capacity exceeded (ICU < 2 beds)");

  // Blood stock replenishment
  const [selectedBloodGroup, setSelectedBloodGroup] = useState("O-");
  const [bloodUnitsToAdd, setBloodUnitsToAdd] = useState(5);

  // Passkey
  const [currPass, setCurrPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState<string | null>(null);

  const fetchHospitalData = useCallback(async () => {
    try {
      const [hRes, aRes] = await Promise.all([
        api.hospital.getDetails(hospitalId),
        api.analytics.getAuditLogs().catch(() => ({ data: [] })),
      ]);

      if (hRes.data) {
        setData(hRes.data);
      }
      if (aRes.data) {
        setAuditLogs(aRes.data);
      }
    } catch (err) {
      console.error("Failed to load hospital operations:", err);
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    fetchHospitalData();
  }, [fetchHospitalData]);

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
      await fetchHospitalData();
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback(`Casualty intake failed: ${err.message || "Server error. Please retry."}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCaseStatus = async (caseId: string, newStatus: string) => {
    try {
      await api.hospital.updateTriageStatus(hospitalId, caseId, { status: newStatus });
      setFeedback(`Case ${caseId} status updated to ${newStatus}.`);
      await fetchHospitalData();
    } catch (err: any) {
      setFeedback(`Status update failed: ${err.message || "Please retry."}`);
    }
  };

  const handleConfirmArrival = async (ambId: string) => {
    try {
      const res = await api.hospital.confirmAmbulanceArrival(hospitalId, ambId);
      setFeedback(res.message);
      await fetchHospitalData();
    } catch (err: any) {
      setFeedback(`Arrival confirmation failed: ${err.message || "Please retry."}`);
    }
  };

  const handleToggleDiversion = async () => {
    setSubmitting(true);
    try {
      const isCurrentlyDiverting = Boolean(data?.diversion);
      const res = await api.hospital.declareDiversion(
        hospitalId,
        !isCurrentlyDiverting,
        isCurrentlyDiverting ? undefined : diversionReason
      );
      setFeedback(res.message);
      setShowDiversionModal(false);
      await fetchHospitalData();
    } catch (err: any) {
      setFeedback(`Diversion toggle failed: ${err.message || "Please retry."}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateBlood = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const existing = (data?.blood || []).find((b: any) => b.group === selectedBloodGroup);
      const currentUnits = existing ? existing.units : 10;
      const newTotal = currentUnits + Number(bloodUnitsToAdd);
      await api.hospital.updateBloodStock(hospitalId, selectedBloodGroup, newTotal);
      setFeedback(`Replenished ${bloodUnitsToAdd} units of ${selectedBloodGroup} blood.`);
      await fetchHospitalData();
    } catch (err: any) {
      setFeedback(`Blood stock update failed: ${err.message || "Please retry."}`);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currPass || !newPass) return;
    try {
      const res = await api.auth.changePassword({ currentPassword: currPass, newPassword: newPass });
      setPassMsg(res.message);
      setCurrPass("");
      setNewPass("");
      setTimeout(() => setPassMsg(null), 6000);
    } catch (err: any) {
      setPassMsg(err.message || "Failed to update passkey.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-info" />
        <p className="text-sm">Connecting to clinical surge & casualty intake registry…</p>
      </div>
    );
  }

  const triageQueue = data?.triageQueue || [];
  const arrivals = data?.ambulances || [];
  const blood = data?.blood || [];
  const isDiverting = Boolean(data?.diversion);

  const filteredQueue = triageQueue.filter((c: any) => {
    if (triageFilter === "ALL") return true;
    return c.tag === triageFilter;
  });

  return (
    <PortalShell
      portalTitle="Hospital Operations"
      portalSubtitle="Clinical casualty intake, triage & surge capacity"
      icon={Hospital}
      groups={hospitalNavGroups}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      loginRoute="/portal/hospital/login"
      badgeContent={
        <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold ${
          isDiverting ? "bg-critical text-critical-foreground" : "border border-success/40 bg-success/10 text-success"
        }`}>
          {isDiverting ? "DIVERSION ACTIVE" : "INTAKE OPEN"}
        </div>
      }
    >
      {feedback && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-success/40 bg-success/15 px-4 py-3 text-xs text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* TAB 1: HOSPITAL OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow={`${data?.id || hospitalId} · ${data?.name || "Hospital"}`}
            title="Hospital Operations Overview"
            description={
              isDiverting
                ? "⚠️ HOSPITAL DIVERSION ACTIVE. Inbound emergency traffic redirected to auxiliary trauma centres."
                : `Mass casualty protocol active. Emergency department at ${data?.triageLoad || 88}% triage surge load.`
            }
            actions={
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("intake")}
                  className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80"
                >
                  <UserPlus className="size-3.5" /> Intake Casualty
                </button>
                <button
                  onClick={() => setShowDiversionModal(true)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold text-white transition-colors ${
                    isDiverting ? "bg-success hover:bg-success/90" : "bg-critical hover:bg-critical/90"
                  }`}
                >
                  <HeartPulse className="size-3.5" />
                  {isDiverting ? "Lift Diversion" : "Declare Diversion"}
                </button>
              </div>
            }
          />

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard
              label="Available Free Beds"
              value={String(data?.bedsFree || "72")}
              unit={`/${data?.beds || 640}`}
              tone={data?.bedsFree < 30 ? "critical" : "warning"}
              icon={<BedDouble className="size-4" />}
              hint={`${Math.round(((data?.beds - data?.bedsFree) / data?.beds) * 100)}% ward occupancy`}
            />
            <MetricCard
              label="ICU Beds Available"
              value={String(data?.icuFree || "5")}
              unit={`/${data?.icu || 48}`}
              tone="critical"
              icon={<HeartPulse className="size-4" />}
              hint="High clinical surge"
            />
            <MetricCard
              label="Inbound Casualties"
              value={String(data?.incoming || "11")}
              tone="critical"
              icon={<Ambulance className="size-4" />}
              hint="Next 25 min arrival"
            />
            <MetricCard
              label="Blood Reserve Deficit"
              value={String(blood.filter((b: any) => b.units < b.min).length || "1")}
              tone="warning"
              icon={<Droplet className="size-4" />}
              hint="O-negative under threshold"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Panel>
              <PanelHeader title="Active Triage Queue (Top Priorities)" meta={`${triageQueue.length} casualties awaiting`} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-xs">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="label-eyebrow px-4 py-2 font-normal">Case ID</th>
                      <th className="label-eyebrow px-4 py-2 font-normal">Triage Tag</th>
                      <th className="label-eyebrow px-4 py-2 font-normal">Clinical Presentation</th>
                      <th className="label-eyebrow px-4 py-2 font-normal">Wait Time</th>
                      <th className="label-eyebrow px-4 py-2 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {triageQueue.slice(0, 5).map((c: any) => (
                      <tr key={c.id} className="hover:bg-surface-2">
                        <td className="num px-4 py-3 font-semibold text-foreground">{c.id}</td>
                        <td className="px-4 py-3">
                          <StatusPill tone={c.tag === "Red" ? "critical" : c.tag === "Yellow" ? "warning" : "success"} pulse={c.tag === "Red"}>
                            {c.tag}
                          </StatusPill>
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">{c.desc || c.presentation}</td>
                        <td className="num px-4 py-3 text-muted-foreground">{c.wait}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-[10px] text-accent">{c.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <div className="space-y-4">
              <Panel>
                <PanelHeader title="Inbound Ambulances" icon={<Ambulance className="size-4" />} />
                <ul className="divide-y divide-border text-xs">
                  {arrivals.map((a: any) => (
                    <li key={a.id || a.unit} className="p-3.5 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-foreground">{a.unit}</p>
                        <p className="text-[11px] text-muted-foreground">{a.cases} casualties · ETA {a.eta}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusPill tone={a.triage === "Red" ? "critical" : "warning"} pulse={a.triage === "Red"}>
                          {a.triage}
                        </StatusPill>
                        {!a.arrived && (
                          <button
                            onClick={() => handleConfirmArrival(a.id)}
                            className="rounded border border-border bg-surface-2 px-2 py-1 text-[10px] hover:bg-surface-3"
                          >
                            Confirm Arrival
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CASUALTY INTAKE */}
      {activeTab === "intake" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Triage Intake Desk"
            title="Casualty Registration"
            description="Register incoming casualties into the emergency department queue with standardized START triage classification."
          />

          <Panel className="border-accent max-w-2xl">
            <PanelHeader title="Intake Casualty Case" icon={<UserPlus className="size-4 text-accent" />} />
            <form className="p-5 space-y-4" onSubmit={handleTriageSubmit}>
              <div>
                <label className="block text-xs font-semibold text-foreground">START Triage Classification *</label>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  {[
                    { tag: "Red", label: "Red (Immediate)", desc: "Life-threatening, shock, airway compromise" },
                    { tag: "Yellow", label: "Yellow (Delayed)", desc: "Serious fractures, stable burns, urgent care" },
                    { tag: "Green", label: "Green (Minimal)", desc: "Walking wounded, ambulatory lacerations" },
                  ].map((cat) => (
                    <button
                      key={cat.tag}
                      type="button"
                      onClick={() => setTag(cat.tag)}
                      className={`rounded-lg border p-3 text-left transition-all ${
                        tag === cat.tag
                          ? cat.tag === "Red"
                            ? "border-critical bg-critical/15 text-critical"
                            : cat.tag === "Yellow"
                            ? "border-warning bg-warning/15 text-warning"
                            : "border-success bg-success/15 text-success"
                          : "border-border bg-surface-2 text-muted-foreground"
                      }`}
                    >
                      <span className="font-bold block">{cat.label}</span>
                      <span className="text-[10px] opacity-80 block mt-1">{cat.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">Clinical Presentation & Initial Findings *</label>
                <textarea
                  rows={3}
                  required
                  value={presentation}
                  onChange={(e) => setPresentation(e.target.value)}
                  placeholder="e.g. Blunt abdominal trauma following structural collapse, hypotensive, BP 90/60…"
                  className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-accent py-2.5 text-xs font-bold text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
              >
                {submitting ? "Registering…" : "Admit to Emergency Triage Queue"}
              </button>
            </form>
          </Panel>
        </div>
      )}

      {/* TAB 3: TRIAGE QUEUE */}
      {activeTab === "triage" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Prioritized Clinical Scheduling"
            title="Triage Queue"
            description="Algorithmically sorted casualty queue prioritizing resuscitation cases over delayed and ambulatory patients."
          />

          <div className="flex items-center gap-2">
            {(["ALL", "Red", "Yellow", "Green"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTriageFilter(filter)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  triageFilter === filter
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-surface-2 text-muted-foreground hover:bg-surface-3"
                }`}
              >
                {filter === "ALL" ? "All Priorities" : `${filter} Tag Only`}
              </button>
            ))}
          </div>

          <Panel>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-xs">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="label-eyebrow px-4 py-2 font-normal">Case ID</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Priority Tag</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Presentation</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Waiting</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Workflow Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredQueue.map((c: any) => (
                    <tr key={c.id} className="hover:bg-surface-2">
                      <td className="num px-4 py-3 font-bold text-foreground">{c.id}</td>
                      <td className="px-4 py-3">
                        <StatusPill tone={c.tag === "Red" ? "critical" : c.tag === "Yellow" ? "warning" : "success"} pulse={c.tag === "Red"}>
                          {c.tag}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground max-w-xs">{c.desc}</td>
                      <td className="num px-4 py-3 text-muted-foreground">{c.wait}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {c.status !== "IN_TREATMENT" && (
                            <button
                              onClick={() => handleUpdateCaseStatus(c.id, "IN_TREATMENT")}
                              className="rounded border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] text-primary hover:bg-primary/20"
                            >
                              In Treatment
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateCaseStatus(c.id, "DISCHARGED")}
                            className="rounded border border-border bg-surface-3 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            Discharge
                          </button>
                          <button
                            onClick={() => handleUpdateCaseStatus(c.id, "TRANSFERRED")}
                            className="rounded border border-border bg-surface-3 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            Transfer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 4: BEDS & ICU */}
      {activeTab === "beds" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Clinical Bed Census"
            title="Bed & ICU Capacity"
            description="Manage clinical bed allocations, acute care wards, and ICU ventilators in real time."
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Panel className="p-5 space-y-3">
              <h3 className="font-semibold text-sm text-foreground">Emergency Department & Inpatient Beds</h3>
              <p className="num text-3xl font-bold text-foreground">{data?.bedsFree || 72} <span className="text-sm font-normal text-muted-foreground">/ {data?.beds || 640} available</span></p>
              <Bar value={((data?.beds - data?.bedsFree) / data?.beds) * 100} tone={data?.bedsFree < 30 ? "critical" : "warning"} />
              <p className="text-xs text-muted-foreground mt-2">
                Occupied: {data?.beds - data?.bedsFree} beds. Surge buffer maintained at 10%.
              </p>
            </Panel>

            <Panel className="p-5 space-y-3">
              <h3 className="font-semibold text-sm text-foreground">Intensive Care Unit (ICU) Capacity</h3>
              <p className="num text-3xl font-bold text-critical">{data?.icuFree || 5} <span className="text-sm font-normal text-muted-foreground">/ {data?.icu || 48} available</span></p>
              <Bar value={((data?.icu - data?.icuFree) / data?.icu) * 100} tone="critical" />
              <p className="text-xs text-critical font-medium mt-2">
                ⚠️ Critical threshold: ICU capacity exceeds 89%. Ventilator allocation protocol active.
              </p>
            </Panel>
          </div>
        </div>
      )}

      {/* TAB 5: AMBULANCE ARRIVALS */}
      {activeTab === "ambulances" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="EMS Handoff"
            title="Ambulance Fleet Arrivals"
            description="Track inbound ground and air ambulance transports, triage handoff documentation, and ETA tracking."
          />

          <Panel>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-xs">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="label-eyebrow px-4 py-2 font-normal">Transport Unit</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Casualty Count</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Primary Triage</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Corridor ETA</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Handoff Confirmation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {arrivals.map((a: any) => (
                    <tr key={a.id || a.unit} className="hover:bg-surface-2">
                      <td className="num px-4 py-3 font-bold text-foreground">{a.unit}</td>
                      <td className="num px-4 py-3 font-semibold text-foreground">{a.cases} casualties</td>
                      <td className="px-4 py-3">
                        <StatusPill tone={a.triage === "Red" ? "critical" : "warning"} pulse={a.triage === "Red"}>
                          {a.triage}
                        </StatusPill>
                      </td>
                      <td className="num px-4 py-3 text-accent font-medium">{a.arrived ? "Arrived" : a.eta}</td>
                      <td className="px-4 py-3">
                        {a.arrived ? (
                          <span className="text-success font-medium text-xs flex items-center gap-1">
                            <CheckCircle2 className="size-3.5" /> Handoff Complete
                          </span>
                        ) : (
                          <button
                            onClick={() => handleConfirmArrival(a.id)}
                            className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
                          >
                            Confirm Arrival & Handoff
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 6: BLOOD INVENTORY */}
      {activeTab === "blood" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Transfusion Services"
            title="Blood Bank Inventory"
            description="Monitor live blood stocks across all groups, enforce emergency minimum reserve thresholds, and requisition replenishment."
          />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Panel>
              <PanelHeader title="Blood Group Reserve Levels" />
              <div className="p-5 space-y-4">
                {blood.map((b: any) => {
                  const pct = Math.round((b.units / (b.min * 2)) * 100);
                  const isLow = b.units < b.min;
                  return (
                    <div key={b.group} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-foreground text-sm">{b.group}</span>
                        <span className={`num font-semibold ${isLow ? "text-critical" : "text-muted-foreground"}`}>
                          {b.units} units (Min: {b.min})
                        </span>
                      </div>
                      <Bar value={pct} tone={isLow ? "critical" : "success"} />
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Replenish Blood Stock" icon={<Droplet className="size-4 text-critical" />} />
              <form className="p-5 space-y-3.5" onSubmit={handleUpdateBlood}>
                <div>
                  <label className="block text-xs text-muted-foreground">Select Blood Group</label>
                  <select
                    value={selectedBloodGroup}
                    onChange={(e) => setSelectedBloodGroup(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  >
                    {blood.map((b: any) => (
                      <option key={b.group} value={b.group}>{b.group}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground">Units to Replenish</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={bloodUnitsToAdd}
                    onChange={(e) => setBloodUnitsToAdd(parseInt(e.target.value) || 1)}
                    className="num mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground"
                >
                  Record Blood Delivery
                </button>
              </form>
            </Panel>
          </div>
        </div>
      )}

      {/* TAB 7: MEDICAL SUPPLIES */}
      {activeTab === "supplies" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Clinical Equipment"
            title="Medical Supplies & Consumables"
            description="Monitor clinical supplies, oxygen cylinders, trauma laparotomy kits, and portable ventilators."
          />

          <Panel>
            <div className="p-5 space-y-4">
              {[
                { item: "Medical Oxygen Cylinders (D-Type)", have: 48, need: 60, unit: "Cylinders" },
                { item: "Trauma Laparotomy Kits", have: 14, need: 20, unit: "Kits" },
                { item: "IV Saline & Ringer's Lactate (500ml)", have: 420, need: 500, unit: "Bags" },
                { item: "Portable Transport Ventilators", have: 6, need: 8, unit: "Units" },
                { item: "Endotracheal Intubation Sets", have: 22, need: 25, unit: "Sets" },
              ].map((s) => {
                const pct = Math.round((s.have / s.need) * 100);
                return (
                  <div key={s.item} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-foreground">{s.item}</span>
                      <span className="num text-muted-foreground">{s.have} / {s.need} {s.unit}</span>
                    </div>
                    <Bar value={pct} tone={pct < 50 ? "critical" : pct < 80 ? "warning" : "success"} />
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 8: DIVERSION */}
      {activeTab === "diversion" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Surge Traffic Management"
            title="Hospital Diversion & EMS Routing"
            description="When hospital beds and ICU capacity are exhausted, declaring diversion automatically instructs EMS dispatch to route ambulances to auxiliary trauma facilities."
          />

          <Panel className={isDiverting ? "border-critical bg-critical/5" : ""}>
            <PanelHeader title="Operational Diversion Status" />
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <StatusPill tone={isDiverting ? "critical" : "success"} pulse={isDiverting}>
                  {isDiverting ? "DIVERSION DECLARED" : "NORMAL RECEPTION"}
                </StatusPill>
                <span className="text-xs text-muted-foreground font-mono">
                  {isDiverting ? data?.diversionReason || "Surge threshold exceeded" : "All casualty categories accepted"}
                </span>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                Declaring diversion alters regional ambulance dispatch telemetry. Inbound red and yellow cases are automatically diverted to Riverside Trauma Centre (HSP-2) or North Ridge Multispecialty (HSP-3).
              </p>

              <button
                onClick={() => setShowDiversionModal(true)}
                className={`rounded-md px-4 py-2 text-xs font-bold text-white transition-colors ${
                  isDiverting ? "bg-success hover:bg-success/90" : "bg-critical hover:bg-critical/90"
                }`}
              >
                {isDiverting ? "Lift Hospital Diversion" : "Declare Hospital Diversion"}
              </button>
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 9: TRANSFERS */}
      {activeTab === "transfers" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Inter-facility Transport"
            title="Patient Transfers & Referrals"
            description="Manage inter-facility transfer requests to specialty neurotrauma and pediatric units."
          />

          <Panel>
            <div className="p-5 space-y-3 text-xs">
              <div className="rounded-md border border-border bg-surface-2 p-3 flex justify-between items-center">
                <div>
                  <span className="font-semibold text-foreground">Case C-8841 → HSP-2 Riverside Trauma</span>
                  <p className="text-muted-foreground mt-0.5">Crush injury, vascular surgery required</p>
                </div>
                <StatusPill tone="info">Transfer En Route</StatusPill>
              </div>

              <div className="rounded-md border border-border bg-surface-2 p-3 flex justify-between items-center">
                <div>
                  <span className="font-semibold text-foreground">Case C-8840 → HSP-3 North Ridge</span>
                  <p className="text-muted-foreground mt-0.5">Smoke inhalation, hyperbaric oxygen requested</p>
                </div>
                <StatusPill tone="success">Accepted by Receiving ED</StatusPill>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 10: REPORTS */}
      {activeTab === "reports" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Clinical Analytics"
            title="Hospital Surge Reports"
            description="Casualty admission distribution, triage category breakdown, and bed utilization."
          />

          <Panel>
            <PanelHeader title="Daily Casualty Triage Summary" />
            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded border border-border bg-surface-2 p-3">
                <span className="label-eyebrow">Red Immediate</span>
                <p className="mt-1 num text-xl font-bold text-critical">14 cases</p>
              </div>
              <div className="rounded border border-border bg-surface-2 p-3">
                <span className="label-eyebrow">Yellow Delayed</span>
                <p className="mt-1 num text-xl font-bold text-warning">38 cases</p>
              </div>
              <div className="rounded border border-border bg-surface-2 p-3">
                <span className="label-eyebrow">Green Minimal</span>
                <p className="mt-1 num text-xl font-bold text-success">76 cases</p>
              </div>
              <div className="rounded border border-border bg-surface-2 p-3">
                <span className="label-eyebrow">Average Wait (Red)</span>
                <p className="mt-1 num text-xl font-bold text-foreground">0.8 min</p>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 11: AUDIT LOG */}
      {activeTab === "audit" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Regulatory Record"
            title="Clinical Audit Log"
            description="Cryptographic audit trail of all casualty admissions, triage category modifications, and diversion orders."
          />

          <Panel>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full min-w-[500px] text-xs">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="label-eyebrow px-4 py-2 font-normal">Audit ID</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Timestamp</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Actor</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Action</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {auditLogs.slice(0, 15).map((log) => (
                    <tr key={log.id} className="hover:bg-surface-2">
                      <td className="px-4 py-2.5 font-bold text-foreground">{log.id}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td className="px-4 py-2.5 text-accent">{log.actor}</td>
                      <td className="px-4 py-2.5 font-medium text-foreground">{log.action}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{log.target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 12: PROFILE & SETTINGS */}
      {activeTab === "profile" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Clinical Personnel"
            title="Hospital Profile & Passkey"
            description="Facility identification, emergency department coordinator profile, and security settings."
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="Facility Identification" icon={<Hospital className="size-4" />} />
              <dl className="p-5 space-y-3 text-xs">
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">Facility Name</dt>
                  <dd className="font-semibold text-foreground">{data?.name || "City General Hospital"}</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">Hospital Facility ID</dt>
                  <dd className="num font-bold text-foreground">{data?.id || "HSP-1"}</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">Clinical Coordinator</dt>
                  <dd className="font-semibold text-foreground">{user?.fullName || "Dr. Tariq Sheikh"}</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">Clinical Role</dt>
                  <dd className="font-medium text-foreground">Triage & Emergency Coordinator</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Authority</dt>
                  <dd className="font-semibold text-success">State Emergency Medical Services</dd>
                </div>
              </dl>
            </Panel>

            <Panel>
              <PanelHeader title="Update Security Passkey" icon={<Lock className="size-4" />} />
              <form className="p-5 space-y-3" onSubmit={handleChangePassword}>
                {passMsg && (
                  <div className="rounded border border-info/30 bg-info/10 p-2 text-xs text-info">
                    {passMsg}
                  </div>
                )}
                <div>
                  <label className="block text-xs text-muted-foreground">Current Passkey</label>
                  <input
                    type="password"
                    required
                    value={currPass}
                    onChange={(e) => setCurrPass(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground">New Passkey (min 8 chars)</label>
                  <input
                    type="password"
                    required
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-md bg-secondary py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80"
                >
                  Update Passkey
                </button>
              </form>
            </Panel>
          </div>
        </div>
      )}

      {/* Diversion Modal */}
      {showDiversionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-foreground">
              {isDiverting ? "Confirm Lifting Hospital Diversion" : "Declare Hospital Diversion"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {isDiverting
                ? "Resuming normal casualty reception will reopen EMS ambulance routing to City General Hospital."
                : "Declaring diversion notifies the Disaster Command Centre and automatically reroutes incoming ambulances to HSP-2 and HSP-3."}
            </p>

            {!isDiverting && (
              <div className="mt-4">
                <label className="block text-xs text-muted-foreground">Diversion Rationale</label>
                <input
                  type="text"
                  value={diversionReason}
                  onChange={(e) => setDiversionReason(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                />
              </div>
            )}

            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowDiversionModal(false)}
                className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleToggleDiversion}
                className={`rounded-md px-4 py-2 text-xs font-bold text-white ${
                  isDiverting ? "bg-success" : "bg-critical"
                }`}
              >
                {submitting ? "Transmitting…" : isDiverting ? "Confirm Resume Intake" : "Confirm Declare Diversion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
