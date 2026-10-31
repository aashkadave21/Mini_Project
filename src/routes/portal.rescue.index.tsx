import { useEffect, useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Kanban,
  Users2,
  Map as MapIcon,
  Shield,
  Package,
  Radio,
  FileText,
  UserCheck,
  Siren,
  Fuel,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Send,
  Loader2,
  RefreshCw,
  Lock,
  Wifi,
  WifiOff,
  UploadCloud,
  Database,
} from "lucide-react";
import { RoleGuard } from "@/components/sdrep/RoleGuard";
import { PortalShell, type PortalTabGroup } from "@/components/sdrep/PortalShell";
import { MapCanvas } from "@/components/sdrep/MapCanvas";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill, EmptyState } from "@/components/sdrep/primitives";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/portal/rescue/")({
  head: () => ({
    meta: [
      { title: "Rescue Team Portal — Missions & Field Navigation | SDREP" },
      { name: "description", content: "Tactical mission tasking, victim triage extraction, equipment inventory, and real-time field reports." },
    ],
  }),
  component: RescueDashboardPage,
});

const rescueNavGroups: PortalTabGroup[] = [
  {
    label: "Tactical Operations",
    items: [
      { id: "overview", label: "Operations Overview", icon: LayoutDashboard },
      { id: "missions", label: "Mission Board", icon: Kanban, badge: "Active", badgeTone: "critical" },
      { id: "queue", label: "Victim & Incident Queue", icon: Users2, badge: "4", badgeTone: "warning" },
      { id: "map", label: "Live Map & Navigation", icon: MapIcon },
    ],
  },
  {
    label: "Readiness & Reporting",
    items: [
      { id: "team", label: "Team & Availability", icon: Shield },
      { id: "equipment", label: "Equipment & Resources", icon: Package },
      { id: "comms", label: "Communication Centre", icon: Radio, badge: "Net-1", badgeTone: "info" },
      { id: "reports", label: "Mission Reports", icon: FileText },
      { id: "profile", label: "Profile & Settings", icon: UserCheck },
    ],
  },
];

function RescueDashboardPage() {
  return (
    <RoleGuard allowedRoles={["RESCUE_TEAM"]} loginRoute="/portal/rescue/login" portalTitle="Rescue Team Portal">
      <RescueDashboardContent />
    </RoleGuard>
  );
}

function RescueDashboardContent() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Scenario G: Offline Simulation & Local Queue State
  const [isOfflineSimulated, setIsOfflineSimulated] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sdrep_rescue_offline_sim") === "true";
    }
    return false;
  });

  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("sdrep_rescue_offline_queue");
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [syncingOffline, setSyncingOffline] = useState(false);
  const [lastSyncStats, setLastSyncStats] = useState<any | null>(null);

  // Field Report form
  const [selectedIncident, setSelectedIncident] = useState("INC-4471");
  const [observation, setObservation] = useState("");

  // Comms announcement
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastLog, setBroadcastLog] = useState<string[]>([
    "[00:41] Command: Embankment breach at Sector 7 escalated. ALPHA-1 maintaining station.",
    "[00:32] ALPHA-1: Deployed 2 Gemini watercraft. Extracted 4 casualties from rooftop.",
    "[00:15] BRAVO-2: On scene at Dock Road warehouse fire. Sector perimeter secured.",
  ]);

  // Password change
  const [currPass, setCurrPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [activeRes, reportsRes, teamsRes] = await Promise.all([
        api.rescue.getActive(),
        api.rescue.getReports().catch(() => ({ data: [] })),
        api.rescue.getAllTeams().catch(() => ({ data: [] })),
      ]);

      if (activeRes.data) {
        setData(activeRes.data);
        if (activeRes.data.mission?.incidentId) {
          setSelectedIncident(activeRes.data.mission.incidentId);
        } else if (activeRes.data.incidents?.length > 0) {
          setSelectedIncident(activeRes.data.incidents[0].id);
        }
      }
      if (reportsRes.data) {
        setReports(reportsRes.data);
      }
      if (teamsRes.data) {
        setAllTeams(teamsRes.data);
      }
    } catch (err) {
      console.error("Failed to load rescue operations data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Scenario G: Toggle Offline Simulation
  const handleToggleOffline = () => {
    const nextState = !isOfflineSimulated;
    setIsOfflineSimulated(nextState);
    if (typeof window !== "undefined") {
      localStorage.setItem("sdrep_rescue_offline_sim", String(nextState));
    }
    setFeedback(nextState
      ? "OFFLINE SIMULATION ACTIVE: Network communication disconnected. Status transitions and field reports will be safely queued in local browser storage."
      : "Network connectivity restored: Central command communication online."
    );
  };

  // Scenario G: Reconnect and Synchronise Queue Idempotently
  const handleReconnectAndSync = async () => {
    if (offlineQueue.length === 0) {
      setFeedback("No offline updates currently queued.");
      return;
    }
    setSyncingOffline(true);
    try {
      const res = await api.rescue.syncOffline(offlineQueue);
      setLastSyncStats(res);
      // Cache last synced operations in sessionStorage for duplicate retry testing
      if (typeof window !== "undefined") {
        sessionStorage.setItem("sdrep_last_synced_ops", JSON.stringify(offlineQueue));
        localStorage.removeItem("sdrep_rescue_offline_queue");
        localStorage.setItem("sdrep_rescue_offline_sim", "false");
      }
      setOfflineQueue([]);
      setIsOfflineSimulated(false);
      setFeedback(`Reconnected & Synchronised! ${res.processedCount} update(s) applied to central database. ${res.deduplicatedCount} duplicate(s) safely ignored.`);
      await fetchData();
    } catch (err: any) {
      setFeedback(`Sync failed: ${err.message}`);
    } finally {
      setSyncingOffline(false);
    }
  };

  // Scenario G: Test Duplicate Retry (Prove Idempotency)
  const handleTestDuplicateRetry = async () => {
    try {
      const lastOps = typeof window !== "undefined" ? sessionStorage.getItem("sdrep_last_synced_ops") : null;
      if (!lastOps) {
        setFeedback("No previously synced offline batch found. Please perform an offline sync first.");
        return;
      }
      const parsed = JSON.parse(lastOps);
      const res = await api.rescue.syncOffline(parsed);
      setLastSyncStats(res);
      setFeedback(`Idempotency Verified! Resent ${parsed.length} identical operation(s): Central server safely ignored ${res.deduplicatedCount} duplicate(s) without duplicating records.`);
    } catch (err: any) {
      setFeedback(`Duplicate test error: ${err.message}`);
    }
  };

  const handleStatusChange = async (status: string, outcome?: string) => {
    if (!data?.mission) return;

    // Scenario G: If offline, queue locally
    if (isOfflineSimulated) {
      const op = {
        opId: `OP-STATUS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        teamId: data?.team?.id || "T1",
        status: status === "EN_ROUTE" ? "en-route" : status === "ON_SCENE" ? "on-scene" : status === "COMPLETED" ? "available" : status.toLowerCase(),
        observation: outcome || `Mission status updated to ${status} by field unit (offline buffered).`,
        incidentId: data?.mission?.incidentId,
        timestamp: new Date().toISOString(),
      };
      const nextQueue = [...offlineQueue, op];
      setOfflineQueue(nextQueue);
      if (typeof window !== "undefined") {
        localStorage.setItem("sdrep_rescue_offline_queue", JSON.stringify(nextQueue));
      }
      setFeedback(`[OFFLINE QUEUED] Mission status transition to '${status}' saved locally (OpID: ${op.opId}).`);
      // Optimistic local update
      setData((prev: any) => ({
        ...prev,
        mission: { ...prev.mission, status },
        team: { ...prev.team, status: op.status },
      }));
      return;
    }

    setSubmitting(true);
    try {
      await api.rescue.updateMissionStatus(
        data.mission.id,
        status,
        outcome || `Mission status updated to ${status} by field unit.`
      );
      setFeedback(`Mission ${data.mission.id} status successfully transitioned to ${status}.`);
      await fetchData();
    } catch (err: any) {
      setFeedback(`Mission update failed: ${err.message || "Server error. Please retry."}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTeamDuty = async () => {
    if (!data?.team) return;
    const newStatus = data.team.status === "available" ? "on-scene" : "available";

    // Scenario G: If offline, queue locally
    if (isOfflineSimulated) {
      const op = {
        opId: `OP-TEAM-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        teamId: data.team.id,
        status: newStatus,
        timestamp: new Date().toISOString(),
      };
      const nextQueue = [...offlineQueue, op];
      setOfflineQueue(nextQueue);
      if (typeof window !== "undefined") {
        localStorage.setItem("sdrep_rescue_offline_queue", JSON.stringify(nextQueue));
      }
      setFeedback(`[OFFLINE QUEUED] Team readiness update to '${newStatus}' saved locally.`);
      setData((prev: any) => ({
        ...prev,
        team: { ...prev.team, status: newStatus },
      }));
      return;
    }

    try {
      await api.rescue.updateTeamStatus(data.team.id, newStatus);
      setFeedback(`Team status updated to '${newStatus}'.`);
      await fetchData();
    } catch (err: any) {
      setFeedback(err.message || "Failed to update team readiness. Please retry.");
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!observation.trim()) return;

    // Scenario G: If offline, queue locally
    if (isOfflineSimulated) {
      const op = {
        opId: `OP-REPORT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        teamId: data?.team?.id || "T1",
        observation: observation.trim(),
        incidentId: selectedIncident,
        timestamp: new Date().toISOString(),
      };
      const nextQueue = [...offlineQueue, op];
      setOfflineQueue(nextQueue);
      if (typeof window !== "undefined") {
        localStorage.setItem("sdrep_rescue_offline_queue", JSON.stringify(nextQueue));
      }
      setFeedback(`[OFFLINE QUEUED] Field observation saved locally in queue.`);
      setObservation("");
      return;
    }

    setSubmitting(true);
    try {
      await api.rescue.submitReport(selectedIncident, observation.trim());
      setFeedback(`Observation report recorded for incident ${selectedIncident}.`);
      setObservation("");
      await fetchData();
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback(`Report submission failed: ${err.message || "Incident may not exist in DB. Please verify."}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;

    const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const line = `[${time}] ${data?.team?.callsign || "ALPHA-1"}: ${broadcastMessage.trim()}`;
    setBroadcastLog([line, ...broadcastLog]);
    setBroadcastMessage("");
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
      setPassMsg(err.message || "Failed to change passkey.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-warning" />
        <p className="text-sm">Acquiring tactical mission tasking & telemetry feed…</p>
      </div>
    );
  }

  const team = data?.team;
  const mission = data?.mission;
  const victims = data?.victims || [];
  const equipment = data?.equipment || [];
  const incidents = data?.incidents || [];
  const roads = data?.roads || [];

  return (
    <PortalShell
      portalTitle="Rescue Operations Command"
      portalSubtitle="Tactical field dispatch, mission telemetry & navigation"
      icon={Siren}
      groups={rescueNavGroups}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      loginRoute="/portal/rescue/login"
      badgeContent={
        <div className="flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-warning">
          <Fuel className="size-3" />
          <span className="num font-bold">{team?.fuel || 62}%</span>
        </div>
      }
    >
      {feedback && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-success/40 bg-success/15 px-4 py-3 text-xs text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Scenario G: Offline Mode Simulation & Idempotent Sync Banner */}
      <div className={`mb-5 rounded-lg border p-4 transition-colors ${
        isOfflineSimulated
          ? "border-warning/50 bg-warning/10"
          : "border-border bg-surface-2"
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 ${isOfflineSimulated ? "bg-warning/20 text-warning" : "bg-success/20 text-success"}`}>
              {isOfflineSimulated ? <WifiOff className="size-5" /> : <Wifi className="size-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold">
                  {isOfflineSimulated ? "Offline Simulation Active (Scenario G)" : "Central Comms Feed Online"}
                </h4>
                <StatusPill tone={isOfflineSimulated ? "warning" : "success"}>
                  {isOfflineSimulated ? `${offlineQueue.length} Queued Locally` : "Real-time Connected"}
                </StatusPill>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isOfflineSimulated
                  ? "Field updates are buffered in browser localStorage with unique UUIDs. Upon reconnecting, they will sync idempotently without duplicate records."
                  : "Field updates sync live to central Control Centre via WebSocket / SSE stream."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleToggleOffline}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                isOfflineSimulated
                  ? "border border-border bg-surface-1 hover:bg-surface-3 text-foreground"
                  : "border border-warning/40 bg-warning/10 hover:bg-warning/20 text-warning"
              }`}
            >
              {isOfflineSimulated ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
              {isOfflineSimulated ? "Restore Connection" : "Simulate Connection Loss (Scenario G)"}
            </button>

            {isOfflineSimulated && (
              <button
                onClick={handleReconnectAndSync}
                disabled={syncingOffline || offlineQueue.length === 0}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 shadow"
              >
                {syncingOffline ? <RefreshCw className="size-3.5 animate-spin" /> : <UploadCloud className="size-3.5" />}
                {syncingOffline ? "Synchronising..." : `Reconnect & Sync (${offlineQueue.length})`}
              </button>
            )}

            <button
              onClick={handleTestDuplicateRetry}
              className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5"
              title="Resend previously synced batch to confirm deduplication in audit logs"
            >
              <Database className="size-3.5" /> Test Duplicate Retry (Idempotency)
            </button>
          </div>
        </div>

        {/* Local Queue Detail drawer if items exist */}
        {offlineQueue.length > 0 && (
          <div className="mt-3 border-t border-border/60 pt-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Pending Local Queue in Browser Storage ({offlineQueue.length} items):
            </p>
            <div className="flex flex-wrap gap-2 text-[11px]">
              {offlineQueue.map((op, idx) => (
                <div key={op.opId} className="rounded border border-border bg-surface-1 px-2.5 py-1 flex items-center gap-1.5 font-mono">
                  <span className="text-primary font-bold">#{idx + 1}</span>
                  <span className="text-muted-foreground">{op.opId}</span>
                  <span className="text-foreground font-semibold">[{op.status || "REPORT"}]</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: OPERATIONS OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow={`${team?.callsign || "ALPHA-1"} · ${team?.unit || "NDRF Water Rescue"}`}
            title="Operations Overview"
            description={`Assigned to ${mission?.incidentId || "INC-4471"} · Sector 7 embankment breach. 2 Gemini boats deployed.`}
            actions={
              <div className="flex items-center gap-2">
                <StatusPill tone={team?.status === "on-scene" ? "critical" : "success"} pulse={team?.status === "on-scene"}>
                  {team?.status?.toUpperCase()}
                </StatusPill>
                <button
                  onClick={() => setActiveTab("missions")}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                >
                  <Kanban className="size-3.5" /> Mission Board
                </button>
              </div>
            }
          />

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard
              label="Assigned Mission"
              value={mission?.incidentId || "Standby"}
              tone={mission?.status === "COMPLETED" ? "success" : "critical"}
              icon={<Siren className="size-4" />}
              hint={mission?.status === "COMPLETED" ? "Ready for dispatch" : "On scene 38 min"}
            />
            <MetricCard
              label="Victims in Queue"
              value={victims.length}
              tone="warning"
              icon={<Users2 className="size-4" />}
              hint="1 Red / 2 Yellow / 1 Green"
            />
            <MetricCard
              label="Vehicle Fuel / Battery"
              value={String(team?.fuel || "62")}
              unit="%"
              tone={team?.fuel < 40 ? "critical" : "warning"}
              icon={<Fuel className="size-4" />}
              hint={`Range approx. ${Math.round((team?.fuel || 62) * 2.2)} km`}
            />
            <MetricCard
              label="Radio Net Status"
              value="VHF 156.8"
              tone="success"
              icon={<Radio className="size-4" />}
              hint="Encrypted Tactical Net 1"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Panel className="overflow-hidden">
              <PanelHeader title="Tactical Navigation View" meta="Sector 7 Riverside Perimeter" />
              <div className="p-2">
                <MapCanvas height="clamp(320px, 46vh, 520px)" layers={{ shelters: true, hospitals: false }} />
              </div>
            </Panel>

            <div className="space-y-4">
              <Panel>
                <PanelHeader title="Active Tasking" meta={mission?.id || "MIS-4471"} />
                <div className="p-4 space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Incident Target:</span>
                    <span className="font-semibold text-foreground">{mission?.incidentId || "INC-4471"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reported Hazards:</span>
                    <span className="font-medium text-critical">Floodwaters &gt; 2.1 m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Extraction Zone:</span>
                    <span className="font-medium text-foreground">Sector 7 Riverside Cul-de-sac</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Status:</span>
                    <StatusPill tone="warning">{mission?.status || "ON_SCENE"}</StatusPill>
                  </div>
                  <div className="rounded-md border border-border bg-surface-2 p-3 text-[11px] text-muted-foreground leading-relaxed">
                    "{mission?.notes || "Water depth 2.2m. Deploying 2 Gemini boats for sector clearance."}"
                  </div>
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="Field Telemetry Roster" />
                <div className="p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deployed Squad:</span>
                    <span className="font-semibold text-foreground">{team?.members || 8} personnel</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Craft Unit:</span>
                    <span className="font-medium text-foreground">Inflatable Zodiac / Gemini</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Disaster EOC Contact:</span>
                    <span className="font-mono text-accent">Desk Commander OPS-1</span>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MISSION BOARD */}
      {activeTab === "missions" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Workflow Execution"
            title="Mission Board"
            description="Manage state transitions for active rescue taskings. Each state transition records a timestamped audit log."
          />

          <Panel>
            <PanelHeader title="Assigned Mission Workflow" meta={mission?.id || "MIS-4471"} />
            <div className="p-6 space-y-6">
              {/* Stepper Status Visualizer */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
                {[
                  { key: "PENDING", label: "1. Pending" },
                  { key: "ASSIGNED", label: "2. Assigned" },
                  { key: "EN_ROUTE", label: "3. En Route" },
                  { key: "ON_SCENE", label: "4. On Scene" },
                  { key: "COMPLETED", label: "5. Completed" },
                  { key: "CANCELLED", label: "Cancelled" },
                ].map((step) => {
                  const isActive = mission?.status === step.key;
                  return (
                    <div
                      key={step.key}
                      className={`rounded-lg border p-3 font-medium transition-all ${
                        isActive
                          ? "border-accent bg-accent/15 text-accent shadow-sm"
                          : "border-border bg-surface-2 text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </div>
                  );
                })}
              </div>

              {/* Status Action Buttons */}
              <div className="rounded-lg border border-border bg-surface-2 p-5 space-y-4">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Execute State Transition</h4>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={() => handleStatusChange("EN_ROUTE")}
                    disabled={submitting}
                    className="rounded-md border border-border bg-surface-3 px-3 py-2 text-xs font-medium text-foreground hover:bg-surface hover:border-muted-foreground/40 disabled:opacity-50"
                  >
                    Mark En Route
                  </button>
                  <button
                    onClick={() => handleStatusChange("ON_SCENE")}
                    disabled={submitting}
                    className="rounded-md border border-warning/40 bg-warning/15 px-3 py-2 text-xs font-medium text-warning hover:bg-warning/25 disabled:opacity-50"
                  >
                    Mark On Scene
                  </button>
                  <button
                    onClick={() => handleStatusChange("COMPLETED", "All sector casualties triaged and transferred to safe corridor.")}
                    disabled={submitting}
                    className="flex items-center gap-1.5 rounded-md bg-success px-4 py-2 text-xs font-bold text-success-foreground hover:bg-success/90 disabled:opacity-50"
                  >
                    <CheckCircle2 className="size-3.5" /> Mark Completed
                  </button>
                </div>
              </div>

              {/* Incident Context */}
              <div className="grid gap-4 sm:grid-cols-3 text-xs">
                <div className="rounded-md border border-border bg-surface-2 p-3">
                  <span className="label-eyebrow">Target Incident</span>
                  <p className="mt-1 font-semibold text-foreground">{mission?.incidentId || "INC-4471"}</p>
                  <p className="text-muted-foreground mt-0.5">Sector 7 Embankment breach</p>
                </div>
                <div className="rounded-md border border-border bg-surface-2 p-3">
                  <span className="label-eyebrow">Casualties Expected</span>
                  <p className="mt-1 num font-semibold text-foreground">{mission?.victimsCount || 128} victims</p>
                  <p className="text-muted-foreground mt-0.5">High water hazard</p>
                </div>
                <div className="rounded-md border border-border bg-surface-2 p-3">
                  <span className="label-eyebrow">Deployment Unit</span>
                  <p className="mt-1 font-semibold text-foreground">{team?.callsign || "ALPHA-1"}</p>
                  <p className="text-muted-foreground mt-0.5">{team?.unit}</p>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 3: VICTIM & INCIDENT QUEUE */}
      {activeTab === "queue" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Triage Extraction"
            title="Victim & Incident Queue"
            description="Prioritized casualty queue permitted for your assigned unit. Sensitive medical records are masked under least-privilege RBAC."
          />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Panel>
              <PanelHeader title="Assigned Extraction Queue" meta={`${victims.length} casualties`} />
              <div className="divide-y divide-border">
                {victims.map((v: any) => (
                  <div key={v.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="num font-bold text-xs text-foreground">{v.id}</span>
                        <StatusPill tone={v.tone}>{v.triage} Category</StatusPill>
                        <span className="text-[10px] text-muted-foreground uppercase">{v.status}</span>
                      </div>
                      <p className="font-semibold text-sm text-foreground mt-1">{v.name}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{v.note}</p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => setFeedback(`Casualty ${v.id} (${v.name}) marked as extracted and handed to ambulance transfer.`)}
                        className="rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-3"
                      >
                        Transfer to Medic
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <div className="space-y-4">
              <Panel>
                <PanelHeader title="Active Incidents in Sector" />
                <ul className="divide-y divide-border text-xs">
                  {incidents.slice(0, 4).map((inc: any) => (
                    <li key={inc.id} className="p-3 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-foreground">{inc.id}</span>
                        <StatusPill tone={inc.severity}>{inc.severity}</StatusPill>
                      </div>
                      <p className="text-foreground truncate">{inc.title}</p>
                      <p className="text-muted-foreground text-[10px]">{inc.sector} · {inc.victims} affected</p>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LIVE MAP & NAVIGATION */}
      {activeTab === "map" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Geospatial Telemetry"
            title="Live Tactical Map & Navigation"
            description="Operational field navigation with overlaid hazard perimeters, road closure warnings, and relief corridors."
          />

          <Panel className="overflow-hidden">
            <PanelHeader title="Tactical Operating Picture" meta="Unit Position: [19.09, 72.864]" />
            <div className="p-2">
              <MapCanvas height="560px" layers={{ shelters: true, hospitals: true, teams: true }} />
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 5: TEAM & AVAILABILITY */}
      {activeTab === "team" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Unit Readiness"
            title="Team & Availability"
            description="Manage squad duty status, operational readiness, and view all active regional rescue units."
            actions={
              <button
                onClick={handleToggleTeamDuty}
                className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
              >
                Toggle Ready Status
              </button>
            }
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="My Tactical Unit" meta={team?.callsign || "ALPHA-1"} />
              <div className="p-5 space-y-4 text-xs">
                <div className="flex justify-between border-b border-border pb-2.5">
                  <span className="text-muted-foreground">Callsign / Unit:</span>
                  <span className="font-bold text-foreground">{team?.callsign} ({team?.unit})</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2.5">
                  <span className="text-muted-foreground">Personnel On Duty:</span>
                  <span className="font-semibold text-foreground">{team?.members} Operators</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2.5">
                  <span className="text-muted-foreground">Operational Status:</span>
                  <StatusPill tone={team?.status === "on-scene" ? "critical" : "success"}>
                    {team?.status?.toUpperCase()}
                  </StatusPill>
                </div>
                <div className="flex justify-between border-b border-border pb-2.5">
                  <span className="text-muted-foreground">Fuel Level:</span>
                  <span className="num font-semibold text-warning">{team?.fuel}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assigned Mission ID:</span>
                  <span className="num font-semibold text-accent">{team?.mission || "MIS-4471"}</span>
                </div>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Regional Rescue Units" meta={`${allTeams.length} units`} />
              <div className="divide-y divide-border text-xs">
                {allTeams.map((t: any) => (
                  <div key={t.id} className="p-3.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{t.callsign} · {t.unit}</p>
                      <p className="text-[11px] text-muted-foreground">{t.members} crew · Fuel: {t.fuel}%</p>
                    </div>
                    <StatusPill tone={t.status === "on-scene" ? "critical" : t.status === "en-route" ? "warning" : "success"}>
                      {t.status}
                    </StatusPill>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* TAB 6: EQUIPMENT & RESOURCES */}
      {activeTab === "equipment" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Logistics Inventory"
            title="Equipment & Resources"
            description="Manage tactical equipment loadout, condition ratings, and report equipment defects."
          />

          <Panel>
            <PanelHeader title="Assigned Equipment Roster" icon={<Package className="size-4" />} />
            <div className="p-5 space-y-4">
              {equipment.map((e: any) => {
                const pct = Math.round((e.have / e.need) * 100);
                return (
                  <div key={e.item} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-foreground">{e.item}</span>
                      <span className="num text-muted-foreground">
                        {e.have} / {e.need} units ({pct}%)
                      </span>
                    </div>
                    <Bar value={pct} tone={pct < 50 ? "critical" : pct < 80 ? "warning" : "success"} />
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 7: COMMUNICATION CENTRE */}
      {activeTab === "comms" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Tactical Net"
            title="Communication Centre"
            description="Encrypted tactical radio log and field broadcasts between response units and EOC command."
          />

          <Panel>
            <PanelHeader title="Tactical Radio Transcript" icon={<Radio className="size-4 text-accent" />} />
            <div className="p-5 space-y-4">
              <div className="h-64 overflow-y-auto space-y-2.5 rounded-lg border border-border bg-surface-2 p-3 font-mono text-xs">
                {broadcastLog.map((log, idx) => (
                  <p key={idx} className="leading-relaxed text-muted-foreground">
                    {log}
                  </p>
                ))}
              </div>

              <form className="flex gap-2" onSubmit={handleSendBroadcast}>
                <input
                  type="text"
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Transmit tactical broadcast on Net-1…"
                  className="flex-1 rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Send className="size-3.5" /> Transmit
                </button>
              </form>
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 8: MISSION REPORTS */}
      {activeTab === "reports" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Field Observations & Logs"
            title="Mission Reports"
            description="File structured field observation reports to Disaster Control Centre and inspect completed mission logs."
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="Submit Field Observation" />
              <form className="p-4 space-y-3.5" onSubmit={handleReportSubmit}>
                <div>
                  <label className="block text-xs text-muted-foreground">Related Incident</label>
                  <select
                    value={selectedIncident}
                    onChange={(e) => setSelectedIncident(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  >
                    {incidents.map((i: any) => (
                      <option key={i.id} value={i.id}>{i.id} — {i.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground">Tactical Observation</label>
                  <textarea
                    rows={4}
                    required
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    placeholder="Describe hazards encountered, casualties, water depth, road blockages, or urgent resources needed…"
                    className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "Transmitting…" : "Record Field Report"}
                </button>
              </form>
            </Panel>

            <Panel>
              <PanelHeader title="Recent Field Reports" meta={`${reports.length} records`} />
              <div className="divide-y divide-border text-xs max-h-[380px] overflow-y-auto">
                {reports.map((rep) => (
                  <div key={rep.id} className="p-3.5 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-foreground">{rep.incidentId}</span>
                      <span className="num text-[10px] text-muted-foreground">
                        {new Date(rep.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-foreground leading-relaxed">{rep.observation}</p>
                    <span className="text-[10px] text-muted-foreground block">Reporter: {rep.reporter}</span>
                  </div>
                ))}
                {reports.length === 0 && (
                  <div className="p-6 text-center text-muted-foreground">No field reports submitted yet.</div>
                )}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* TAB 9: PROFILE & SETTINGS */}
      {activeTab === "profile" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Tactical Identification"
            title="Profile & Security Settings"
            description="Manage responder identification, unit assignment, and security passkeys."
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="Responder Credentials" icon={<Shield className="size-4" />} />
              <dl className="p-5 space-y-3 text-xs">
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">Operator Name</dt>
                  <dd className="font-semibold text-foreground">{user?.fullName || "Capt. R. Verma"}</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">Tactical Callsign</dt>
                  <dd className="num font-bold text-accent">{team?.callsign || "ALPHA-1"}</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">Unit Designation</dt>
                  <dd className="font-medium text-foreground">{team?.unit || "NDRF Water Rescue"}</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">Agency Roster</dt>
                  <dd className="font-medium text-foreground">National Disaster Response Force (NDRF)</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Security Clearance</dt>
                  <dd className="font-semibold text-success">Level 2 Field Commander</dd>
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
    </PortalShell>
  );
}
