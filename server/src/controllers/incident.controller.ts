import type { Response } from "express";
import { db } from "../db/db.js";
import { eventBus } from "../events/event-bus.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import type { Incident } from "../types/index.js";

export async function getAllIncidents(_req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json({ success: true, data: db.state.incidents });
}

export async function getIncidentById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const incident = db.state.incidents.find((i) => i.id === req.params.id);
  if (!incident) {
    res.status(404).json({ success: false, message: `Incident ${req.params.id} not found.` });
    return;
  }
  res.json({ success: true, data: incident });
}

export async function createIncident(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { title, type, severity, sector, victims, pos, description } = req.body;

  if (!title || !type || !severity || !sector || !pos) {
    res.status(400).json({
      success: false,
      error: "ValidationError",
      message: "Title, type, severity, sector, and coordinates [lat, lng] are required.",
    });
    return;
  }

  const newIncident: Incident = {
    id: `INC-${Math.floor(1000 + Math.random() * 9000)}`,
    title,
    type,
    severity,
    sector,
    reported: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    victims: Number(victims) || 0,
    status: "unassigned",
    pos,
    description: description || "",
    createdBy: req.user?.userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.withTransaction(async (state) => {
    state.incidents.unshift(newIncident);
  });

  await db.logAudit(req.user?.username || "SYSTEM", req.user?.role || "ANONYMOUS", "CREATE_INCIDENT", newIncident.id, { title, sector });
  eventBus.broadcast("INCIDENT_UPDATED", newIncident);

  res.status(201).json({ success: true, data: newIncident });
}

export async function updateIncident(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const updates = req.body;

  const incident = db.state.incidents.find((i) => i.id === id);
  if (!incident) {
    res.status(404).json({ success: false, message: `Incident ${id} not found.` });
    return;
  }

  await db.withTransaction(async (state) => {
    const idx = state.incidents.findIndex((i) => i.id === id);
    if (idx !== -1) {
      state.incidents[idx] = {
        ...state.incidents[idx]!,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
    }
  });

  const updated = db.state.incidents.find((i) => i.id === id)!;
  await db.logAudit(req.user?.username || "OPERATOR", req.user?.role || "OPERATOR", "UPDATE_INCIDENT", id, updates);
  eventBus.broadcast("INCIDENT_UPDATED", updated);

  res.json({ success: true, data: updated });
}

export async function closeIncident(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const incident = db.state.incidents.find((i) => i.id === id);

  if (!incident) {
    res.status(404).json({ success: false, message: `Incident ${id} not found.` });
    return;
  }

  await db.withTransaction(async (state) => {
    const idx = state.incidents.findIndex((i) => i.id === id);
    if (idx !== -1) {
      state.incidents[idx]!.status = "resolved";
      state.incidents[idx]!.updatedAt = new Date().toISOString();
    }
  });

  const updated = db.state.incidents.find((i) => i.id === id)!;
  await db.logAudit(req.user?.username || "OPERATOR", req.user?.role || "OPERATOR", "CLOSE_INCIDENT", id);
  eventBus.broadcast("INCIDENT_UPDATED", updated);

  res.json({ success: true, data: updated, message: `Incident ${id} marked as resolved.` });
}
