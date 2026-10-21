import type { Request, Response } from "express";
import { db } from "../db/db.js";
import { DisasterRoutingEngine } from "../algorithms/routing-engine.js";
import { eventBus } from "../events/event-bus.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";

export async function getCorridors(_req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: {
      routes: db.state.evacuationRoutes,
      roads: db.state.roadEdges,
      hazards: db.state.hazards,
    },
  });
}

export async function computeRoute(req: Request, res: Response): Promise<void> {
  const { startNode, targetNode, algorithm = "Dijkstra" } = req.query as {
    startNode?: string;
    targetNode?: string;
    algorithm?: "Dijkstra" | "A*";
  };

  const start = startNode || "N_S7";
  const target = targetNode || "N_SH01";

  const engine = new DisasterRoutingEngine(
    db.state.roadNodes,
    db.state.roadEdges,
    db.state.hazards
  );

  const result =
    algorithm === "A*"
      ? engine.findRouteAStar(start, target)
      : engine.findRouteDijkstra(start, target);

  res.json({
    success: result.success,
    data: result,
  });
}

export async function recalculateAllRoutes(req: AuthenticatedRequest, res: Response): Promise<void> {
  const engine = new DisasterRoutingEngine(
    db.state.roadNodes,
    db.state.roadEdges,
    db.state.hazards
  );

  await db.withTransaction(async (state) => {
    for (let i = 0; i < state.evacuationRoutes.length; i++) {
      const r = state.evacuationRoutes[i]!;
      // Find suitable start and end nodes based on sector
      let startNode = "N_S7";
      let endNode = "N_SH01";
      if (r.originSector.includes("Sector 3")) {
        startNode = "N_S3";
        endNode = "N_SH04";
      } else if (r.originSector.includes("Sector 12")) {
        startNode = "N_S12";
        endNode = "N_SH03";
      }

      const computation = engine.findRouteDijkstra(startNode, endNode);
      if (computation.success) {
        state.evacuationRoutes[i] = {
          ...r,
          distanceKm: computation.totalDistanceKm,
          travelTimeMin: computation.estimatedTimeMin,
          hazardExposureScore: computation.hazardExposureScore,
          path: computation.coordinates,
          segments: computation.edgeIds,
          algorithm: "Dijkstra",
          updatedAt: new Date().toISOString(),
        };
      }
    }
  });

  await db.logAudit(req.user?.username || "OPERATOR", req.user?.role || "OPERATOR", "RECOMPUTE_EVACUATION_ROUTES", "ALL_CORRIDORS");
  eventBus.broadcast("ROAD_CLOSURE_CHANGED", { routes: db.state.evacuationRoutes });

  res.json({
    success: true,
    message: "All evacuation corridors successfully recalculated using Dijkstra shortest path engine.",
    data: db.state.evacuationRoutes,
  });
}

export async function toggleRoadState(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { state: newState } = req.body;

  const road = db.state.roadEdges.find((r) => r.id === id);
  if (!road) {
    res.status(404).json({ success: false, message: `Road segment ${id} not found.` });
    return;
  }

  const stateToSet = newState || (road.state === "blocked" ? "clear" : "blocked");

  await db.withTransaction(async (dbState) => {
    const idx = dbState.roadEdges.findIndex((r) => r.id === id);
    if (idx !== -1) {
      dbState.roadEdges[idx]!.state = stateToSet;
    }
  });

  // Re-run routing engine across active corridors
  const engine = new DisasterRoutingEngine(
    db.state.roadNodes,
    db.state.roadEdges,
    db.state.hazards
  );

  await db.withTransaction(async (dbState) => {
    for (let i = 0; i < dbState.evacuationRoutes.length; i++) {
      const r = dbState.evacuationRoutes[i]!;
      let startNode = "N_S7";
      let endNode = "N_SH01";
      if (r.originSector.includes("Sector 3")) {
        startNode = "N_S3";
        endNode = "N_SH04";
      } else if (r.originSector.includes("Sector 12")) {
        startNode = "N_S12";
        endNode = "N_SH03";
      }

      const comp = engine.findRouteDijkstra(startNode, endNode);
      if (comp.success) {
        dbState.evacuationRoutes[i] = {
          ...r,
          distanceKm: comp.totalDistanceKm,
          travelTimeMin: comp.estimatedTimeMin,
          hazardExposureScore: comp.hazardExposureScore,
          path: comp.coordinates,
          segments: comp.edgeIds,
          updatedAt: new Date().toISOString(),
        };
      }
    }
  });

  await db.logAudit(req.user?.username || "OPERATOR", req.user?.role || "OPERATOR", "TOGGLE_ROAD_STATE", id, { newState: stateToSet });
  eventBus.broadcast("ROAD_CLOSURE_CHANGED", { roadId: id, newState: stateToSet, routes: db.state.evacuationRoutes });

  res.json({
    success: true,
    message: `Road ${road.name} state updated to ${stateToSet}. Evacuation corridors recomputed.`,
    data: {
      road: db.state.roadEdges.find((r) => r.id === id),
      routes: db.state.evacuationRoutes,
    },
  });
}

export async function getSectorsClearance(_req: Request, res: Response): Promise<void> {
  // Base population estimates per sector (fixed geography)
  const sectorMeta: { id: string; name: string; population: number; sectorLabel: string; order: "MANDATORY" | "ADVISORY" | "STANDBY" }[] = [
    { id: "S-3", name: "Port", sectorLabel: "Sector 3", population: 4200, order: "MANDATORY" },
    { id: "S-7", name: "Riverside", sectorLabel: "Sector 7", population: 6100, order: "MANDATORY" },
    { id: "S-9", name: "Civic", sectorLabel: "Sector 9", population: 2800, order: "ADVISORY" },
    { id: "S-12", name: "Old Town", sectorLabel: "Sector 12", population: 3400, order: "MANDATORY" },
    { id: "S-18", name: "North Ridge", sectorLabel: "Sector 18", population: 1900, order: "STANDBY" },
  ];

  // Count evacuees per sector from actual database
  const sectors = sectorMeta.map((meta) => {
    const evacuated = db.state.evacuees.filter((e) => e.originSector.includes(meta.sectorLabel))
      .reduce((acc, e) => acc + e.familyCount, 0);

    // Active incidents in sector affect clearance order
    const sectorIncidents = db.state.incidents.filter(
      (i) => i.sector.includes(meta.sectorLabel) && i.status !== "resolved" && i.status !== "cancelled"
    );
    const hasCritical = sectorIncidents.some((i) => i.severity === "critical");
    const effectiveOrder = hasCritical ? "MANDATORY" : meta.order;

    return {
      id: meta.id,
      name: meta.name,
      population: meta.population,
      cleared: evacuated,
      order: effectiveOrder,
      activeIncidents: sectorIncidents.length,
    };
  });

  res.json({ success: true, data: sectors });
}
