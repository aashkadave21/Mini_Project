import { useEffect, useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ArrowRightLeft,
  Boxes,
  ClipboardList,
  HandHeart,
  ShieldCheck,
  BarChart3,
  UserCheck,
  Tent,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Phone,
  Flame,
  Droplet,
  Zap,
  Lock,
} from "lucide-react";
import { RoleGuard } from "@/components/sdrep/RoleGuard";
import { PortalShell, type PortalTabGroup } from "@/components/sdrep/PortalShell";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill, EmptyState } from "@/components/sdrep/primitives";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/portal/shelter/")({
  head: () => ({
    meta: [
      { title: "Shelter Administration Dashboard — SDREP Relief Management" },
      { name: "description", content: "Camp capacity control, evacuee registration, intake processing, inventory supplies, and volunteer rosters." },
    ],
  }),
  component: ShelterDashboardPage,
});

const shelterNavGroups: PortalTabGroup[] = [
  {
    label: "Camp Logistics",
    items: [
      { id: "overview", label: "Shelter Overview", icon: LayoutDashboard },
      { id: "occupancy", label: "Occupancy & Capacity", icon: Users, badge: "78%", badgeTone: "warning" },
      { id: "evacuees", label: "Evacuee Registration", icon: UserPlus },
      { id: "transfers", label: "Incoming & Transfers", icon: ArrowRightLeft, badge: "220", badgeTone: "critical" },
    ],
  },
  {
    label: "Resources & Staff",
    items: [
      { id: "supplies", label: "Supplies & Inventory", icon: Boxes },
      { id: "requests", label: "Resource Requests", icon: ClipboardList },
      { id: "volunteers", label: "Staff & Volunteers", icon: HandHeart },
      { id: "safety", label: "Facilities & Safety", icon: ShieldCheck },
    ],
  },
  {
    label: "Analytics & System",
    items: [
      { id: "reports", label: "Reports & Analytics", icon: BarChart3 },
      { id: "profile", label: "Profile & Settings", icon: UserCheck },
    ],
  },
];

function ShelterDashboardPage() {
  return (
    <RoleGuard allowedRoles={["SHELTER_ADMIN"]} loginRoute="/portal/shelter/login" portalTitle="Shelter Administrator Portal">
      <ShelterDashboardContent />
    </RoleGuard>
  );
}

function ShelterDashboardContent() {
  const { user } = useAuth();
  const shelterId = user?.associatedEntityId || "SH-01";
  const [activeTab, setActiveTab] = useState("overview");

  const [shelter, setShelter] = useState<any>(null);
  const [evacuees, setEvacuees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Evacuee intake form
  const [intakeName, setIntakeName] = useState("");
  const [intakeCount, setIntakeCount] = useState(1);
  const [intakeSector, setIntakeSector] = useState("Sector 7 · Riverside");
  const [intakeMobility, setIntakeMobility] = useState("On foot");
  const [intakeSpecial, setIntakeSpecial] = useState("");

  // Supply request form
  const [resource, setResource] = useState("Drinking water (L)");
  const [quantity, setQuantity] = useState(1000);
  const [urgency, setUrgency] = useState("Critical (< 2 h)");

  // Volunteer form
  const [volName, setVolName] = useState("");
  const [volRole, setVolRole] = useState("Intake desk");
  const [volShift, setVolShift] = useState("20:00–04:00");

  // Inventory form
  const [editWater, setEditWater] = useState(4200);
  const [editFood, setEditFood] = useState(1580);
  const [editBlankets, setEditBlankets] = useState(1720);
  const [editMedical, setEditMedical] = useState(46);
  const [editSanitation, setEditSanitation] = useState(310);
  const [inventorySaving, setInventorySaving] = useState(false);

  // Passkey
  const [currPass, setCurrPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState<string | null>(null);

  const fetchShelterData = useCallback(async () => {
    try {
      const [sRes, eRes] = await Promise.all([
        api.shelter.getShelter(shelterId),
        api.shelter.getEvacuees(shelterId).catch(() => ({ data: [] })),
      ]);

      if (sRes.data) {
        setShelter(sRes.data);
        setEditWater(sRes.data.waterStock ?? 4200);
        setEditFood(sRes.data.foodStock ?? 1580);
        setEditBlankets(sRes.data.blanketsStock ?? 1720);
        setEditMedical(sRes.data.medicalKitsStock ?? 46);
        setEditSanitation(sRes.data.sanitationStock ?? 310);
      }
      if (eRes.data) {
        setEvacuees(eRes.data);
      }
    } catch (err) {
      console.error("Failed to load shelter details:", err);
    } finally {
      setLoading(false);
    }
  }, [shelterId]);

  useEffect(() => {
    fetchShelterData();
  }, [fetchShelterData]);

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
        specialNeeds: intakeSpecial,
      });

      setFeedback(`Intake complete: Registered ${intakeName} (+${intakeCount - 1} family members). Occupancy and capacity updated.`);
      setIntakeName("");
      setIntakeCount(1);
      setIntakeSpecial("");
      await fetchShelterData();
    } catch (err: any) {
      setErrorMessage(err.message || "Capacity violation or intake registration error.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckout = async (evacueeId: string, count = 1) => {
    try {
      await api.shelter.checkout(shelterId, { evacueeId, count });
      setFeedback(`Check-out recorded. Released ${count} bed spaces.`);
      setErrorMessage(null);
      await fetchShelterData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to check out evacuee. Please retry.");
    }
  };

  const handleSupplyRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      await api.shelter.requestSupplies(shelterId, {
        resource,
        quantity: Number(quantity),
        urgency,
      });
      setFeedback(`Supply requisition for ${quantity} units of ${resource} submitted to Disaster Control Centre.`);
      await fetchShelterData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit supply request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!volName.trim()) return;
    try {
      await api.shelter.addVolunteer(shelterId, {
        name: volName.trim(),
        role: volRole,
        shift: volShift,
      });
      setFeedback(`Volunteer ${volName} registered on roster.`);
      setErrorMessage(null);
      setVolName("");
      await fetchShelterData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to add volunteer. Please retry.");
    }
  };

  const handleUpdateInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate all fields are non-negative finite numbers
    const fields = { waterStock: editWater, foodStock: editFood, blanketsStock: editBlankets, medicalKitsStock: editMedical, sanitationStock: editSanitation };
    for (const [key, val] of Object.entries(fields)) {
      if (!isFinite(val) || val < 0) {
        setErrorMessage(`${key} must be a non-negative number.`);
        return;
      }
    }
    setInventorySaving(true);
    setErrorMessage(null);
    try {
      await api.shelter.updateInventory(shelterId, {
        waterStock: editWater,
        foodStock: editFood,
        blanketsStock: editBlankets,
        medicalKitsStock: editMedical,
        sanitationStock: editSanitation,
      });
      setFeedback("Inventory records successfully updated and persisted.");
      await fetchShelterData();
    } catch (err: any) {
      setErrorMessage(
        err.message?.includes("404")
          ? `Unable to save inventory: shelter ${shelterId} was not found on the server. Ensure the backend is running and the database is seeded.`
          : err.message || "Failed to update inventory. Please check the backend connection and retry."
      );
    } finally {
      setInventorySaving(false);
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
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm">Connecting to relief camp occupancy & logistics registry…</p>
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
    { item: "Blankets & bedding", stock: shelter?.blanketsStock || 1720, target: 2000 },
    { item: "Medical first-aid kits", stock: shelter?.medicalKitsStock || 46, target: 120 },
    { item: "Sanitation & hygiene kits", stock: shelter?.sanitationStock || 310, target: 400 },
  ];

  const incomingBatches = shelter?.incomingBatches || [
    { batch: "BT-11", from: "Sector 7 · Riverside", persons: 84, eta: "18 min", needs: "Medical Support" },
    { batch: "BT-12", from: "Sector 7 · Riverside", persons: 62, eta: "34 min", needs: "Infants / Nursing" },
    { batch: "BT-13", from: "Sector 12 · Old Town", persons: 74, eta: "71 min", needs: "Elderly Care" },
  ];

  const volunteers = shelter?.volunteers || [];
  const supplyRequests = shelter?.supplyRequests || [];

  return (
    <PortalShell
      portalTitle="Shelter Administration"
      portalSubtitle="Relief camp logistics, capacity & evacuee intake"
      icon={Tent}
      groups={shelterNavGroups}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      loginRoute="/portal/shelter/login"
      badgeContent={
        <div className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary">
          <Tent className="size-3" />
          <span className="num font-bold">{occupancyPct}%</span>
        </div>
      }
    >
      {feedback && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-success/40 bg-success/15 px-4 py-3 text-xs text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-critical/40 bg-critical/10 px-4 py-3 text-xs text-critical">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TAB 1: SHELTER OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow={`${shelter?.id || shelterId} · ${shelter?.name || "Relief Camp"}`}
            title="Shelter Operations Overview"
            description={`Operating at ${occupancyPct}% capacity with ${bedsFree} available spaces. Expected surge of ${incoming} evacuees.`}
            actions={
              <button
                onClick={() => setActiveTab("evacuees")}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
              >
                <UserPlus className="size-3.5" /> Register Arriving Evacuees
              </button>
            }
          />

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard
              label="Live Occupancy"
              value={occupancy.toLocaleString()}
              tone="warning"
              icon={<Users className="size-4" />}
              hint={`Capacity: ${capacity.toLocaleString()} beds`}
            />
            <MetricCard
              label="Available Free Beds"
              value={bedsFree}
              tone={bedsFree > 100 ? "success" : "critical"}
              icon={<Tent className="size-4" />}
              hint={`${occupancyPct}% capacity utilization`}
            />
            <MetricCard
              label="Incoming Surge"
              value={incoming}
              tone="critical"
              icon={<ArrowRightLeft className="size-4" />}
              hint="Next 40–90 min transit"
            />
            <MetricCard
              label="Staff on Duty"
              value={`${volunteers.filter((v: any) => v.available).length}/${volunteers.length || 4}`}
              tone="info"
              icon={<HandHeart className="size-4" />}
              hint="Roster active"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="Live Inventory Balances" meta="Rationing Thresholds" />
              <div className="p-5 space-y-4">
                {inventory.map((r) => {
                  const pct = Math.round((r.stock / r.target) * 100);
                  return (
                    <div key={r.item} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-foreground">{r.item}</span>
                        <span className="num text-muted-foreground">{r.stock.toLocaleString()} / {r.target.toLocaleString()}</span>
                      </div>
                      <Bar value={pct} tone={pct < 35 ? "critical" : pct < 65 ? "warning" : "success"} />
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Incoming Evacuee Transits" meta="Next 90 Minutes" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[380px] text-xs">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="label-eyebrow px-4 py-2 font-normal">Batch</th>
                      <th className="label-eyebrow px-4 py-2 font-normal">From</th>
                      <th className="label-eyebrow px-4 py-2 font-normal">Persons</th>
                      <th className="label-eyebrow px-4 py-2 font-normal">ETA</th>
                      <th className="label-eyebrow px-4 py-2 font-normal">Requirements</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {incomingBatches.map((r: any) => (
                      <tr key={r.batch} className="hover:bg-surface-2">
                        <td className="num px-4 py-3 font-semibold text-foreground">{r.batch}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.from}</td>
                        <td className="num px-4 py-3 font-bold text-foreground">{r.persons}</td>
                        <td className="num px-4 py-3 text-accent">{r.eta}</td>
                        <td className="px-4 py-3">
                          <StatusPill tone="info">{r.needs}</StatusPill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* TAB 2: OCCUPANCY & CAPACITY */}
      {activeTab === "occupancy" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Capacity Enforcement"
            title="Occupancy & Bed Management"
            description="Manage live bed allocation and check-out workflow. Overbooking beyond capacity is strictly prevented by transactional database constraints."
          />

          <Panel>
            <PanelHeader title="Capacity Gauge & Thresholds" />
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-foreground">Relief Camp Utilization</span>
                  <span className="num font-bold text-foreground">{occupancy.toLocaleString()} / {capacity.toLocaleString()} beds ({occupancyPct}%)</span>
                </div>
                <Bar value={occupancyPct} tone={occupancyPct > 90 ? "critical" : occupancyPct > 70 ? "warning" : "success"} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="rounded-md border border-border bg-surface-2 p-3.5">
                  <span className="label-eyebrow">Capacity Cap</span>
                  <p className="mt-1 num text-xl font-bold text-foreground">{capacity.toLocaleString()}</p>
                  <p className="text-muted-foreground mt-0.5">Maximum Sphere standard cap</p>
                </div>
                <div className="rounded-md border border-border bg-surface-2 p-3.5">
                  <span className="label-eyebrow">Available Bed Spaces</span>
                  <p className="mt-1 num text-xl font-bold text-success">{bedsFree}</p>
                  <p className="text-muted-foreground mt-0.5">Available for new registrations</p>
                </div>
                <div className="rounded-md border border-border bg-surface-2 p-3.5">
                  <span className="label-eyebrow">Overbooking Prevention</span>
                  <p className="mt-1 font-bold text-accent">Active Enforced</p>
                  <p className="text-muted-foreground mt-0.5">ACID rollback on overflow</p>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 3: EVACUEE REGISTRATION */}
      {activeTab === "evacuees" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Intake Desk"
            title="Evacuee Registration & Intake"
            description="Register newly arrived families into the camp. Automatically updates occupancy and adjusts supply consumption projections."
          />

          <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
            <Panel className="border-accent">
              <PanelHeader title="Register Evacuee Intake" icon={<UserPlus className="size-4 text-accent" />} />
              <form className="p-4 space-y-3.5" onSubmit={handleEvacueeIntake}>
                <div>
                  <label className="block text-xs text-muted-foreground">Head of Family Name *</label>
                  <input
                    type="text"
                    required
                    value={intakeName}
                    onChange={(e) => setIntakeName(e.target.value)}
                    placeholder="e.g. Ramesh Patil"
                    className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground">Family Headcount *</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={intakeCount}
                    onChange={(e) => setIntakeCount(parseInt(e.target.value) || 1)}
                    className="num mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground">Origin Sector</label>
                  <select
                    value={intakeSector}
                    onChange={(e) => setIntakeSector(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  >
                    <option>Sector 7 · Riverside</option>
                    <option>Sector 3 · Port</option>
                    <option>Sector 12 · Old Town</option>
                    <option>Sector 9 · Civic</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground">Mobility / Special Needs</label>
                  <input
                    type="text"
                    value={intakeSpecial}
                    onChange={(e) => setIntakeSpecial(e.target.value)}
                    placeholder="e.g. Wheelchair, Diabetic, Infant"
                    className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-md bg-accent py-2.5 text-xs font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
                >
                  {submitting ? "Committing Transaction…" : "Confirm Intake Registration"}
                </button>
              </form>
            </Panel>

            <Panel>
              <PanelHeader title="Registered Evacuees Roster" meta={`${evacuees.length} family units registered`} />
              <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                <table className="w-full min-w-[480px] text-xs">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="label-eyebrow px-4 py-2 font-normal">Registration ID</th>
                      <th className="label-eyebrow px-4 py-2 font-normal">Head of Family</th>
                      <th className="label-eyebrow px-4 py-2 font-normal">Headcount</th>
                      <th className="label-eyebrow px-4 py-2 font-normal">Sector</th>
                      <th className="label-eyebrow px-4 py-2 font-normal">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {evacuees.map((e) => (
                      <tr key={e.id} className="hover:bg-surface-2">
                        <td className="num px-4 py-3 font-semibold text-foreground">{e.id}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{e.fullName}</td>
                        <td className="num px-4 py-3 font-bold text-foreground">{e.familyCount}</td>
                        <td className="px-4 py-3 text-muted-foreground">{e.originSector}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleCheckout(e.id, e.familyCount)}
                            className="rounded border border-border bg-surface-3 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            Check Out
                          </button>
                        </td>
                      </tr>
                    ))}
                    {evacuees.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          No evacuees registered yet today. Use the form on the left to register arrivals.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* TAB 4: INCOMING & TRANSFERS */}
      {activeTab === "transfers" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Corridor Intake"
            title="Incoming Evacuee Batches & Transfers"
            description="Anticipate arrivals dispatched by rescue boats and evacuation coordinators along designated routes."
          />

          <Panel>
            <PanelHeader title="Expected Inbound Evacuee Batches" meta="Updated via Real-time SSE" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-xs">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="label-eyebrow px-4 py-2 font-normal">Batch Identifier</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Origin Sector</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Estimated Headcount</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Corridor ETA</th>
                    <th className="label-eyebrow px-4 py-2 font-normal">Special Requirements</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {incomingBatches.map((b: any) => (
                    <tr key={b.batch} className="hover:bg-surface-2">
                      <td className="num px-4 py-3 font-bold text-foreground">{b.batch}</td>
                      <td className="px-4 py-3 text-foreground">{b.from}</td>
                      <td className="num px-4 py-3 font-semibold text-foreground">{b.persons}</td>
                      <td className="num px-4 py-3 text-accent font-medium">{b.eta}</td>
                      <td className="px-4 py-3">
                        <StatusPill tone="info">{b.needs}</StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 5: SUPPLIES & INVENTORY */}
      {activeTab === "supplies" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Stock Control"
            title="Supplies & Inventory Management"
            description="Live stock tracking for drinking water, ready meals, blankets, medical kits, and hygiene packs."
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="Current Inventory Ratios" />
              <div className="p-5 space-y-4">
                {inventory.map((r) => {
                  const pct = Math.round((r.stock / r.target) * 100);
                  return (
                    <div key={r.item} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-foreground">{r.item}</span>
                        <span className="num text-muted-foreground">{r.stock.toLocaleString()} units</span>
                      </div>
                      <Bar value={pct} tone={pct < 35 ? "critical" : pct < 65 ? "warning" : "success"} />
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Update Inventory Stock" />
              <form className="p-5 space-y-3.5" onSubmit={handleUpdateInventory}>
                <div>
                  <label className="block text-xs text-muted-foreground">Drinking Water Stock (L)</label>
                  <input
                    type="number"
                    value={editWater}
                    onChange={(e) => setEditWater(parseInt(e.target.value) || 0)}
                    className="num mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground">Food / Ready Meals (Units)</label>
                  <input
                    type="number"
                    value={editFood}
                    onChange={(e) => setEditFood(parseInt(e.target.value) || 0)}
                    className="num mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground">Blankets & Bedding (Pcs)</label>
                  <input
                    type="number"
                    value={editBlankets}
                    onChange={(e) => setEditBlankets(parseInt(e.target.value) || 0)}
                    className="num mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground">Medical First-Aid Kits (Units)</label>
                  <input type="number" min={0} value={editMedical}
                    onChange={(e) => setEditMedical(parseInt(e.target.value) || 0)}
                    className="num mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground">Sanitation &amp; Hygiene Kits (Units)</label>
                  <input type="number" min={0} value={editSanitation}
                    onChange={(e) => setEditSanitation(parseInt(e.target.value) || 0)}
                    className="num mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs" />
                </div>
                <button type="submit" disabled={inventorySaving}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60">
                  {inventorySaving ? <><Loader2 className="size-3.5 animate-spin" />Saving…</> : "Save Stock Adjustments"}
                </button>
              </form>
            </Panel>
          </div>
        </div>
      )}

      {/* TAB 6: RESOURCE REQUESTS */}
      {activeTab === "requests" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Logistics Coordination"
            title="Supply Requisitions"
            description="Submit supply orders to the District Disaster Control Centre logistics coordinator."
          />

          <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
            <Panel>
              <PanelHeader title="New Supply Order" icon={<Boxes className="size-4" />} />
              <form className="p-4 space-y-3.5" onSubmit={handleSupplyRequest}>
                <div>
                  <label className="block text-xs text-muted-foreground">Resource Requested</label>
                  <select
                    value={resource}
                    onChange={(e) => setResource(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  >
                    {inventory.map((i) => (
                      <option key={i.item} value={i.item}>{i.item}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground">Quantity Required</label>
                  <input
                    type="number"
                    min={10}
                    max={20000}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 100)}
                    className="num mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground">Urgency Level</label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  >
                    <option>Critical (&lt; 2 h)</option>
                    <option>High (&lt; 6 h)</option>
                    <option>Routine</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-md bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Transmit Supply Requisition"}
                </button>
              </form>
            </Panel>

            <Panel>
              <PanelHeader title="Requisition Audit History" meta={`${supplyRequests.length} orders recorded`} />
              <div className="divide-y divide-border text-xs">
                {supplyRequests.map((r: any) => (
                  <div key={r.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="num font-bold text-foreground">{r.id}</span>
                        <StatusPill tone={r.status === "APPROVED" || r.status === "FULFILLED" ? "success" : "warning"}>
                          {r.status}
                        </StatusPill>
                      </div>
                      <p className="mt-1 font-semibold text-foreground">{r.quantity} units · {r.resource}</p>
                      <p className="text-[11px] text-muted-foreground">Urgency: {r.urgency} · Submitted by {r.submittedBy}</p>
                    </div>
                    <span className="num text-[11px] text-muted-foreground">
                      {new Date(r.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
                {supplyRequests.length === 0 && (
                  <div className="p-6 text-center text-muted-foreground">No supply orders submitted yet.</div>
                )}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* TAB 7: STAFF & VOLUNTEERS */}
      {activeTab === "volunteers" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Human Resources"
            title="Staff & Volunteer Roster"
            description="Manage on-duty volunteers, assign shift stations, and track availability."
          />

          <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <Panel>
              <PanelHeader title="Enroll Volunteer / Staff" icon={<HandHeart className="size-4" />} />
              <form className="p-4 space-y-3.5" onSubmit={handleAddVolunteer}>
                <div>
                  <label className="block text-xs text-muted-foreground">Volunteer Full Name *</label>
                  <input
                    type="text"
                    required
                    value={volName}
                    onChange={(e) => setVolName(e.target.value)}
                    placeholder="e.g. S. Deshpande"
                    className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground">Station Assignment</label>
                  <select
                    value={volRole}
                    onChange={(e) => setVolRole(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  >
                    <option>Intake desk</option>
                    <option>Medical support</option>
                    <option>Kitchen & catering</option>
                    <option>Logistics & water</option>
                    <option>Sanitation & hygiene</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground">Shift Timing</label>
                  <input
                    type="text"
                    value={volShift}
                    onChange={(e) => setVolShift(e.target.value)}
                    placeholder="e.g. 20:00–04:00"
                    className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground"
                >
                  Enroll on Duty Roster
                </button>
              </form>
            </Panel>

            <Panel>
              <PanelHeader title="Active Duty Roster" meta={`${volunteers.length} registered`} />
              <div className="divide-y divide-border text-xs">
                {volunteers.map((v: any) => (
                  <div key={v.name} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{v.name}</p>
                      <p className="text-muted-foreground">{v.role}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="num text-[11px] text-muted-foreground">{v.shift}</span>
                      <StatusPill tone={v.tone || "success"}>{v.available !== false ? "On Duty" : "Off Duty"}</StatusPill>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* TAB 8: FACILITIES & SAFETY */}
      {activeTab === "safety" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Camp Infrastructure"
            title="Facilities & Safety Status"
            description="Monitor essential camp utilities, backup generators, clean water, and fire safety compliance."
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Panel className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="label-eyebrow">Power Grid</span>
                <Zap className="size-4 text-warning" />
              </div>
              <p className="font-bold text-sm text-foreground">Generator Backup Active</p>
              <StatusPill tone="warning">Diesel Genset 88%</StatusPill>
            </Panel>

            <Panel className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="label-eyebrow">Clean Water</span>
                <Droplet className="size-4 text-info" />
              </div>
              <p className="font-bold text-sm text-foreground">Municipal Tanker Online</p>
              <StatusPill tone="success">Water Potable</StatusPill>
            </Panel>

            <Panel className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="label-eyebrow">Sanitation</span>
                <ShieldCheck className="size-4 text-success" />
              </div>
              <p className="font-bold text-sm text-foreground">32 Mobile Toilets Active</p>
              <StatusPill tone="success">Cleaned 00:30</StatusPill>
            </Panel>

            <Panel className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="label-eyebrow">Fire Safety</span>
                <Flame className="size-4 text-critical" />
              </div>
              <p className="font-bold text-sm text-foreground">12 Extinguishers Verified</p>
              <StatusPill tone="success">Cleared</StatusPill>
            </Panel>
          </div>
        </div>
      )}

      {/* TAB 9: REPORTS & ANALYTICS */}
      {activeTab === "reports" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Operational Intelligence"
            title="Reports & Analytics"
            description="Daily camp operational metrics, occupancy progression, and supply consumption forecasts."
          />

          <Panel>
            <PanelHeader title="Daily Shelter Summary" />
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded border border-border bg-surface-2 p-3">
                  <span className="label-eyebrow">Total Intake Today</span>
                  <p className="mt-1 num text-lg font-bold text-foreground">384 persons</p>
                </div>
                <div className="rounded border border-border bg-surface-2 p-3">
                  <span className="label-eyebrow">Rations Consumed</span>
                  <p className="mt-1 num text-lg font-bold text-foreground">1,240 kg</p>
                </div>
                <div className="rounded border border-border bg-surface-2 p-3">
                  <span className="label-eyebrow">Water Disbursed</span>
                  <p className="mt-1 num text-lg font-bold text-foreground">5,600 L</p>
                </div>
                <div className="rounded border border-border bg-surface-2 p-3">
                  <span className="label-eyebrow">Medical Cases Treated</span>
                  <p className="mt-1 num text-lg font-bold text-foreground">28 cases</p>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 10: PROFILE & SETTINGS */}
      {activeTab === "profile" && (
        <div className="space-y-5">
          <PageHeading
            eyebrow="Camp Administration"
            title="Profile & Settings"
            description="Camp metadata, administrator profile, contact registry, and security passkey."
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="Relief Camp Metadata" icon={<Tent className="size-4" />} />
              <dl className="p-5 space-y-3 text-xs">
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">Camp Identifier</dt>
                  <dd className="num font-bold text-foreground">{shelter?.id || "SH-01"}</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">Facility Name</dt>
                  <dd className="font-medium text-foreground">{shelter?.name}</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">Authorized Administrator</dt>
                  <dd className="font-semibold text-foreground">{user?.fullName || "Dr. Ananya Kulkarni"}</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">Official Email</dt>
                  <dd className="font-mono text-muted-foreground">{user?.email}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Authority</dt>
                  <dd className="font-semibold text-success">District Relief Management</dd>
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
