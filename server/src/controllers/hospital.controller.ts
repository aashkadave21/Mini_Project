import type { Request, Response } from "express";
import { db } from "../db/db.js";
import { eventBus } from "../events/event-bus.js";
import { prioritizeTriageQueue } from "../algorithms/resource-allocation.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import type { TriageCase, AmbulanceArrival } from "../types/index.js";

export async function getAllHospitals(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: db.state.hospitals });
}

export async function getHospitalDetails(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const hospital = db.state.hospitals.find((h) => h.id === id);

  if (!hospital) {
    res.status(404).json({ success: false, message: `Hospital ${id} not found.` });
    return;
  }

  const rawCases = db.state.triageCases.filter((c) => c.hospitalId === id);
  const triageQueue = prioritizeTriageQueue(rawCases);
  const ambulances = db.state.ambulances.filter((a) => a.hospitalId === id);
  const blood = db.state.bloodInventory;

  res.json({
    success: true,
    data: {
      ...hospital,
      triageQueue,
      ambulances,
      blood,
    },
  });
}

export async function declareHospitalDiversion(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { diversion, reason } = req.body;

  const hospital = db.state.hospitals.find((h) => h.id === id);
  if (!hospital) {
    res.status(404).json({ success: false, message: `Hospital ${id} not found.` });
    return;
  }

  const newDiversionState = diversion !== undefined ? Boolean(diversion) : !hospital.diversion;

  await db.withTransaction(async (state) => {
    const idx = state.hospitals.findIndex((h) => h.id === id);
    if (idx !== -1) {
      state.hospitals[idx]!.diversion = newDiversionState;
      state.hospitals[idx]!.diversionReason = reason || (newDiversionState ? "Critical surge capacity reached" : undefined);
      state.hospitals[idx]!.updatedAt = new Date().toISOString();
    }
  });

  const updated = db.state.hospitals.find((h) => h.id === id)!;
  await db.logAudit(req.user?.username || "HOSPITAL_STAFF", req.user?.role || "HOSPITAL_STAFF", "DECLARE_HOSPITAL_DIVERSION", id, {
    diversion: newDiversionState,
    reason,
  });

  eventBus.broadcast("HOSPITAL_DIVERSION_CHANGED", updated);

  res.json({
    success: true,
    message: newDiversionState
      ? `Hospital ${hospital.name} declared under DIVERSION. Inbound ambulances will be rerouted.`
      : `Hospital ${hospital.name} DIVERSION lifted. Normal casualty intake resumed.`,
    data: updated,
  });
}

export async function addTriageCase(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { tag, desc } = req.body;

  if (!tag || !desc) {
    res.status(400).json({ success: false, error: "ValidationError", message: "Triage tag (Red, Yellow, Green) and presentation description are required." });
    return;
  }

  const newCase: TriageCase = {
    id: `C-${Math.floor(8000 + Math.random() * 1000)}`,
    hospitalId: id!,
    tag,
    desc,
    wait: "0 min",
    arrivalTime: new Date().toISOString(),
    status: "WAITING",
  };

  await db.withTransaction(async (state) => {
    state.triageCases.unshift(newCase);
    // Decrease free bed if Red or Yellow
    const hIdx = state.hospitals.findIndex((h) => h.id === id);
    if (hIdx !== -1 && state.hospitals[hIdx]!.bedsFree > 0) {
      state.hospitals[hIdx]!.bedsFree -= 1;
    }
  });

  await db.logAudit(req.user?.username || "TRIAGE_DESK", req.user?.role || "HOSPITAL_STAFF", "INTAKE_TRIAGE_CASE", newCase.id, { hospitalId: id, tag });

  res.status(201).json({
    success: true,
    data: newCase,
    message: `Casualty ${newCase.id} registered under triage category ${tag}.`,
  });
}

export async function registerAmbulanceArrival(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { unit, eta, triage, cases } = req.body;

  if (!unit) {
    res.status(400).json({ success: false, error: "ValidationError", message: "Unit identifier is required." });
    return;
  }

  const newArrival: AmbulanceArrival = {
    id: `AMB-${Date.now()}`,
    hospitalId: id!,
    unit,
    eta: eta || "5 min",
    triage: triage || "Yellow",
    cases: Number(cases) || 1,
    tone: triage === "Red" ? "critical" : triage === "Yellow" ? "warning" : "success",
    arrived: false,
  };

  await db.withTransaction(async (state) => {
    state.ambulances.push(newArrival);
    const hIdx = state.hospitals.findIndex((h) => h.id === id);
    if (hIdx !== -1) {
      state.hospitals[hIdx]!.incoming += newArrival.cases;
    }
  });

  res.status(201).json({ success: true, data: newArrival });
}
