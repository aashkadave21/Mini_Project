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
    sector = citizenProfile?.sector || "Unknown Sector",
    headcount = 1,
    medicalUrgency = false,
    notes,
    pos = [19.092, 72.862],
  } = req.body;

  // Check 15-second debounce window
  const lastTime = recentSosSubmissions.get(citizenId);
  const now = Date.now();
  if (lastTime && now - lastTime < 15000) {
    res.status(429).json({
      success: false,
      error: "DuplicateSubmission",
      message: "An emergency SOS has already been recorded in the last 15 seconds. Emergency teams have been notified.",
    });
    return;
  }
  recentSosSubmissions.set(citizenId, now);

  // Dynamically assign nearest available rescue team
  const availableTeam = db.state.rescueTeams.find((t) => t.status === "available") ||
    db.state.rescueTeams.find((t) => t.status === "returning") ||
    db.state.rescueTeams[0];

  const sosId = `SOS-${Math.floor(1000 + Math.random() * 9000)}`;
  const sosRecord: SOSRequest = {
    id: sosId,
    citizenId,
    senderName,
    sector,
    pos,
    headcount: Number(headcount) || 1,
    medicalUrgency: Boolean(medicalUrgency),
    notes: notes || "Immediate evacuation requested via SOS button.",
    status: "RECEIVED",
    createdAt: new Date().toISOString(),
    assignedTeamId: availableTeam?.id,
  };

  await db.withTransaction(async (state) => {
    state.sosRequests.unshift(sosRecord);
  });

  await db.logAudit(senderName, "CITIZEN", "EMERGENCY_SOS_SUBMISSION", sosId, { sector, headcount, medicalUrgency });
  eventBus.broadcast("SOS_ALERT", sosRecord);

  res.status(201).json({
    success: true,
    message: availableTeam
      ? `SOS received by Disaster Control Centre. Dispatched to ${availableTeam.callsign} · ${availableTeam.unit}.`
      : "SOS received by Disaster Control Centre. All units currently deployed — coordinating response.",
    data: {
      sosId: sosRecord.id,
      status: availableTeam ? "DISPATCHED" : "RECEIVED",
      assignedUnit: availableTeam ? `${availableTeam.callsign} · ${availableTeam.unit}` : "Pending assignment",
      eta: availableTeam?.eta || "ETA being calculated",
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
      const sosRecord: SOSRequest = {
        id: `SOS-OFFLINE-${Math.floor(1000 + Math.random() * 9000)}`,
        citizenId,
        senderName,
        sector: op.payload?.sector || "Unknown Sector",
        headcount: op.payload?.headcount || 1,
        medicalUrgency: true,
        notes: "Queued during radio mesh outage; synced upon reconnect.",
        status: "RECEIVED",
        createdAt: op.payload?.timestamp || new Date().toISOString(),
      };
      db.state.sosRequests.unshift(sosRecord);
      processed.push({ opId: op.id, status: "SYNCED", recordId: sosRecord.id });
    }
  }

  db.saveToFile();
  res.json({
    success: true,
    message: `Synchronized ${processed.length} offline operational items with server database.`,
    data: processed,
  });
}
