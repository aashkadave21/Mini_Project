import type { Request, Response } from "express";
import { db } from "../db/db.js";
import { eventBus } from "../events/event-bus.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import type { Evacuee, SupplyRequest, Volunteer } from "../types/index.js";

export async function getAllShelters(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: db.state.shelters });
}

export async function getShelterById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const shelter = db.state.shelters.find((s) => s.id === id);
  if (!shelter) {
    res.status(404).json({ success: false, message: `Shelter ${id} not found.` });
    return;
  }

  // Derive incoming batches from actual evacuee records grouped by origin sector
  // A "batch" is a group of evacuees from the same sector who registered within the same hour
  const shelterEvacuees = db.state.evacuees.filter((e) => e.shelterId === id);

  // Group evacuees by batchId if present, otherwise by originSector + hour
  const batchMap = new Map<string, { batchId: string; from: string; persons: number; needs: string }>();
  for (const evac of shelterEvacuees) {
    const batchKey = evac.batchId || `${evac.originSector}-${new Date(evac.registeredAt).toISOString().slice(0, 13)}`;
    const existing = batchMap.get(batchKey);
    if (existing) {
      existing.persons += evac.familyCount;
      if (evac.mobilityNeeds && evac.mobilityNeeds !== "On foot") {
        existing.needs = evac.mobilityNeeds;
      }
    } else {
      batchMap.set(batchKey, {
        batchId: batchKey,
        from: evac.originSector,
        persons: evac.familyCount,
        needs: evac.mobilityNeeds || "Standard",
      });
    }
  }

  // Also add evacuation routes destined for this shelter as pending incoming batches
  const activeRoutes = db.state.evacuationRoutes.filter((r) => r.destinationShelterId === id);
  const incomingFromRoutes = activeRoutes.map((r, idx) => ({
    batch: `RT-${r.id}-${idx + 1}`,
    from: r.originSector,
    persons: Math.round(15 + Math.random() * 60), // estimated persons per corridor
    eta: `${r.travelTimeMin} min`,
    needs: "Standard",
  }));

  // Combine real evacuee batches (last 10) with active route incoming
  const recentBatches = Array.from(batchMap.values())
    .slice(-5)
    .map((b, idx) => ({
      batch: `BT-${idx + 1}`,
      from: b.from,
      persons: b.persons,
      eta: "Arrived",
      needs: b.needs,
    }));

  const incomingBatches = [...incomingFromRoutes.slice(0, 3), ...recentBatches.slice(0, 3)];

  const volunteers = db.state.volunteers.filter((v) => v.shelterId === id);
  const supplyRequests = db.state.supplyRequests.filter((r) => r.shelterId === id);

  res.json({
    success: true,
    data: {
      ...shelter,
      incomingBatches,
      volunteers,
      supplyRequests,
    },
  });
}

/**
 * DBMS Concept Demonstrated: ACID Transaction with Concurrency & Capacity Constraint.
 * If intake exceeds capacity, transaction throws an error and rolls back atomically.
 */
export async function registerEvacueeIntake(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { fullName, familyCount = 1, originSector = "Unknown Sector", mobilityNeeds = "On foot", specialNeeds } = req.body;

  if (!fullName) {
    res.status(400).json({ success: false, error: "ValidationError", message: "Full name is required for intake registration." });
    return;
  }

  const count = Number(familyCount) || 1;
  if (count < 1 || count > 50) {
    res.status(400).json({ success: false, error: "ValidationError", message: "familyCount must be between 1 and 50." });
    return;
  }

  try {
    const result = await db.withTransaction(async (state) => {
      const shelter = state.shelters.find((s) => s.id === id);
      if (!shelter) {
        throw new Error(`Shelter ${id} does not exist.`);
      }

      // Concurrency & Capacity constraint check
      if (shelter.occupancy + count > shelter.capacity) {
        const remaining = shelter.capacity - shelter.occupancy;
        throw new Error(
          `Capacity exceeded! Requested intake of ${count} persons exceeds remaining free capacity (${remaining} beds available at ${shelter.name}).`
        );
      }

      // 1. Create evacuee registration record
      const evacueeRecord: Evacuee = {
        id: `EVAC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        shelterId: id!,
        fullName,
        familyCount: count,
        originSector,
        mobilityNeeds,
        specialNeeds,
        registeredAt: new Date().toISOString(),
      };
      state.evacuees.push(evacueeRecord);

      // 2. Atomically increment shelter occupancy
      shelter.occupancy += count;
      if (shelter.incoming >= count) {
        shelter.incoming -= count;
      } else {
        shelter.incoming = 0;
      }

      // 3. Update status threshold based on real occupancy
      const load = shelter.occupancy / shelter.capacity;
      if (load >= 0.98) shelter.status = "full";
      else if (load >= 0.75) shelter.status = "near-full";
      else shelter.status = "open";

      shelter.lastUpdated = new Date().toISOString();

      return { evacuee: evacueeRecord, shelter };
    });

    await db.logAudit(req.user?.username || "SHELTER_DESK", req.user?.role || "SHELTER_ADMIN", "EVACUEE_INTAKE", id!, {
      evacueeId: result.evacuee.id,
      familyCount: count,
      newOccupancy: result.shelter.occupancy,
    });

    eventBus.broadcast("SHELTER_OCCUPANCY_CHANGED", result.shelter);

    res.status(201).json({
      success: true,
      message: `Successfully registered intake of ${count} evacuees at ${result.shelter.name}.`,
      data: result,
    });
  } catch (err: any) {
    res.status(409).json({
      success: false,
      error: "ShelterCapacityExceeded",
      message: err.message,
    });
  }
}

export async function createSupplyRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { resource, quantity, urgency = "High (< 6 h)", notes } = req.body;

  if (!resource || !quantity) {
    res.status(400).json({ success: false, error: "ValidationError", message: "Resource name and quantity are required." });
    return;
  }

  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) {
    res.status(400).json({ success: false, error: "ValidationError", message: "Quantity must be a positive number." });
    return;
  }

  const validUrgencies = ["Critical (< 2 h)", "High (< 6 h)", "Routine"];
  const normalizedUrgency = validUrgencies.includes(urgency) ? urgency : "High (< 6 h)";

  const newRequest: SupplyRequest = {
    id: `REQ-${Date.now()}-${Math.floor(Math.random() * 100)}`,
    shelterId: id!,
    resource,
    quantity: qty,
    urgency: normalizedUrgency as SupplyRequest["urgency"],
    status: "SUBMITTED",
    submittedBy: req.user?.username || "Shelter Admin",
    notes: notes || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.withTransaction(async (state) => {
    state.supplyRequests.unshift(newRequest);
  });

  await db.logAudit(req.user?.username || "SHELTER_ADMIN", req.user?.role || "SHELTER_ADMIN", "CREATE_SUPPLY_REQUEST", newRequest.id, {
    shelterId: id,
    resource,
    quantity: qty,
    urgency: normalizedUrgency,
  });

  eventBus.broadcast("SUPPLY_REQUEST_UPDATED", newRequest);

  res.status(201).json({
    success: true,
    message: `Supply request for ${qty} units of ${resource} submitted to Control Centre.`,
    data: newRequest,
  });
}

export async function updateVolunteerRoster(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, role, shift } = req.body;

  if (!name || !role) {
    res.status(400).json({ success: false, error: "ValidationError", message: "Volunteer name and role are required." });
    return;
  }

  const newVolunteer: Volunteer = {
    id: `VOL-${Date.now()}`,
    shelterId: id!,
    name,
    role,
    shift: shift || "unassigned",
    tone: "success",
    available: true,
  };

  await db.withTransaction(async (state) => {
    state.volunteers.push(newVolunteer);
  });

  await db.logAudit(req.user?.username || "SHELTER_ADMIN", req.user?.role || "SHELTER_ADMIN", "ADD_VOLUNTEER", newVolunteer.id, {
    shelterId: id,
    name,
    role,
  });

  res.status(201).json({ success: true, data: newVolunteer });
}

export async function checkoutEvacuee(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { evacueeId, count = 1 } = req.body;

  const shelter = db.state.shelters.find((s) => s.id === id);
  if (!shelter) {
    res.status(404).json({ success: false, message: `Shelter ${id} not found.` });
    return;
  }

  const releaseCount = Number(count) || 1;

  await db.withTransaction(async (state) => {
    const s = state.shelters.find((sh) => sh.id === id);
    if (s) {
      s.occupancy = Math.max(0, s.occupancy - releaseCount);
      const load = s.occupancy / s.capacity;
      if (load >= 0.98) s.status = "full";
      else if (load >= 0.75) s.status = "near-full";
      else s.status = "open";
      s.lastUpdated = new Date().toISOString();
    }
    if (evacueeId) {
      const idx = state.evacuees.findIndex((e) => e.id === evacueeId);
      if (idx !== -1) {
        state.evacuees.splice(idx, 1);
      }
    }
  });

  await db.logAudit(req.user?.username || "SHELTER_ADMIN", req.user?.role || "SHELTER_ADMIN", "EVACUEE_CHECKOUT", id!, {
    evacueeId,
    releaseCount,
    newOccupancy: shelter.occupancy,
  });

  eventBus.broadcast("SHELTER_OCCUPANCY_CHANGED", shelter);

  res.json({
    success: true,
    message: `Evacuee check-out recorded. Released ${releaseCount} spaces. Current occupancy: ${shelter.occupancy}.`,
    data: shelter,
  });
}

export async function getEvacueesList(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const evacuees = db.state.evacuees.filter((e) => e.shelterId === id);
  res.json({ success: true, data: evacuees });
}

export async function updateInventory(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { waterStock, foodStock, blanketsStock, medicalKitsStock, sanitationStock } = req.body;

  const shelter = db.state.shelters.find((s) => s.id === id);
  if (!shelter) {
    res.status(404).json({ success: false, message: `Shelter ${id} not found.` });
    return;
  }

  await db.withTransaction(async (state) => {
    const s = state.shelters.find((sh) => sh.id === id);
    if (s) {
      if (waterStock !== undefined) s.waterStock = Number(waterStock);
      if (foodStock !== undefined) s.foodStock = Number(foodStock);
      if (blanketsStock !== undefined) s.blanketsStock = Number(blanketsStock);
      if (medicalKitsStock !== undefined) s.medicalKitsStock = Number(medicalKitsStock);
      if (sanitationStock !== undefined) s.sanitationStock = Number(sanitationStock);
      s.lastUpdated = new Date().toISOString();
    }
  });

  await db.logAudit(req.user?.username || "SHELTER_ADMIN", req.user?.role || "SHELTER_ADMIN", "UPDATE_SHELTER_INVENTORY", id!, {
    waterStock,
    foodStock,
    blanketsStock,
  });

  res.json({
    success: true,
    message: "Shelter inventory successfully updated.",
    data: shelter,
  });
}

export async function updateShelterCapacity(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { capacity, occupancy, status } = req.body;

  const shelter = db.state.shelters.find((s) => s.id === id);
  if (!shelter) {
    res.status(404).json({ success: false, message: `Shelter ${id} not found.` });
    return;
  }

  await db.withTransaction(async (state) => {
    const idx = state.shelters.findIndex((s) => s.id === id);
    if (idx !== -1) {
      if (capacity !== undefined) state.shelters[idx]!.capacity = Math.max(1, Number(capacity));
      if (occupancy !== undefined) state.shelters[idx]!.occupancy = Math.max(0, Number(occupancy));
      if (status !== undefined) {
        state.shelters[idx]!.status = status;
      } else {
        const load = state.shelters[idx]!.occupancy / state.shelters[idx]!.capacity;
        if (load >= 0.98) state.shelters[idx]!.status = "full";
        else if (load >= 0.75) state.shelters[idx]!.status = "near-full";
        else state.shelters[idx]!.status = "open";
      }
      state.shelters[idx]!.lastUpdated = new Date().toISOString();
    }
  });

  const updated = db.state.shelters.find((s) => s.id === id)!;
  await db.logAudit(req.user?.username || "OPERATOR", req.user?.role || "OPERATOR", "UPDATE_SHELTER_CAPACITY", id!, {
    capacity,
    occupancy,
    status: updated.status,
  });

  eventBus.broadcast("SHELTER_OCCUPANCY_CHANGED", updated);

  res.json({
    success: true,
    message: `Shelter ${shelter.name} capacity updated (Capacity: ${updated.capacity}, Occupancy: ${updated.occupancy}, Status: ${updated.status}).`,
    data: updated,
  });
}


