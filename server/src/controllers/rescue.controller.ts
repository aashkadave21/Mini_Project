import type { Response } from "express";
import { db } from "../db/db.js";
import { eventBus } from "../events/event-bus.js";
import {
  allocateRescueTeams,
  findSuitableVehiclesForIncident,
  compareAllocationWithBaseline,
  isVehicleCompatible,
} from "../algorithms/resource-allocation.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";

export async function getAllTeams(_req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json({ success: true, data: db.state.rescueTeams });
}

export async function getAllMissions(_req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json({ success: true, data: db.state.rescueMissions });
}

export async function getActiveMissionDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
  // Use authenticated user's associated team ID — do not hardcode T1
  const teamId = (req.query.teamId as string) || req.user?.associatedEntityId;
  const team = teamId ? db.state.rescueTeams.find((t) => t.id === teamId) : db.state.rescueTeams[0];

  const resolvedTeamId = team?.id;

  // Find this team's active mission
  const mission = resolvedTeamId
    ? db.state.rescueMissions.find(
        (m) => m.assignedTeamId === resolvedTeamId && m.status !== "COMPLETED" && m.status !== "CANCELLED"
      ) || db.state.rescueMissions.find((m) => m.assignedTeamId === resolvedTeamId)
    : db.state.rescueMissions[0];

  const victims = mission
    ? db.state.victims.filter((v) => v.missionId === mission.id)
    : [];

  // Equipment comes from team record if available, otherwise derive from unit type
  const equipmentByUnit: Record<string, { item: string; have: number; need: number }[]> = {
    "NDRF Water Rescue": [
      { item: "Inflatable boats", have: 2, need: 4 },
      { item: "Life jackets", have: 18, need: 20 },
      { item: "Cutting gear", have: 1, need: 1 },
      { item: "Stretchers", have: 3, need: 6 },
    ],
    "Fire & Rescue": [
      { item: "Fire hose reels", have: 4, need: 4 },
      { item: "Breathing apparatus", have: 6, need: 6 },
      { item: "Thermal camera", have: 1, need: 2 },
      { item: "Hydraulic cutters", have: 2, need: 2 },
    ],
    "Urban Search & Rescue": [
      { item: "Concrete saws", have: 2, need: 3 },
      { item: "Search dogs", have: 2, need: 2 },
      { item: "Sonar sensors", have: 1, need: 2 },
      { item: "Medical kits", have: 5, need: 6 },
    ],
    "Medical Response": [
      { item: "Ambulances", have: 2, need: 2 },
      { item: "Trauma kits", have: 10, need: 10 },
      { item: "Ventilators (portable)", have: 2, need: 4 },
      { item: "Blood bags", have: 12, need: 20 },
    ],
    "Coast Guard Air": [
      { item: "Helicopters", have: 1, need: 1 },
      { item: "Rescue hoists", have: 2, need: 2 },
      { item: "Dive equipment", have: 4, need: 4 },
      { item: "Flares", have: 8, need: 10 },
    ],
    "Drone Recon": [
      { item: "UAV units", have: 4, need: 4 },
      { item: "Thermal cameras", have: 2, need: 4 },
      { item: "Battery packs", have: 6, need: 8 },
      { item: "Ground control units", have: 2, need: 2 },
    ],
  };

  // Adjust "have" quantities based on team fuel level (proxy for resource usage)
  const unitKey = team?.unit || "NDRF Water Rescue";
  const baseEquipment = equipmentByUnit[unitKey] || equipmentByUnit["NDRF Water Rescue"]!;
  const fuelFactor = (team?.fuel || 100) / 100;
  const equipment = baseEquipment.map((eq) => ({
    ...eq,
    have: Math.max(0, Math.round(eq.have * (0.5 + fuelFactor * 0.5))),
  }));

  res.json({
    success: true,
    data: {
      team,
      mission,
      victims,
      equipment,
      roads: db.state.roadEdges,
      incidents: db.state.incidents,
    },
  });
}

export async function updateMissionStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { status, outcomeReport } = req.body;

  const validStatuses = ["PENDING", "ASSIGNED", "EN_ROUTE", "ON_SCENE", "COMPLETED", "CANCELLED"];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ success: false, error: "ValidationError", message: `Invalid status. Valid values: ${validStatuses.join(", ")}` });
    return;
  }

  const mission = db.state.rescueMissions.find((m) => m.id === id);
  if (!mission) {
    res.status(404).json({ success: false, message: `Mission ${id} not found.` });
    return;
  }

  // Authorization check: only assigned team or control admin can update
  if (req.user && req.user.role === "RESCUE_TEAM" && req.user.associatedEntityId && mission.assignedTeamId !== req.user.associatedEntityId) {
    res.status(403).json({ success: false, error: "Forbidden", message: "Rescue teams can only update their own assigned missions." });
    return;
  }

  await db.withTransaction(async (state) => {
    const idx = state.rescueMissions.findIndex((m) => m.id === id);
    if (idx !== -1) {
      state.rescueMissions[idx]!.status = status;
      if (outcomeReport) {
        state.rescueMissions[idx]!.outcomeReport = outcomeReport;
      }
      if (status === "COMPLETED") {
        state.rescueMissions[idx]!.completedAt = new Date().toISOString();
        // Free the assigned team
        if (state.rescueMissions[idx]!.assignedTeamId) {
          const tIdx = state.rescueTeams.findIndex((t) => t.id === state.rescueMissions[idx]!.assignedTeamId);
          if (tIdx !== -1) {
            state.rescueTeams[tIdx]!.status = "available";
            state.rescueTeams[tIdx]!.mission = null;
            state.rescueTeams[tIdx]!.updatedAt = new Date().toISOString();
          }
        }
        // Mark the linked incident as resolved
        const incidentId = state.rescueMissions[idx]!.incidentId;
        if (incidentId) {
          const incIdx = state.incidents.findIndex((i) => i.id === incidentId);
          if (incIdx !== -1 && state.incidents[incIdx]!.status !== "resolved") {
            state.incidents[incIdx]!.status = "resolved";
            state.incidents[incIdx]!.updatedAt = new Date().toISOString();
          }
        }
      } else if (status === "EN_ROUTE" || status === "ON_SCENE") {
        // Update team status to match mission progression
        if (state.rescueMissions[idx]!.assignedTeamId) {
          const tIdx = state.rescueTeams.findIndex((t) => t.id === state.rescueMissions[idx]!.assignedTeamId);
          if (tIdx !== -1) {
            state.rescueTeams[tIdx]!.status = status === "EN_ROUTE" ? "en-route" : "on-scene";
            state.rescueTeams[tIdx]!.updatedAt = new Date().toISOString();
          }
        }
      }
    }
  });

  const updated = db.state.rescueMissions.find((m) => m.id === id)!;
  await db.logAudit(req.user?.username || "RESCUE_TEAM", req.user?.role || "RESCUE_TEAM", "UPDATE_MISSION_STATUS", id, { status, outcomeReport });
  eventBus.broadcast("MISSION_UPDATED", updated);

  res.json({
    success: true,
    message: `Mission ${id} status updated to ${status}.`,
    data: updated,
  });
}

export async function submitIncidentReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const incidentId = req.body.incidentId || req.params.id;
  const { observation } = req.body;

  if (!incidentId || !observation) {
    res.status(400).json({ success: false, error: "ValidationError", message: "Incident ID and field observation are required." });
    return;
  }

  // Validate incident exists
  const incident = db.state.incidents.find((i) => i.id === incidentId);
  if (!incident) {
    res.status(404).json({ success: false, message: `Incident ${incidentId} not found.` });
    return;
  }

  const report = {
    id: `REP-${Date.now()}`,
    incidentId,
    reporter: req.user?.username || "FIELD_UNIT",
    observation,
    timestamp: new Date().toISOString(),
  };

  await db.logAudit(req.user?.username || "RESCUE_UNIT", req.user?.role || "RESCUE_TEAM", "SUBMIT_FIELD_REPORT", incidentId, { observation });

  res.status(201).json({
    success: true,
    message: `Field observation successfully recorded for incident ${incidentId}.`,
    data: report,
  });
}

export async function autoAllocateMissions(req: AuthenticatedRequest, res: Response): Promise<void> {
  // Only allocate to unassigned active incidents using real data
  const unassignedIncidents = db.state.incidents.filter(
    (i) => i.status !== "resolved" && i.status !== "cancelled" && i.status !== "dispatched" && i.status !== "on-scene"
  );

  const decisions = allocateRescueTeams(
    unassignedIncidents.length > 0 ? unassignedIncidents : db.state.incidents,
    db.state.rescueTeams
  );

  await db.withTransaction(async (state) => {
    for (const d of decisions) {
      const teamIdx = state.rescueTeams.findIndex((t) => t.id === d.assignedTeamId);
      if (teamIdx !== -1) {
        state.rescueTeams[teamIdx]!.status = "en-route";
        state.rescueTeams[teamIdx]!.mission = d.incidentId;
        state.rescueTeams[teamIdx]!.updatedAt = new Date().toISOString();
      }
      const incIdx = state.incidents.findIndex((i) => i.id === d.incidentId);
      if (incIdx !== -1) {
        state.incidents[incIdx]!.status = "dispatched";
        state.incidents[incIdx]!.updatedAt = new Date().toISOString();
      }
    }
  });

  await db.logAudit(req.user?.username || "CONTROL_ADMIN", "CONTROL_CENTRE_ADMIN", "AUTO_ALLOCATE_RESCUE", "ALL_INCIDENTS", { decisionsCount: decisions.length });
  eventBus.broadcast("MISSION_UPDATED", { decisions });

  res.json({
    success: true,
    message: `Greedy allocation algorithm executed: ${decisions.length} units dispatched based on multi-factor optimization.`,
    data: decisions,
  });
}

export async function updateTeamStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { status, fuel } = req.body;

  const validStatuses = ["available", "en-route", "on-scene", "returning", "offline"];
  if (status && !validStatuses.includes(status)) {
    res.status(400).json({ success: false, error: "ValidationError", message: `Valid statuses: ${validStatuses.join(", ")}` });
    return;
  }

  const team = db.state.rescueTeams.find((t) => t.id === id);
  if (!team) {
    res.status(404).json({ success: false, message: `Rescue team ${id} not found.` });
    return;
  }

  await db.withTransaction(async (state) => {
    const idx = state.rescueTeams.findIndex((t) => t.id === id);
    if (idx !== -1) {
      if (status) state.rescueTeams[idx]!.status = status;
      if (fuel !== undefined) state.rescueTeams[idx]!.fuel = Math.min(100, Math.max(0, Number(fuel)));
      state.rescueTeams[idx]!.updatedAt = new Date().toISOString();
    }
  });

  await db.logAudit(req.user?.username || "RESCUE_TEAM", req.user?.role || "RESCUE_TEAM", "UPDATE_TEAM_STATUS", id!, {
    status,
    fuel,
  });

  res.json({
    success: true,
    message: `Team ${team.callsign} status updated to ${status || team.status}.`,
    data: db.state.rescueTeams.find((t) => t.id === id),
  });
}

export async function getMissionReports(_req: AuthenticatedRequest, res: Response): Promise<void> {
  // Aggregate field reports from audit logs and completed missions
  const fieldReports = db.state.auditLogs
    .filter((a) => a.action === "SUBMIT_FIELD_REPORT")
    .map((a) => ({
      id: a.id,
      incidentId: a.target,
      reporter: a.actor,
      observation: (a.details?.observation as string) || "Field observation recorded.",
      timestamp: a.timestamp,
    }));

  const completedMissionReports = db.state.rescueMissions
    .filter((m) => m.status === "COMPLETED" && m.outcomeReport)
    .map((m) => ({
      id: `OUTCOME-${m.id}`,
      incidentId: m.incidentId,
      reporter: m.assignedTeamId || "Rescue Team",
      observation: m.outcomeReport || "Mission completed successfully.",
      timestamp: m.completedAt || m.createdAt,
    }));

  const combined = [...fieldReports, ...completedMissionReports].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  res.json({ success: true, data: combined });
}

export async function getSuitableVehicles(req: AuthenticatedRequest, res: Response): Promise<void> {
  const incidentId = (req.query.incidentId as string) || (req.params.incidentId as string);
  if (!incidentId) {
    res.status(400).json({ success: false, error: "ValidationError", message: "incidentId is required." });
    return;
  }

  const incident = db.state.incidents.find((i) => i.id === incidentId);
  if (!incident) {
    res.status(404).json({ success: false, message: `Incident ${incidentId} not found.` });
    return;
  }

  const suitable = findSuitableVehiclesForIncident(incident, db.state.rescueTeams);
  res.json({
    success: true,
    data: {
      incident,
      suitableVehicles: suitable,
      count: suitable.length,
    },
  });
}

export async function assignVehicleAtomic(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { teamId, incidentId } = req.body;

  if (!teamId || !incidentId) {
    res.status(400).json({ success: false, error: "ValidationError", message: "teamId and incidentId are required." });
    return;
  }

  const team = db.state.rescueTeams.find((t) => t.id === teamId);
  if (!team) {
    res.status(404).json({ success: false, error: "NotFound", message: `Rescue vehicle ${teamId} not found.` });
    return;
  }

  const incident = db.state.incidents.find((i) => i.id === incidentId);
  if (!incident) {
    res.status(404).json({ success: false, error: "NotFound", message: `Incident ${incidentId} not found.` });
    return;
  }

  // Capability check (Scenario C)
  if (!isVehicleCompatible(team.unit, incident.type)) {
    res.status(400).json({
      success: false,
      error: "IncompatibleVehicle",
      message: `Vehicle ${team.callsign} (${team.unit}) is not equipped for ${incident.type.toUpperCase()} incidents.`,
    });
    return;
  }

  // Atomic state transaction with double-booking prevention (Scenario E)
  try {
    const result = await db.withTransaction(async (state) => {
      const t = state.rescueTeams.find((item) => item.id === teamId);
      if (!t) throw new Error(`Vehicle ${teamId} not found.`);

      // Strict race condition check: if another concurrent request booked this vehicle first
      if (t.status !== "available" || (t.mission !== null && t.mission !== undefined)) {
        const conflictErr: any = new Error(
          `Double-booking prevented: Vehicle ${t.callsign} (${t.id}) is already assigned to mission ${t.mission || t.status}. Concurrent assignment rejected.`
        );
        conflictErr.name = "ConflictError";
        conflictErr.statusCode = 409;
        conflictErr.details = {
          vehicleId: t.id,
          callsign: t.callsign,
          status: t.status,
          assignedMission: t.mission,
        };
        throw conflictErr;
      }

      // Update vehicle state
      t.status = "en-route";
      t.mission = incidentId;
      t.updatedAt = new Date().toISOString();

      // Update incident state
      const inc = state.incidents.find((i) => i.id === incidentId);
      if (inc) {
        inc.status = "dispatched";
        inc.updatedAt = new Date().toISOString();
      }

      // Create or update mission record
      let mission = state.rescueMissions.find((m) => m.incidentId === incidentId);
      if (mission) {
        mission.assignedTeamId = teamId;
        mission.status = "EN_ROUTE";
      } else {
        mission = {
          id: `MIS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          incidentId,
          assignedTeamId: teamId,
          status: "EN_ROUTE",
          victimsCount: incident.victims || 1,
          createdAt: new Date().toISOString(),
        };
        state.rescueMissions.push(mission);
      }

      return { team: t, incident: inc, mission };
    });

    await db.logAudit(
      req.user?.username || "OPERATOR",
      req.user?.role || "OPERATOR",
      "ASSIGN_VEHICLE_ATOMIC",
      teamId,
      { incidentId, callsign: team.callsign, unit: team.unit }
    );

    eventBus.broadcast("MISSION_UPDATED", result.mission);
    eventBus.broadcast("INCIDENT_UPDATED", result.incident);

    res.json({
      success: true,
      message: `Vehicle ${result.team.callsign} successfully dispatched to Incident ${incidentId}.`,
      data: result,
    });
  } catch (err: any) {
    if (err.statusCode === 409 || err.name === "ConflictError") {
      res.status(409).json({
        success: false,
        error: "Conflict",
        message: err.message,
        details: err.details,
      });
      return;
    }
    res.status(500).json({ success: false, error: "InternalError", message: err.message });
  }
}

export async function getAllocationComparison(_req: AuthenticatedRequest, res: Response): Promise<void> {
  const unassigned = db.state.incidents.filter(
    (i) => i.status !== "resolved" && i.status !== "cancelled" && i.status !== "dispatched" && i.status !== "on-scene"
  );
  const incidents = unassigned.length > 0 ? unassigned : db.state.incidents;
  const comparison = compareAllocationWithBaseline(incidents, db.state.rescueTeams);
  res.json({
    success: true,
    data: comparison,
  });
}

export async function syncOfflineMissionUpdates(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { updates } = req.body as {
    updates: Array<{
      opId: string;
      teamId: string;
      status?: "available" | "en-route" | "on-scene" | "returning" | "offline";
      fuel?: number;
      observation?: string;
      incidentId?: string;
      timestamp: string;
    }>;
  };

  if (!Array.isArray(updates)) {
    res.status(400).json({ success: false, error: "ValidationError", message: "updates array is required." });
    return;
  }

  let processedCount = 0;
  let deduplicatedCount = 0;
  const processedOpIds: string[] = [];

  await db.withTransaction(async (state) => {
    for (const op of updates) {
      if (!op.opId) continue;

      // Idempotency check: see if this opId was already recorded in audit logs
      const alreadyApplied = state.auditLogs.some(
        (log) => log.details?.opId === op.opId
      );

      if (alreadyApplied) {
        deduplicatedCount++;
        continue;
      }

      // Apply the update to team
      const tIdx = state.rescueTeams.findIndex((t) => t.id === op.teamId);
      if (tIdx !== -1) {
        if (op.status) state.rescueTeams[tIdx]!.status = op.status;
        if (op.fuel !== undefined) state.rescueTeams[tIdx]!.fuel = Math.min(100, Math.max(0, op.fuel));
        state.rescueTeams[tIdx]!.updatedAt = new Date().toISOString();
      }

      // If there is an observation, record it
      if (op.observation && op.incidentId) {
        state.auditLogs.unshift({
          id: `AUD-SYNC-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: op.timestamp || new Date().toISOString(),
          actor: req.user?.username || op.teamId,
          role: "RESCUE_TEAM",
          action: "SUBMIT_FIELD_REPORT",
          target: op.incidentId,
          details: { observation: op.observation, opId: op.opId, syncedOffline: true },
        });
      }

      // Record sync audit for idempotency deduplication
      state.auditLogs.unshift({
        id: `AUD-OP-${op.opId}`,
        timestamp: new Date().toISOString(),
        actor: req.user?.username || op.teamId,
        role: "RESCUE_TEAM",
        action: "OFFLINE_OP_SYNC",
        target: op.teamId,
        details: { opId: op.opId, status: op.status, fuel: op.fuel, originalTimestamp: op.timestamp },
      });

      processedOpIds.push(op.opId);
      processedCount++;
    }
  });

  eventBus.broadcast("MISSION_UPDATED", { syncedOps: processedOpIds.length });

  res.json({
    success: true,
    message: `Offline synchronization completed: ${processedCount} operation(s) applied, ${deduplicatedCount} duplicate(s) safely ignored.`,
    processedCount,
    deduplicatedCount,
    processedOpIds,
  });
}


