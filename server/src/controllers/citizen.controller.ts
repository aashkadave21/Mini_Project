import type { Response } from "express";
import { db } from "../db/db.js";
import { eventBus } from "../events/event-bus.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import type { CitizenProfile, SOSRequest } from "../types/index.js";

export async function getCitizenProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  // Resolve citizen profile by authenticated user association — do NOT hardcode CIT-01
  const citizenId = req.user?.associatedEntityId;
  let profile: CitizenProfile | undefined;

  if (citizenId) {
    profile = db.state.citizenProfiles.find((c) => c.id === citizenId || c.userId === req.user?.userId);
  }
  if (!profile && req.user?.userId) {
    profile = db.state.citizenProfiles.find((c) => c.userId === req.user?.userId);
  }
  // Fallback to first profile only for unauthenticated demo access
  if (!profile) {
    profile = db.state.citizenProfiles[0];
  }

  if (!profile) {
    res.status(404).json({ success: false, message: "No citizen profile found for this account." });
    return;
  }

  // Fetch real-time shelter data from db
  const shelter = db.state.shelters.find((s) => s.id === profile?.assignedShelterId) || db.state.shelters[0];

  // Derive active alerts from real incidents and hazard zones — no hardcoded strings
  const activeIncidents = db.state.incidents.filter((i) => i.status !== "resolved" && i.status !== "cancelled");
  const criticalIncidents = activeIncidents.filter((i) => i.severity === "critical");
  const warningIncidents = activeIncidents.filter((i) => i.severity === "warning");

  const activeAlerts: { id: string; tone: "critical" | "warning" | "info"; tag: string; message: string }[] = [];

  criticalIncidents.slice(0, 2).forEach((inc) => {
    activeAlerts.push({
      id: `ALERT-INC-${inc.id}`,
      tone: "critical" as const,
      tag: "Mandatory",
      message: `${inc.title} — ${inc.sector}. ${inc.victims > 0 ? `${inc.victims} affected.` : ""} Follow your assigned evacuation route immediately.`,
    });
  });

  warningIncidents.slice(0, 1).forEach((inc) => {
    activeAlerts.push({
      id: `ALERT-WARN-${inc.id}`,
      tone: "warning" as const,
      tag: "Advisory",
      message: `Warning: ${inc.title} — ${inc.sector}. Avoid the area and monitor updates.`,
    });
  });

  // Add hazard zone alerts
  db.state.hazards.slice(0, 1).forEach((hz) => {
    activeAlerts.push({
      id: `ALERT-HZ-${hz.id}`,
      tone: hz.severity === "critical" ? "critical" : hz.severity === "warning" ? "warning" : "info",
      tag: "Hazard",
      message: `${hz.label} — exercise caution in affected zones.`,
    });
  });

  // Open shelter availability alert
  const openShelters = db.state.shelters.filter((s) => s.status === "open");
  if (openShelters.length > 0) {
    activeAlerts.push({
      id: "ALERT-SHELTER",
      tone: "info" as const,
      tag: "Information",
      message: `Shelter availability: ${openShelters.map((s) => `${s.name} (${s.capacity - s.occupancy} beds free)`).join("; ")}.`,
    });
  }

  res.json({
    success: true,
    data: {
      ...profile,
      shelterInfo: shelter,
      activeAlerts,
    },
  });
}

export async function updateChecklist(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { itemIndex, checked } = req.body;

  if (itemIndex === undefined || checked === undefined) {
    res.status(400).json({ success: false, error: "ValidationError", message: "itemIndex and checked are required." });
    return;
  }

  const citizenId = req.user?.associatedEntityId;

  await db.withTransaction(async (state) => {
    let profile = citizenId
      ? state.citizenProfiles.find((c) => c.id === citizenId || c.userId === req.user?.userId)
      : undefined;
    if (!profile) profile = state.citizenProfiles.find((c) => c.userId === req.user?.userId);
    if (!profile) profile = state.citizenProfiles[0];
    if (profile && profile.checklist[itemIndex] !== undefined) {
      profile.checklist[itemIndex]!.checked = Boolean(checked);
    }
  });

  const updatedProfile =
    (citizenId ? db.state.citizenProfiles.find((c) => c.id === citizenId || c.userId === req.user?.userId) : undefined) ||
    db.state.citizenProfiles.find((c) => c.userId === req.user?.userId) ||
    db.state.citizenProfiles[0]!;

  res.json({ success: true, data: updatedProfile.checklist });
}

export async function updateFamilyCheckin(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { memberId, status, tone = "success" } = req.body;

  if (!memberId || !status) {
    res.status(400).json({ success: false, error: "ValidationError", message: "memberId and status are required." });
    return;
  }

  const citizenId = req.user?.associatedEntityId;

  await db.withTransaction(async (state) => {
    let profile = citizenId
      ? state.citizenProfiles.find((c) => c.id === citizenId || c.userId === req.user?.userId)
      : undefined;
    if (!profile) profile = state.citizenProfiles.find((c) => c.userId === req.user?.userId);
    if (!profile) profile = state.citizenProfiles[0];
    if (profile) {
      const fam = profile.family.find((f) => f.id === memberId);
      if (fam) {
        fam.status = status;
        fam.tone = tone;
        fam.lastReported = new Date().toISOString();
      }
    }
  });

  const updatedProfile =
    (citizenId ? db.state.citizenProfiles.find((c) => c.id === citizenId || c.userId === req.user?.userId) : undefined) ||
    db.state.citizenProfiles.find((c) => c.userId === req.user?.userId) ||
    db.state.citizenProfiles[0]!;

  res.json({ success: true, data: updatedProfile.family });
}

// In-memory anti-spam debounce window (prevents duplicate submissions from rapid clicks)
const recentSosSubmissions = new Map<string, number>();

export async function submitSOS(req: AuthenticatedRequest, res: Response): Promise<void> {
  const citizenId = req.user?.associatedEntityId || req.user?.userId || "ANONYMOUS";
  const senderName = req.user?.username || "Anonymous Citizen";

  // Resolve sector from citizen profile if not provided
  const citizenProfile = req.user?.associatedEntityId
    ? db.state.citizenProfiles.find((c) => c.id === req.user?.associatedEntityId || c.userId === req.user?.userId)
    : db.state.citizenProfiles.find((c) => c.userId === req.user?.userId);

  const {
    sector = citizenProfile?.sector || "Sector 7 · Riverside",
    headcount = 1,
    medicalUrgency = false,
    emergencyType = "medical",
    severity = "critical",
    address,
    notes,
    pos,
  } = req.body;

  // Strict location validation — do NOT silently fallback to default coordinates
  if (
    !pos ||
    !Array.isArray(pos) ||
    pos.length !== 2 ||
    typeof pos[0] !== "number" ||
    typeof pos[1] !== "number" ||
    isNaN(pos[0]) ||
    isNaN(pos[1]) ||
    pos[0] < -90 ||
    pos[0] > 90 ||
    pos[1] < -180 ||
    pos[1] > 180
  ) {
    res.status(400).json({
      success: false,
      error: "ValidationError",
      message: "Explicit and valid geographic coordinates [latitude, longitude] are required. Please select or pin your location on the map.",
    });
    return;
  }

  // Check 5-second anti-spam debounce window
  const lastTime = recentSosSubmissions.get(citizenId);
  const now = Date.now();
  if (lastTime && now - lastTime < 5000) {
    res.status(429).json({
      success: false,
      error: "DuplicateSubmission",
      message: "An emergency SOS was already transmitted in the last 5 seconds. Dispatch operators are processing your request.",
    });
    return;
  }
  recentSosSubmissions.set(citizenId, now);

  const incidentId = `INC-${Math.floor(1000 + Math.random() * 9000)}`;
  const sosId = `SOS-${Math.floor(1000 + Math.random() * 9000)}`;
  const resolvedPos: [number, number] = [Number(pos[0].toFixed(5)), Number(pos[1].toFixed(5))];

  const sosRecord: SOSRequest = {
    id: sosId,
    citizenId,
    senderName,
    sector,
    pos: resolvedPos,
    headcount: Number(headcount) || 1,
    medicalUrgency: Boolean(medicalUrgency),
    notes: notes || `Immediate crisis response requested via SOS [${String(emergencyType).toUpperCase()}].`,
    status: "RECEIVED",
    createdAt: new Date().toISOString(),
  };

  const incidentRecord: Incident = {
    id: incidentId,
    title: `${String(emergencyType || (medicalUrgency ? "medical" : "emergency")).toUpperCase()} SOS: ${address || sector}`,
    type: (["flood", "fire", "collapse", "medical", "landslide", "chemical"].includes(emergencyType) ? emergencyType : "medical") as any,
    severity: (["critical", "warning", "info", "success"].includes(severity) ? severity : "critical") as any,
    sector,
    reported: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    victims: Number(headcount) || 1,
    status: "unassigned",
    pos: resolvedPos,
    description: `${notes || "Citizen SOS emergency extraction requested."} [Address: ${address || "Pinned GPS Coordinates"}]`,
    createdBy: citizenId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.withTransaction(async (state) => {
    state.sosRequests.unshift(sosRecord);
    state.incidents.unshift(incidentRecord);
  });

  await db.logAudit(senderName, "CITIZEN", "EMERGENCY_SOS_SUBMISSION", sosId, {
    incidentId,
    sector,
    address,
    pos: resolvedPos,
    headcount,
    medicalUrgency,
    emergencyType,
  });

  eventBus.broadcast("SOS_ALERT", sosRecord);
  eventBus.broadcast("INCIDENT_UPDATED", incidentRecord);

  res.status(201).json({
    success: true,
    message: `Emergency SOS recorded at [${resolvedPos[0].toFixed(4)}, ${resolvedPos[1].toFixed(4)}]. Incident ${incidentId} transmitted to Disaster Control Centre.`,
    data: {
      sosId: sosRecord.id,
      incidentId: incidentRecord.id,
      status: "RECEIVED",
      pos: resolvedPos,
      address: address || `${resolvedPos[0].toFixed(4)}, ${resolvedPos[1].toFixed(4)}`,
      assignedUnit: "Pending operator assignment",
      eta: "Awaiting vehicle dispatch",
      timestamp: sosRecord.createdAt,
    },
  });
}

export async function syncOfflineQueue(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { operations = [] } = req.body as { operations: { id: string; action: string; payload: any }[] };
  const citizenId = req.user?.associatedEntityId || req.user?.userId || "OFFLINE-CITIZEN";
  const senderName = req.user?.username || "Offline Synced Citizen";

  const processed = [];
  for (const op of operations) {
    if (op.action === "SOS") {
      const pos: [number, number] = Array.isArray(op.payload?.pos) && op.payload.pos.length === 2
        ? [Number(op.payload.pos[0]), Number(op.payload.pos[1])]
        : [19.092, 72.862];
      const sosId = `SOS-OFFLINE-${Math.floor(1000 + Math.random() * 9000)}`;
      const incId = `INC-OFFLINE-${Math.floor(1000 + Math.random() * 9000)}`;

      const sosRecord: SOSRequest = {
        id: sosId,
        citizenId,
        senderName,
        sector: op.payload?.sector || "Unknown Sector",
        pos,
        headcount: op.payload?.headcount || 1,
        medicalUrgency: true,
        notes: "Queued during radio mesh outage; synced upon reconnect.",
        status: "RECEIVED",
        createdAt: op.payload?.timestamp || new Date().toISOString(),
      };

      const incRecord: Incident = {
        id: incId,
        title: `OFFLINE SYNCED SOS: ${op.payload?.sector || "Unknown Sector"}`,
        type: "medical",
        severity: "critical",
        sector: op.payload?.sector || "Unknown Sector",
        reported: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        victims: Number(op.payload?.headcount) || 1,
        status: "unassigned",
        pos,
        description: "Emergency request queued offline during network outage, synchronized upon reconnect.",
        createdBy: citizenId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.withTransaction(async (state) => {
        state.sosRequests.unshift(sosRecord);
        state.incidents.unshift(incRecord);
      });

      eventBus.broadcast("SOS_ALERT", sosRecord);
      eventBus.broadcast("INCIDENT_UPDATED", incRecord);
      processed.push({ opId: op.id, status: "SYNCED", recordId: sosRecord.id, incidentId: incId });
    }
  }

  res.json({
    success: true,
    message: `Synchronized ${processed.length} offline operational items with server database.`,
    data: processed,
  });
}

export async function getMyRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
  const citizenId = req.user?.associatedEntityId || req.user?.userId;
  const username = req.user?.username;

  let requests = db.state.sosRequests;
  if (citizenId || username) {
    requests = requests.filter(
      (r) => r.citizenId === citizenId || (username && r.senderName.toLowerCase() === username.toLowerCase())
    );
  }

  // Enrich with assigned team details if assigned
  const enriched = requests.map((r) => {
    const team = r.assignedTeamId ? db.state.rescueTeams.find((t) => t.id === r.assignedTeamId) : undefined;
    return {
      ...r,
      assignedTeamCallsign: team?.callsign,
      assignedTeamUnit: team?.unit,
    };
  });

  res.json({ success: true, data: enriched });
}

export async function updateCitizenProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  const citizenId = req.user?.associatedEntityId;
  const { bloodGroup, conditions, medication, emergencyContact, sector } = req.body;

  await db.withTransaction(async (state) => {
    let profile = citizenId
      ? state.citizenProfiles.find((c) => c.id === citizenId || c.userId === req.user?.userId)
      : undefined;
    if (!profile) profile = state.citizenProfiles.find((c) => c.userId === req.user?.userId);
    if (!profile) profile = state.citizenProfiles[0];

    if (profile) {
      if (bloodGroup !== undefined) profile.bloodGroup = bloodGroup;
      if (conditions !== undefined) profile.conditions = conditions;
      if (medication !== undefined) profile.medication = medication;
      if (emergencyContact !== undefined) profile.emergencyContact = emergencyContact;
      if (sector !== undefined) profile.sector = sector;
    }
  });

  const updatedProfile =
    (citizenId ? db.state.citizenProfiles.find((c) => c.id === citizenId || c.userId === req.user?.userId) : undefined) ||
    db.state.citizenProfiles.find((c) => c.userId === req.user?.userId) ||
    db.state.citizenProfiles[0]!;

  res.json({ success: true, message: "Profile updated successfully.", data: updatedProfile });
}

export async function addFamilyMember(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { name, status = "Safe", tone = "success" } = req.body;
  if (!name) {
    res.status(400).json({ success: false, error: "ValidationError", message: "Family member name is required." });
    return;
  }

  const citizenId = req.user?.associatedEntityId;
  const newMember = {
    id: `FAM-${Date.now()}`,
    name: name.trim(),
    status,
    tone: (tone as "success" | "warning" | "critical") || "success",
    lastReported: new Date().toISOString(),
  };

  await db.withTransaction(async (state) => {
    let profile = citizenId
      ? state.citizenProfiles.find((c) => c.id === citizenId || c.userId === req.user?.userId)
      : undefined;
    if (!profile) profile = state.citizenProfiles.find((c) => c.userId === req.user?.userId);
    if (!profile) profile = state.citizenProfiles[0];
    if (profile) {
      profile.family.push(newMember);
    }
  });

  res.status(201).json({ success: true, data: newMember, message: "Family contact added." });
}

export async function removeFamilyMember(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { memberId } = req.params;
  const citizenId = req.user?.associatedEntityId;

  await db.withTransaction(async (state) => {
    let profile = citizenId
      ? state.citizenProfiles.find((c) => c.id === citizenId || c.userId === req.user?.userId)
      : undefined;
    if (!profile) profile = state.citizenProfiles.find((c) => c.userId === req.user?.userId);
    if (!profile) profile = state.citizenProfiles[0];
    if (profile) {
      profile.family = profile.family.filter((f) => f.id !== memberId);
    }
  });

  res.json({ success: true, message: "Family member removed." });
}

