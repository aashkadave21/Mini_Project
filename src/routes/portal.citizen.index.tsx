import { useEffect, useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Bell,
  Navigation,
  Tent,
  Siren,
  Users,
  FileQuestion,
  UserCheck,
  MapPin,
  Phone,
  CloudOff,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Plus,
  Trash2,
  ShieldAlert,
  Search,
  Filter,
  ArrowRight,
  HeartPulse,
  Lock,
  Locate,
  Crosshair,
} from "lucide-react";
import { RoleGuard } from "@/components/sdrep/RoleGuard";
import { PortalShell, type PortalTabGroup } from "@/components/sdrep/PortalShell";
import { MapCanvas } from "@/components/sdrep/MapCanvas";
import { ModalPortal } from "@/components/sdrep/ModalPortal";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill, EmptyState } from "@/components/sdrep/primitives";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/portal/citizen/")({
  head: () => ({
    meta: [
      { title: "Citizen Portal — Evacuation & Safety Dashboard | SDREP" },
      { name: "description", content: "Personal disaster assistance dashboard: live evacuation routing, assigned shelter, family tracking, emergency SOS dispatch." },
    ],
  }),
  component: CitizenDashboardPage,
});

const citizenNavGroups: PortalTabGroup[] = [
  {
    label: "Evacuation & Safety",
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "alerts", label: "Live Alerts", icon: Bell, badge: "3", badgeTone: "critical" },
      { id: "evacuation", label: "Safe Routes", icon: Navigation },
      { id: "shelters", label: "Shelter Finder", icon: Tent },
    ],
  },
  {
    label: "Emergency Assistance",
    items: [
      { id: "sos", label: "Emergency SOS", icon: Siren, badge: "112", badgeTone: "critical" },
      { id: "family", label: "Family & Contacts", icon: Users },
      { id: "requests", label: "My Requests", icon: FileQuestion },
      { id: "profile", label: "Profile & Settings", icon: UserCheck },
    ],
  },
];

function CitizenDashboardPage() {
  return (
    <RoleGuard allowedRoles={["CITIZEN"]} loginRoute="/portal/citizen/login" portalTitle="Citizen Portal">
      <CitizenDashboardContent />
    </RoleGuard>
  );
}

function CitizenDashboardContent() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  // State
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [shelters, setShelters] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosStatus, setSosStatus] = useState<string | null>(null);
  const [sosAssignedUnit, setSosAssignedUnit] = useState<string | null>(null);

  // Modals & form states
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());
  const [shelterSearch, setShelterSearch] = useState("");
  const [shelterFilter, setShelterFilter] = useState<"ALL" | "OPEN" | "NEAR_FULL">("ALL");

  // New family member state
  const [showAddFamilyModal, setShowAddFamilyModal] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [newFamilyStatus, setNewFamilyStatus] = useState("At home · Sector 7");
  const [newFamilyTone, setNewFamilyTone] = useState<"success" | "warning" | "critical">("success");
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Edit profile state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editConditions, setEditConditions] = useState("");
  const [editMedication, setEditMedication] = useState("");
  const [editContact, setEditContact] = useState("");
  const [profileSavedMsg, setProfileSavedMsg] = useState<string | null>(null);

  // Change password state
  const [currPass, setCurrPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState<string | null>(null);

  // SOS Location & Emergency Specification State
  const [sosAddress, setSosAddress] = useState("Riverside Bund Rd, Sector 7");
  const [sosCoordinates, setSosCoordinates] = useState<[number, number]>([19.092, 72.862]);
  const [sosEmergencyType, setSosEmergencyType] = useState<"medical" | "flood" | "fire" | "collapse" | "chemical">("flood");
  const [sosSeverity, setSosSeverity] = useState<"critical" | "warning" | "info">("critical");
  const [sosHeadcount, setSosHeadcount] = useState<number>(2);
  const [sosMedicalUrgency, setSosMedicalUrgency] = useState<boolean>(true);
  const [sosNotes, setSosNotes] = useState<string>("Flooding on ground floor, need boat extraction.");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoSuccess, setGeoSuccess] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [profileRes, sheltersRes, reqRes] = await Promise.all([
        api.citizen.getProfile(),
        api.shelter.getAll().catch(() => ({ data: [] })),
        api.citizen.getMyRequests().catch(() => ({ data: [] })),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
        setEditConditions(profileRes.data.conditions || "");
        setEditMedication(profileRes.data.medication || "");
        setEditContact(profileRes.data.emergencyContact || "");
      }
      if (sheltersRes.data) {
        setShelters(sheltersRes.data);
      }
      if (reqRes.data) {
        setMyRequests(reqRes.data);
      }
    } catch (err) {
      console.error("Failed to load citizen data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGeolocation = () => {
    setGeoError(null);
    setGeoSuccess(null);
    if (!navigator.geolocation) {
      setGeoError("Browser geolocation is not supported on this device. Please select a landmark or pin your position on the map.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        setSosCoordinates([lat, lng]);
        setSosAddress(`GPS Resolved (${lat}, ${lng})`);
        setGeoSuccess(`Geolocation verified via device GPS: [${lat}, ${lng}]`);
      },
      (err) => {
        let msg = "Could not resolve browser geolocation.";
        if (err.code === 1) msg = "Geolocation permission denied. Please select a known landmark or click on the map to pin your location.";
        else if (err.code === 2) msg = "GPS satellite fix unavailable. Please pin your position directly on the interactive map.";
        else if (err.code === 3) msg = "Geolocation request timed out. Please pin your position directly on the map.";
        setGeoError(msg);
      },
      { timeout: 7000, enableHighAccuracy: true }
    );
  };

  const handleMapPin = (latlng: [number, number]) => {
    setSosCoordinates(latlng);
    setSosAddress(`Map Pinned Landmark [${latlng[0]}, ${latlng[1]}]`);
    setGeoSuccess(`Map position pinned at [${latlng[0]}, ${latlng[1]}]`);
    setGeoError(null);
  };

  const handleSOS = async (customNotes?: string) => {
    setSosLoading(true);
    setSosStatus(null);
    setInlineError(null);
    try {
      if (!sosCoordinates || isNaN(sosCoordinates[0]) || isNaN(sosCoordinates[1])) {
        throw new Error("Valid coordinates are required. Please pin your position on the map or select a sector landmark.");
      }

      const res = await api.citizen.submitSOS({
        pos: sosCoordinates,
        address: sosAddress,
        sector: profile?.sector || "Sector 7 · Riverside",
        emergencyType: sosEmergencyType,
        severity: sosSeverity,
        headcount: Number(sosHeadcount) || 1,
        medicalUrgency: sosMedicalUrgency,
        notes: customNotes || sosNotes,
      });

      const confirmedId = res.data?.incidentId || res.data?.sosId || "SOS-ACK";
      setSosStatus(confirmedId);
      setSosAssignedUnit(res.data?.assignedUnit || "Disaster Control Centre (Awaiting Unit Dispatch)");
      setGeoSuccess(`Incident ${confirmedId} transmitted to Disaster Control Centre map at [${sosCoordinates[0]}, ${sosCoordinates[1]}].`);
      await fetchData();
    } catch (err: any) {
      setInlineError(err.message || "Failed to submit SOS. Please call 112 directly.");
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

  const handleAddFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamilyName.trim()) return;

    try {
      await api.citizen.addFamilyMember({
        name: newFamilyName.trim(),
        status: newFamilyStatus,
        tone: newFamilyTone,
      });
      setShowAddFamilyModal(false);
      setNewFamilyName("");
      setInlineError(null);
      await fetchData();
    } catch (err: any) {
      setInlineError(err.message || "Failed to add family member. Please retry.");
    }
  };

  const handleRemoveFamily = async (memberId: string) => {
    try {
      await api.citizen.removeFamilyMember(memberId);
      setInlineError(null);
      await fetchData();
    } catch (err: any) {
      setInlineError(err.message || "Failed to remove family member. Please retry.");
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.citizen.updateProfile({
        conditions: editConditions,
        medication: editMedication,
        emergencyContact: editContact,
      });
      setProfileSavedMsg("Medical profile successfully saved to SDREP registry.");
      setIsEditingProfile(false);
      setTimeout(() => setProfileSavedMsg(null), 5000);
      await fetchData();
    } catch (err: any) {
      setInlineError(err.message || "Failed to update profile.");
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
      setPassMsg(err.message || "Failed to change password.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm">Connecting to SDREP emergency response network…</p>
      </div>
    );
  }

  const shelter = profile?.shelterInfo;
  const occupancyPercent = shelter ? Math.round((shelter.occupancy / shelter.capacity) * 100) : 78;

  const filteredShelters = shelters.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(shelterSearch.toLowerCase()) || s.id.toLowerCase().includes(shelterSearch.toLowerCase());
    if (shelterFilter === "OPEN") return matchesSearch && s.status === "open";
    if (shelterFilter === "NEAR_FULL") return matchesSearch && s.status === "near-full";
    return matchesSearch;
  });

  return (
    <PortalShell
      portalTitle="Citizen Evacuation Portal"
      portalSubtitle="Personal safety, shelter routing & emergency SOS"
      icon={UserCheck}
      groups={citizenNavGroups}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      loginRoute="/portal/citizen/login"
      badgeContent={
        <button
          onClick={() => handleSOS()}
          disabled={sosLoading}
          className="flex items-center gap-1.5 rounded-md bg-critical px-2.5 py-1 text-xs font-bold text-critical-foreground hover:bg-critical/90 animate-pulse transition-opacity"
        >
          {sosLoading ? <Loader2 className="size-3 animate-spin" /> : <Siren className="size-3" />}
          SOS
        </button>
      }
    >
      {/* SOS confirmation alert banner */}
      {sosStatus && (
        <div className="mb-5 flex items-center justify-between rounded-lg border border-success/40 bg-success/15 px-4 py-3 text-sm text-success shadow-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0" />
            <div>
              <p className="font-semibold">Emergency SOS Transmitted & Confirmed</p>
              <p className="text-xs text-success/90">
                Request ID: <strong>{sosStatus}</strong>. Nearest responder <strong>{sosAssignedUnit}</strong> tasked for extraction.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono bg-success/20 px-2 py-1 rounded">Dispatched</span>
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow={`Citizen ID: ${profile?.id || "CIT-01"} · Sector 7`}
            title={`Welcome, ${user?.fullName || profile?.fullName || "Citizen"}`}
            description="Your sector is under a mandatory evacuation order. Follow your designated safe corridor to the Municipal Stadium Relief Camp."
            actions={
              <button
                onClick={() => handleSOS()}
                disabled={sosLoading}
                className="flex items-center gap-2 rounded-md bg-critical px-4 py-2.5 text-xs font-bold text-critical-foreground animate-pulse-ring transition-opacity disabled:opacity-50"
              >
                {sosLoading ? <Loader2 className="size-4 animate-spin" /> : <Siren className="size-4" />}
                {sosLoading ? "Transmitting SOS…" : "Emergency SOS (112)"}
              </button>
            }
          />

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard
              label="Assigned shelter"
              value={shelter?.id || "SH-01"}
              tone="success"
              icon={<MapPin className="size-4" />}
              hint={shelter?.name || "Municipal Stadium Relief Camp"}
            />
            <MetricCard
              label="Corridor distance"
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
              hint="1 member pending check-in"
            />
            <MetricCard
              label="Radio mesh link"
              value="Online"
              tone="success"
              icon={<CloudOff className="size-4" />}
              hint="Server encrypted channel"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Panel className="overflow-hidden">
              <PanelHeader title="Active Evacuation Corridor" meta="Route A (Ridge Link Diversion) · Clear" />
              <div className="p-2">
                <MapCanvas height="clamp(320px, 46vh, 520px)" layers={{ teams: false }} />
              </div>
            </Panel>

            <div className="space-y-5">
              <Panel>
                <PanelHeader title="Active Safety Directives" />
                <ul className="divide-y divide-border text-xs">
                  <li className="px-4 py-3">
                    <StatusPill tone="critical" pulse>Mandatory Evacuation</StatusPill>
                    <p className="mt-1.5 font-medium text-foreground">Water level 2.1 m at Riverside. Evacuate via Route A.</p>
                  </li>
                  <li className="px-4 py-3">
                    <StatusPill tone="warning">Road Closure</StatusPill>
                    <p className="mt-1.5 text-muted-foreground">Riverside Arterial blocked. Do not attempt crossing on foot.</p>
                  </li>
                </ul>
              </Panel>

              <Panel>
                <PanelHeader title="Assigned Shelter Availability" />
                <div className="p-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{shelter?.name || "SH-01 Stadium Camp"}</span>
                    <span className="num text-muted-foreground">{occupancyPercent}% Occupied</span>
                  </div>
                  <Bar value={occupancyPercent} tone={occupancyPercent > 85 ? "critical" : "warning"} />
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Available beds: <strong>{shelter ? shelter.capacity - shelter.occupancy : 524}</strong> spaces open. Medical post on-site.
                  </p>
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="Quick Emergency Dial" />
                <div className="p-3.5 space-y-2">
                  <a href="tel:112" className="flex items-center justify-between rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-xs font-semibold text-critical">
                    <span>Emergency Response Control</span>
                    <Phone className="size-4" />
                  </a>
                  <a href="tel:108" className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-foreground">
                    <span>Ambulance & Trauma Services</span>
                    <Phone className="size-4" />
                  </a>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE ALERTS */}
      {activeTab === "alerts" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Broadcast Notifications"
            title="Live Disaster Alerts"
            description="Real-time hazards, flood warnings, and evacuation directives issued by SDREP Disaster Control Centre."
          />

          <div className="grid gap-4">
            {(profile?.activeAlerts || []).map((alert: any) => {
              const isAck = acknowledgedAlerts.has(alert.id);
              return (
                <Panel key={alert.id} className={isAck ? "opacity-60" : "border-critical/30"}>
                  <div className="flex items-start justify-between gap-4 p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <StatusPill tone={alert.tone} pulse={alert.tone === "critical"}>
                          {alert.tag}
                        </StatusPill>
                        <span className="num text-[11px] text-muted-foreground">{alert.id}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground leading-relaxed mt-2">{alert.message}</p>
                      <p className="text-[11px] text-muted-foreground">Source: Disaster Command Telemetry Network · Updated 4 min ago</p>
                    </div>

                    <button
                      onClick={() => {
                        const next = new Set(acknowledgedAlerts);
                        if (isAck) next.delete(alert.id);
                        else next.add(alert.id);
                        setAcknowledgedAlerts(next);
                      }}
                      className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        isAck
                          ? "border border-border bg-surface-2 text-muted-foreground hover:bg-surface-3"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                    >
                      {isAck ? "Acknowledged" : "Acknowledge"}
                    </button>
                  </div>
                </Panel>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: EVACUATION & SAFE ROUTES */}
      {activeTab === "evacuation" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Routing Engine (Dijkstra Hazard-Weighted)"
            title="Evacuation & Safe Corridors"
            description="Active road segments are continuously evaluated against flood levels, debris, and congestion to compute the safest walking route."
          />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Panel className="overflow-hidden">
              <PanelHeader title="Designated Safe Path" meta="Origin: Sector 7 → Destination: SH-01" />
              <div className="p-2">
                <MapCanvas height="520px" layers={{ teams: false }} />
              </div>
            </Panel>

            <div className="space-y-4">
              <Panel>
                <PanelHeader title="Primary Route A (Recommended)" />
                <div className="p-4 space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Distance:</span>
                    <span className="num font-semibold text-foreground">2.4 km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Est. Walking Duration:</span>
                    <span className="num font-semibold text-foreground">26 minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hazard Penalty Score:</span>
                    <span className="num text-success font-semibold">1.4 (Low Exposure)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Route Segments:</span>
                    <span className="font-medium text-foreground">Ridge Link Diversion</span>
                  </div>
                  <div className="rounded-md border border-success/30 bg-success/10 p-2.5 text-success text-[11px]">
                    ✓ Avoids Riverside Arterial. Elevation above 18 m MSL.
                  </div>
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="Road Status Advisory" />
                <ul className="divide-y divide-border text-xs">
                  <li className="flex items-center justify-between p-3">
                    <span>Ridge Link Diversion</span>
                    <StatusPill tone="success">Clear</StatusPill>
                  </li>
                  <li className="flex items-center justify-between p-3">
                    <span>Riverside Arterial</span>
                    <StatusPill tone="critical">Flooded (2.1 m)</StatusPill>
                  </li>
                  <li className="flex items-center justify-between p-3">
                    <span>Civic Ring Road</span>
                    <StatusPill tone="warning">Congested</StatusPill>
                  </li>
                </ul>
              </Panel>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SHELTER FINDER */}
      {activeTab === "shelters" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Relief Camps"
            title="Shelter Finder"
            description="Locate nearby open shelters, check live bed capacity, food stocks, and medical facilities."
          />

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search shelters by name, sector, or ID…"
                value={shelterSearch}
                onChange={(e) => setShelterSearch(e.target.value)}
                className="w-full rounded-md border border-input bg-surface-2 pl-9 pr-3 py-2 text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {(["ALL", "OPEN", "NEAR_FULL"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setShelterFilter(filter)}
                  className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                    shelterFilter === filter
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-surface-2 text-muted-foreground hover:bg-surface-3"
                  }`}
                >
                  {filter === "ALL" ? "All Shelters" : filter === "OPEN" ? "Open Only" : "Near Full"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredShelters.map((s) => {
              const bedsFree = Math.max(0, s.capacity - s.occupancy);
              const occPct = Math.round((s.occupancy / s.capacity) * 100);
              const isAssigned = s.id === profile?.assignedShelterId;

              return (
                <Panel key={s.id} className={isAssigned ? "border-accent ring-1 ring-accent" : ""}>
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="num font-bold text-xs text-foreground">{s.id}</span>
                          {isAssigned && <StatusPill tone="info">Assigned to you</StatusPill>}
                        </div>
                        <h3 className="mt-1 font-semibold text-sm text-foreground">{s.name}</h3>
                      </div>
                      <StatusPill tone={s.status === "open" ? "success" : s.status === "near-full" ? "warning" : "critical"}>
                        {s.status}
                      </StatusPill>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Capacity load</span>
                        <span className="num">{occPct}% ({s.occupancy}/{s.capacity})</span>
                      </div>
                      <Bar value={occPct} tone={occPct > 90 ? "critical" : occPct > 70 ? "warning" : "success"} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Free Beds:</span>
                        <span className="num font-semibold text-foreground">{bedsFree} available</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Medical Aid:</span>
                        <span className="font-medium text-foreground">{s.medical ? "✓ Available" : "First-aid only"}</span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <a href="tel:112" className="text-xs text-accent font-medium hover:underline flex items-center gap-1">
                        <Phone className="size-3" /> Contact Camp
                      </a>
                      <span className="text-[10px] text-muted-foreground">Water stock: {s.waterStock || 4200} L</span>
                    </div>
                  </div>
                </Panel>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: SOS & EMERGENCY ASSISTANCE */}
      {activeTab === "sos" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Interactive Crisis Management"
            title="Emergency SOS & Location Dispatch"
            description="Provide emergency details, resolve and review your precise coordinates, and transmit an active incident directly to the Disaster Control Centre map."
          />

          {geoError && (
            <div className="flex items-center gap-2 rounded-md border border-critical/40 bg-critical/10 p-3 text-xs text-critical">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{geoError}</span>
            </div>
          )}

          {geoSuccess && (
            <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 p-3 text-xs text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{geoSuccess}</span>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
            {/* Interactive Location Selection & Map Pinning */}
            <Panel>
              <PanelHeader
                title="Geospatial Location & Map Pinning"
                icon={<MapPin className="size-4 text-primary" />}
                meta="Click map or use GPS"
                action={
                  <button
                    type="button"
                    onClick={handleGeolocation}
                    className="flex items-center gap-1 rounded border border-border bg-surface-2 px-2.5 py-1 text-xs hover:bg-surface-3 transition-colors text-foreground"
                  >
                    <Locate className="size-3.5 text-primary" />
                    <span>Use Browser GPS</span>
                  </button>
                }
              />
              <div className="p-4 space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-foreground">Street Address / Landmark</label>
                  <input
                    type="text"
                    value={sosAddress}
                    onChange={(e) => setSosAddress(e.target.value)}
                    placeholder="Enter street address, building or landmark name…"
                    className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] text-muted-foreground mr-1">Quick Presets:</span>
                    {[
                      { label: "Sector 7 Riverside", pos: [19.092, 72.862] as [number, number], addr: "Riverside Bund Rd, Sector 7" },
                      { label: "Sector 3 Port Docks", pos: [19.062, 72.848] as [number, number], addr: "Dock Road Gate 3, Sector 3" },
                      { label: "Sector 12 Old Town", pos: [19.083, 72.895] as [number, number], addr: "Old Town Market Cross, Sector 12" },
                      { label: "Sector 9 Civic Centre", pos: [19.07, 72.905] as [number, number], addr: "Civic Hospital Junction, Sector 9" },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setSosAddress(preset.addr);
                          setSosCoordinates(preset.pos);
                          setGeoSuccess(`Preset selected: ${preset.addr} [${preset.pos[0]}, ${preset.pos[1]}]`);
                        }}
                        className="rounded border border-border bg-surface-3 px-2 py-0.5 text-[10px] hover:border-primary text-foreground"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-border">
                  <p className="bg-surface-3 px-3 py-1.5 text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                    <span>Click anywhere on the map to pin exact emergency coordinates:</span>
                    <span className="font-mono text-primary font-bold">[{sosCoordinates[0]}, {sosCoordinates[1]}]</span>
                  </p>
                  <div className="h-64">
                    <MapCanvas
                      height="100%"
                      zoom={14}
                      center={sosCoordinates}
                      interactivePin={sosCoordinates}
                      onMapClick={handleMapPin}
                      layers={{ hazards: true, roads: true, incidents: false, shelters: false, hospitals: false, teams: false }}
                    />
                  </div>
                </div>
              </div>
            </Panel>

            {/* Emergency Details, Pre-submission Review & Action */}
            <div className="space-y-4">
              <Panel className="border-critical/40">
                <PanelHeader title="Emergency Specifications" icon={<Siren className="size-4 text-critical" />} />
                <div className="p-4 space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-foreground">Emergency Type *</label>
                    <select
                      value={sosEmergencyType}
                      onChange={(e) => setSosEmergencyType(e.target.value as any)}
                      className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                    >
                      <option value="flood">Flood Extraction / Water Rescue (Requires Rescue Boat)</option>
                      <option value="medical">Medical Trauma / Critical Patient (Requires Ambulance)</option>
                      <option value="fire">Active Fire / Hazardous Area (Requires Fire Engine)</option>
                      <option value="collapse">Structural Collapse / Trapped Victims (Requires USAR)</option>
                      <option value="chemical">Toxic / Chemical Inhalation Hazard</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-foreground">Severity Level *</label>
                      <select
                        value={sosSeverity}
                        onChange={(e) => setSosSeverity(e.target.value as any)}
                        className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                      >
                        <option value="critical">Critical (Immediate Danger to Life)</option>
                        <option value="warning">Urgent (Evacuation Needed Soon)</option>
                        <option value="info">Moderate / Advisory Assistance</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground">Affected People (Headcount) *</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={sosHeadcount}
                        onChange={(e) => setSosHeadcount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sosMedicalUrgency}
                        onChange={(e) => setSosMedicalUrgency(e.target.checked)}
                        className="size-4 accent-critical"
                      />
                      <span className="font-semibold text-foreground">Immediate Medical Attention Required (Oxygen, Trauma, Elderly)</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground">Field Observations / Extraction Notes</label>
                    <textarea
                      rows={2}
                      value={sosNotes}
                      onChange={(e) => setSosNotes(e.target.value)}
                      placeholder="e.g. Water height 1.8m, trapped on terrace with elderly family member…"
                      className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                    />
                  </div>

                  {/* Location Pre-submission Review Card */}
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1.5 text-xs">
                    <p className="font-bold text-foreground flex items-center justify-between">
                      <span>Location Review Prior to Transmission:</span>
                      <StatusPill tone="info">Coordinates Validated</StatusPill>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Coordinates: <strong className="font-mono text-foreground">[{sosCoordinates[0].toFixed(5)}, {sosCoordinates[1].toFixed(5)}]</strong>
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Address: <strong className="text-foreground">{sosAddress}</strong>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Casualties: <strong className="text-foreground">{sosHeadcount} person(s)</strong> · Type: <strong className="text-foreground uppercase">{sosEmergencyType}</strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSOS()}
                    disabled={sosLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-md bg-critical py-3 text-sm font-bold text-critical-foreground hover:bg-critical/90 shadow-lg disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {sosLoading ? <Loader2 className="size-4 animate-spin" /> : <Siren className="size-4" />}
                    <span>{sosLoading ? "Transmitting Verified SOS…" : "Transmit Emergency SOS to Control Centre"}</span>
                  </button>
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="Direct Emergency Hotlines" />
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between rounded-md border border-critical/30 bg-critical/10 p-2.5">
                    <div>
                      <p className="text-xs font-semibold text-critical">National Emergency Response</p>
                      <p className="text-[10px] text-muted-foreground">Police · Fire · Ambulance</p>
                    </div>
                    <a href="tel:112" className="rounded bg-critical px-2.5 py-1 text-xs font-bold text-critical-foreground">
                      112
                    </a>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: FAMILY & CONTACTS */}
      {activeTab === "family" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Welfare Registry"
            title="Family & Emergency Contacts"
            description="Track safety status of family members, update check-ins, and manage emergency contacts."
            actions={
              <button
                onClick={() => setShowAddFamilyModal(true)}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
              >
                <Plus className="size-3.5" /> Add Member
              </button>
            }
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="Family Welfare Status" meta={`${profile?.family?.length || 0} members`} />
              <div className="divide-y divide-border">
                {profile?.family?.map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between p-4">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-sm text-foreground">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{f.status}</p>
                      <span className="num text-[10px] text-muted-foreground">
                        Reported: {new Date(f.lastReported).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusPill tone={f.tone}>{f.status.split("·")[0] || "Reported"}</StatusPill>
                      <button
                        onClick={() => handleRemoveFamily(f.id)}
                        className="text-muted-foreground hover:text-critical p-1"
                        title="Remove contact"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {(!profile?.family || profile.family.length === 0) && (
                  <EmptyState title="No family members registered" body="Add family members to coordinate evacuation status." />
                )}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Emergency Contacts" />
              <div className="p-4 space-y-3 text-xs">
                <div className="rounded-md border border-border bg-surface-2 p-3 flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-foreground">Primary Next of Kin</span>
                    <p className="text-muted-foreground mt-0.5">{profile?.emergencyContact || "+91 98200 12420"}</p>
                  </div>
                  <a href={`tel:${profile?.emergencyContact || "+91 98200 12420"}`} className="p-2 rounded bg-surface-3 text-accent">
                    <Phone className="size-4" />
                  </a>
                </div>

                <div className="rounded-md border border-border bg-surface-2 p-3 flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-foreground">Riverside Ward Officer</span>
                    <p className="text-muted-foreground mt-0.5">+91 98200 88991</p>
                  </div>
                  <a href="tel:+919820088991" className="p-2 rounded bg-surface-3 text-accent">
                    <Phone className="size-4" />
                  </a>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* TAB 7: MY REQUESTS */}
      {activeTab === "requests" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Audit Record"
            title="My Emergency Requests"
            description="Track real-time status of your submitted distress calls, assigned response units, and verification logs."
          />

          <Panel>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-xs">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="label-eyebrow px-4 py-2 font-normal">Request ID</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Timestamp</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Sector / Description</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Assigned Unit</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {myRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-surface-2">
                      <td className="num px-4 py-3 font-semibold text-foreground">{req.id}</td>
                      <td className="num px-4 py-3 text-muted-foreground">
                        {new Date(req.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{req.sector}</span>
                        <p className="text-[11px] text-muted-foreground truncate max-w-xs">{req.notes}</p>
                      </td>
                      <td className="px-4 py-3 font-medium text-accent">
                        {req.assignedTeamCallsign || "T1 · ALPHA-1"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={req.status === "RESOLVED" ? "success" : "critical"}>
                          {req.status}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                  {myRequests.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No previous SOS requests recorded. Use the SOS button if you require emergency assistance.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 8: PROFILE & SETTINGS */}
      {activeTab === "profile" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Account & Medical"
            title="Profile & Go-Bag Checklist"
            description="Manage your emergency medical tags, essential evacuation checklist, and account credentials."
          />

          {profileSavedMsg && (
            <div className="rounded-md border border-success/30 bg-success/10 p-3 text-xs text-success flex items-center gap-2">
              <CheckCircle2 className="size-4" />
              <span>{profileSavedMsg}</span>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Medical Profile */}
            <Panel>
              <PanelHeader
                title="Medical & Emergency Information"
                icon={<HeartPulse className="size-4 text-critical" />}
                action={
                  <button
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                    className="text-xs text-accent hover:underline"
                  >
                    {isEditingProfile ? "Cancel" : "Edit"}
                  </button>
                }
              />

              {isEditingProfile ? (
                <form className="p-4 space-y-3" onSubmit={handleSaveProfile}>
                  <div>
                    <label className="block text-xs text-muted-foreground">Medical Conditions / Allergies</label>
                    <input
                      type="text"
                      value={editConditions}
                      onChange={(e) => setEditConditions(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                      placeholder="e.g. Asthma, Penicillin allergy"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground">Prescribed Medication</label>
                    <input
                      type="text"
                      value={editMedication}
                      onChange={(e) => setEditMedication(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                      placeholder="e.g. Salbutamol inhaler"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground">Emergency Contact Phone</label>
                    <input
                      type="text"
                      value={editContact}
                      onChange={(e) => setEditContact(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Save Medical Profile
                  </button>
                </form>
              ) : (
                <dl className="p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between border-b border-border pb-2">
                    <dt className="text-muted-foreground">Full Name</dt>
                    <dd className="font-semibold text-foreground">{profile?.fullName}</dd>
                  </div>
                  <div className="flex justify-between border-b border-border pb-2">
                    <dt className="text-muted-foreground">Blood Group</dt>
                    <dd className="num font-bold text-accent">{profile?.bloodGroup || "O+"}</dd>
                  </div>
                  <div className="flex justify-between border-b border-border pb-2">
                    <dt className="text-muted-foreground">Known Conditions</dt>
                    <dd className="font-medium text-foreground">{profile?.conditions || "None"}</dd>
                  </div>
                  <div className="flex justify-between border-b border-border pb-2">
                    <dt className="text-muted-foreground">Critical Medication</dt>
                    <dd className="font-medium text-foreground">{profile?.medication || "None"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Emergency Contact</dt>
                    <dd className="num font-semibold text-foreground">{profile?.emergencyContact}</dd>
                  </div>
                </dl>
              )}
            </Panel>

            {/* Go-Bag Checklist */}
            <Panel>
              <PanelHeader title="Go-Bag Readiness Checklist" meta="Persisted in Database" />
              <ul className="p-4 space-y-2.5 text-xs">
                {profile?.checklist?.map((c: any, i: number) => (
                  <li key={c.item}>
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={c.checked}
                        onChange={() => toggleChecklist(i, c.checked)}
                        className="size-4 rounded accent-primary"
                      />
                      <span className={c.checked ? "text-muted-foreground line-through" : "text-foreground font-medium"}>
                        {c.item}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </Panel>

            {/* Change Password */}
            <Panel>
              <PanelHeader title="Change Account Password" icon={<Lock className="size-4" />} />
              <form className="p-4 space-y-3" onSubmit={handleChangePassword}>
                {passMsg && (
                  <div className="rounded border border-info/30 bg-info/10 p-2 text-xs text-info">
                    {passMsg}
                  </div>
                )}
                <div>
                  <label className="block text-xs text-muted-foreground">Current Password</label>
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
                  <label className="block text-xs text-muted-foreground">New Password (min 8 chars)</label>
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
                  Update Passphrase
                </button>
              </form>
            </Panel>
          </div>
        </div>
      )}

      {/* Add Family Modal */}
      <ModalPortal
        isOpen={showAddFamilyModal}
        onClose={() => setShowAddFamilyModal(false)}
        title="Add Family Member"
        description="Add next of kin to monitor welfare status during disaster evacuation."
        maxWidth="max-w-md"
      >
        <form className="space-y-3" onSubmit={handleAddFamily}>
          <div>
            <label className="block text-xs text-muted-foreground">Full Name *</label>
            <input
              type="text"
              required
              value={newFamilyName}
              onChange={(e) => setNewFamilyName(e.target.value)}
              placeholder="e.g. Meera Iyer"
              className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground">Current Location / Status</label>
            <input
              type="text"
              value={newFamilyStatus}
              onChange={(e) => setNewFamilyStatus(e.target.value)}
              placeholder="e.g. At shelter SH-01"
              className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground">Safety Tone</label>
            <select
              value={newFamilyTone}
              onChange={(e) => setNewFamilyTone(e.target.value as any)}
              className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
            >
              <option value="success">Safe / Accounted for</option>
              <option value="warning">En route / Transit</option>
              <option value="critical">Unreachable / Needs help</option>
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors"
            >
              Save Member
            </button>
            <button
              type="button"
              onClick={() => setShowAddFamilyModal(false)}
              className="rounded-md border border-border bg-surface-2 px-4 py-2 text-xs font-medium text-foreground cursor-pointer hover:bg-surface-3 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </ModalPortal>
    </PortalShell>
  );
}
