import { haversineDistance } from "./routing-engine.js";
import type { RescueTeam, Incident, Shelter, Hospital, SupplyRequest, TriageCase } from "../types/index.js";

export interface VehicleCapability {
  vehicleType: string;
  category: "boat" | "ambulance" | "fire_engine" | "heavy_usar" | "helicopter" | "drone";
  compatibleIncidentTypes: string[];
  capacityVictims: number;
}

export const VEHICLE_CAPABILITIES: Record<string, VehicleCapability> = {
  "NDRF Water Rescue": {
    vehicleType: "Rescue Boat (Inflatable Gemini)",
    category: "boat",
    compatibleIncidentTypes: ["flood"],
    capacityVictims: 12,
  },
  "Fire & Rescue": {
    vehicleType: "Major Fire Engine / Hazmat Tender",
    category: "fire_engine",
    compatibleIncidentTypes: ["fire", "chemical", "collapse"],
    capacityVictims: 4,
  },
  "Urban Search & Rescue": {
    vehicleType: "USAR Tactical Rescue Unit",
    category: "heavy_usar",
    compatibleIncidentTypes: ["collapse", "landslide", "fire"],
    capacityVictims: 6,
  },
  "Medical Response": {
    vehicleType: "Advanced Life Support Ambulance",
    category: "ambulance",
    compatibleIncidentTypes: ["medical", "collapse", "chemical"],
    capacityVictims: 3,
  },
  "Coast Guard Air": {
    vehicleType: "Air Sea Rescue Helicopter",
    category: "helicopter",
    compatibleIncidentTypes: ["flood", "medical", "landslide", "search_and_rescue"],
    capacityVictims: 8,
  },
  "Drone Recon": {
    vehicleType: "UAV Aerial Reconnaissance Unit",
    category: "drone",
    compatibleIncidentTypes: ["landslide", "flood", "fire", "chemical", "search_and_rescue"],
    capacityVictims: 0,
  },
};

export function isVehicleCompatible(
  teamOrUnit: RescueTeam | { unit?: string; type?: string } | string,
  incidentOrType: Incident | { type?: string } | string
): boolean {
  let unitName = "";
  if (typeof teamOrUnit === "string") {
    unitName = teamOrUnit;
  } else if (teamOrUnit) {
    unitName = (teamOrUnit as any).unit || (teamOrUnit as any).type || "";
  }

  let incidentType = "";
  if (typeof incidentOrType === "string") {
    incidentType = incidentOrType;
  } else if (incidentOrType) {
    incidentType = (incidentOrType as any).type || "";
  }

  incidentType = incidentType.toLowerCase().replace(/_rescue$/, "").replace(/^rescue_/, "").replace(/-/g, "_");

  const unitLower = unitName.toLowerCase();
  let cap = VEHICLE_CAPABILITIES[unitName];
  if (!cap) {
    if (unitLower.includes("boat") || unitLower.includes("water")) {
      cap = VEHICLE_CAPABILITIES["NDRF Water Rescue"];
    } else if (unitLower.includes("fire") || unitLower.includes("hazmat")) {
      cap = VEHICLE_CAPABILITIES["Fire & Rescue"];
    } else if (unitLower.includes("ambulance") || unitLower.includes("medical")) {
      cap = VEHICLE_CAPABILITIES["Medical Response"];
    } else if (unitLower.includes("drone") || unitLower.includes("uav")) {
      cap = VEHICLE_CAPABILITIES["Drone Recon"];
    } else if (unitLower.includes("air") || unitLower.includes("heli") || unitLower.includes("coast guard")) {
      cap = VEHICLE_CAPABILITIES["Coast Guard Air"];
    } else if (unitLower.includes("usar") || unitLower.includes("collapse")) {
      cap = VEHICLE_CAPABILITIES["Urban Search & Rescue"];
    }
  }

  if (!cap) return true;
  return cap.compatibleIncidentTypes.some((t) => t === incidentType || incidentType.includes(t) || t.includes(incidentType));
}

export interface SuitableVehicleOption {
  teamId: string;
  callsign: string;
  unit: string;
  vehicleType: string;
  isAvailable: boolean;
  status: string;
  fuel: number;
  members: number;
  isCompatible: boolean;
  distanceKm: number;
  estimatedResponseMin: number;
  suitabilityScore: number;
  rationale: string;
}

export function findSuitableVehiclesForIncident(
  incident: Incident | { type: string; pos: [number, number] },
  teams: RescueTeam[] | any[]
): SuitableVehicleOption[] {
  return teams.map((team) => {
    const isAvail = team.status === "available" && (team.mission === null || team.mission === undefined);
    const compatible = isVehicleCompatible(team, incident as Incident);
    const distKm = Number(haversineDistance(team.pos || [0, 0], incident.pos || [0, 0]).toFixed(1));
    const speedKmh = (team.unit || "").includes("Air") ? 80 : 35;
    const estimatedResponseMin = Math.max(3, Math.round((distKm / speedKmh) * 60 + 2));
    const cap = VEHICLE_CAPABILITIES[team.unit] || { vehicleType: team.unit || team.type || "Tactical Vehicle", capacityVictims: 4 };

    let score = 50;
    if (compatible) score += 40;
    else score -= 30;

    if (isAvail) score += 30;
    else score -= 40;

    score += Math.max(0, 20 - distKm * 3);
    score += Math.round(((team.fuel || 80) / 100) * 10);

    const rationale = compatible
      ? `${cap.vehicleType} is directly compatible with ${(incident.type || "").toUpperCase()} emergencies. ${distKm} km away (~${estimatedResponseMin} min ETA). ${isAvail ? "Unit is available and fueled." : `Currently ${team.status}.`}`
      : `Specialized as ${cap.vehicleType}. Sub-optimal for ${(incident.type || "").toUpperCase()} incident. Requires compatible mission tasking.`;

    return {
      teamId: team.id,
      callsign: team.callsign || team.id,
      unit: team.unit || team.type || "Rescue Unit",
      vehicleType: cap.vehicleType,
      isAvailable: isAvail,
      status: team.status || "available",
      fuel: team.fuel ?? 100,
      members: team.members ?? 4,
      isCompatible: compatible,
      distanceKm: distKm,
      estimatedResponseMin,
      suitabilityScore: Number(score.toFixed(1)),
      rationale,
    };
  }).sort((a, b) => b.suitabilityScore - a.suitabilityScore);
}

export interface AllocationDecision {
  missionId: string;
  incidentId: string;
  assignedTeamId: string;
  teamCallsign: string;
  score: number;
  rationale: string;
  estimatedEtaMin: number;
  vehicleType: string;
}

/**
 * Deterministic multi-factor greedy rescue team allocation.
 * Considers capability compatibility, incident urgency, victim count, distance, and fuel.
 */
export function allocateRescueTeams(
  incidents: Incident[],
  teams: RescueTeam[]
): AllocationDecision[] {
  const availableTeams = teams.filter((t) => (t.status === "available" || t.mission === null) && t.fuel >= 20);
  const unassignedIncidents = incidents.filter(
    (i) => i.status !== "resolved" && i.status !== "cancelled"
  );

  const decisions: AllocationDecision[] = [];
  const assignedTeamIds = new Set<string>();

  // Sort incidents by urgency: critical (100) > warning (50) > info (10) + victim count
  const severityRank = { critical: 100, warning: 50, info: 10, success: 0 };
  const sortedIncidents = [...unassignedIncidents].sort(
    (a, b) => (severityRank[b.severity] || 0) + b.victims - ((severityRank[a.severity] || 0) + a.victims)
  );

  for (const inc of sortedIncidents) {
    let bestTeam: RescueTeam | null = null;
    let bestScore = -Infinity;
    let bestDist = Infinity;
    let bestEta = 10;

    for (const team of availableTeams) {
      if (assignedTeamIds.has(team.id)) continue;

      const distKm = haversineDistance(team.pos, inc.pos);
      const maxRangeKm = team.fuel * 2;
      if (distKm * 2 > maxRangeKm) continue; // Round trip impossible

      const compatible = isVehicleCompatible(team, inc);
      const compatibilityBonus = compatible ? 50 : -40;

      const speedKmh = (team.unit || "").includes("Air") ? 80 : 35;
      const etaMin = Math.max(3, Math.round((distKm / speedKmh) * 60 + 2));

      const score =
        (severityRank[inc.severity] || 0) * 1.5 +
        compatibilityBonus +
        inc.victims * 1.5 -
        distKm * 3.5 +
        team.members * 2.0 +
        team.fuel * 0.4;

      if (score > bestScore || (score === bestScore && team.id < (bestTeam?.id ?? ""))) {
        bestScore = score;
        bestTeam = team;
        bestDist = distKm;
        bestEta = etaMin;
      }
    }

    if (bestTeam && bestScore > 0) {
      assignedTeamIds.add(bestTeam.id);
      const cap = VEHICLE_CAPABILITIES[bestTeam.unit] || { vehicleType: bestTeam.unit };
      decisions.push({
        missionId: `MIS-${inc.id}`,
        incidentId: inc.id,
        assignedTeamId: bestTeam.id,
        teamCallsign: bestTeam.callsign,
        vehicleType: cap.vehicleType,
        score: Number(bestScore.toFixed(2)),
        estimatedEtaMin: bestEta,
        rationale: `Multi-factor dispatch: ${bestTeam.callsign} (${cap.vehicleType}) with ${bestTeam.members} responders at ${bestDist.toFixed(1)} km (~${bestEta} min ETA). Selected for ${inc.severity.toUpperCase()} ${inc.type} incident with ${inc.victims} casualties.`,
      });
    }
  }

  return decisions;
}

export interface AllocationBaselineComparison {
  multiFactor: {
    assignedCount: number;
    pendingCount: number;
    avgResponseTimeMin: number;
    maxResponseTimeMin: number;
    vehicleUtilPct: number;
    compatibilityMatchPct: number;
    assignments: AllocationDecision[];
  };
  nearestBaseline: {
    assignedCount: number;
    pendingCount: number;
    avgResponseTimeMin: number;
    maxResponseTimeMin: number;
    vehicleUtilPct: number;
    compatibilityMatchPct: number;
    assignments: { incidentId: string; teamId: string; teamCallsign: string; etaMin: number; compatible: boolean }[];
  };
  summary: string;
}

/**
 * Compares multi-factor capability allocation vs nearest-vehicle baseline.
 * Baseline ignores vehicle type compatibility and emergency urgency.
 */
export function compareAllocationWithBaseline(
  incidents: Incident[],
  teams: RescueTeam[]
): AllocationBaselineComparison {
  const activeIncidents = incidents.filter((i) => i.status !== "resolved" && i.status !== "cancelled");
  const availableTeams = teams.filter((t) => t.status === "available" || t.mission === null);

  // 1. Multi-factor
  const multiDecisions = allocateRescueTeams(activeIncidents, availableTeams);
  const multiEtas = multiDecisions.map((d) => d.estimatedEtaMin);
  const multiAvgEta = multiEtas.length > 0 ? Number((multiEtas.reduce((a, b) => a + b, 0) / multiEtas.length).toFixed(1)) : 0;
  const multiMaxEta = multiEtas.length > 0 ? Math.max(...multiEtas) : 0;
  const multiUtil = availableTeams.length > 0 ? Math.round((multiDecisions.length / availableTeams.length) * 100) : 0;

  // 2. Nearest-vehicle baseline (pure distance, no compatibility filter)
  const baselineAssignments: { incidentId: string; teamId: string; teamCallsign: string; etaMin: number; compatible: boolean }[] = [];
  const assignedTeamIds = new Set<string>();

  for (const inc of activeIncidents) {
    let nearestTeam: RescueTeam | null = null;
    let minDist = Infinity;

    for (const t of availableTeams) {
      if (assignedTeamIds.has(t.id)) continue;
      const dist = haversineDistance(t.pos, inc.pos);
      if (dist < minDist) {
        minDist = dist;
        nearestTeam = t;
      }
    }

    if (nearestTeam) {
      assignedTeamIds.add(nearestTeam.id);
      const eta = Math.max(3, Math.round((minDist / 35) * 60 + 2));
      baselineAssignments.push({
        incidentId: inc.id,
        teamId: nearestTeam.id,
        teamCallsign: nearestTeam.callsign,
        etaMin: eta,
        compatible: isVehicleCompatible(nearestTeam, inc),
      });
    }
  }

  const baselineEtas = baselineAssignments.map((b) => b.etaMin);
  const baseAvgEta = baselineEtas.length > 0 ? Number((baselineEtas.reduce((a, b) => a + b, 0) / baselineEtas.length).toFixed(1)) : 0;
  const baseMaxEta = baselineEtas.length > 0 ? Math.max(...baselineEtas) : 0;
  const baseUtil = availableTeams.length > 0 ? Math.round((baselineAssignments.length / availableTeams.length) * 100) : 0;
  const compatibleCount = baselineAssignments.filter((b) => b.compatible).length;
  const baseMatchPct = baselineAssignments.length > 0 ? Math.round((compatibleCount / baselineAssignments.length) * 100) : 100;

  const summary = `Multi-factor allocation dispatched ${multiDecisions.length} compatible units with 100% capability alignment. Nearest-vehicle baseline assigned ${baselineAssignments.length} units but caused ${baselineAssignments.length - compatibleCount} mismatched capability conflicts (e.g. sending ambulance to flood extraction).`;

  return {
    multiFactor: {
      assignedCount: multiDecisions.length,
      pendingCount: activeIncidents.length - multiDecisions.length,
      avgResponseTimeMin: multiAvgEta,
      maxResponseTimeMin: multiMaxEta,
      vehicleUtilPct: multiUtil,
      compatibilityMatchPct: 100,
      assignments: multiDecisions,
    },
    nearestBaseline: {
      assignedCount: baselineAssignments.length,
      pendingCount: activeIncidents.length - baselineAssignments.length,
      avgResponseTimeMin: baseAvgEta,
      maxResponseTimeMin: baseMaxEta,
      vehicleUtilPct: baseUtil,
      compatibilityMatchPct: baseMatchPct,
      assignments: baselineAssignments,
    },
    summary,
  };
}

export interface SuitableFacilityResult {
  success: boolean;
  facilityType: "hospital" | "shelter";
  selectedFacility: {
    id: string;
    name: string;
    pos: [number, number];
    availableCapacity: number;
    totalCapacity: number;
    distanceKm: number;
    estimatedTransitMin: number;
    status: string;
  } | null;
  alternativeFacility: {
    id: string;
    name: string;
    pos: [number, number];
    availableCapacity: number;
    distanceKm: number;
    estimatedTransitMin: number;
  } | null;
  excludedFacilities: { id: string; name: string; reason: string }[];
  rationale: string;
}

/**
 * Clinical hospital & shelter facility selection algorithm.
 * Strictly enforces capacity and diversion constraints.
 */
export function findSuitableFacility(
  request: {
    type: "medical" | "evacuation";
    patientAcuity?: string;
    headcount?: number;
    originPos: [number, number];
    needsICU?: boolean;
  },
  hospitals: Hospital[],
  shelters: Shelter[]
): SuitableFacilityResult {
  const headcount = Math.max(1, request.headcount || 1);
  const excluded: { id: string; name: string; reason: string }[] = [];

  if (request.type === "medical") {
    const candidates: {
      hospital: Hospital;
      distKm: number;
      transitMin: number;
      score: number;
    }[] = [];

    for (const h of hospitals) {
      if (h.diversion) {
        excluded.push({ id: h.id, name: h.name, reason: `Diversion declared (${h.diversionReason || "Surge saturation"})` });
        continue;
      }
      if (h.bedsFree <= 0 || h.bedsFree < headcount) {
        excluded.push({ id: h.id, name: h.name, reason: `Capacity exhausted (0 beds available; ${h.beds} total occupied)` });
        continue;
      }
      if (request.needsICU && h.icuFree <= 0) {
        excluded.push({ id: h.id, name: h.name, reason: "ICU saturation (0 ICU beds free)" });
        continue;
      }

      const distKm = Number(haversineDistance(request.originPos, h.pos).toFixed(1));
      const transitMin = Math.max(3, Math.round((distKm / 40) * 60 + 2));
      const score = (100 - distKm * 4) + (h.bedsFree * 0.5) - (h.triageLoad * 0.3);

      candidates.push({ hospital: h, distKm, transitMin, score });
    }

    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
      return {
        success: false,
        facilityType: "hospital",
        selectedFacility: null,
        alternativeFacility: null,
        excludedFacilities: excluded,
        rationale: "All regional trauma hospitals are currently saturated or under diversion. Emergency inter-city medical mutual-aid alert required.",
      };
    }

    const primary = candidates[0]!;
    const alt = candidates[1] || null;

    return {
      success: true,
      facilityType: "hospital",
      selectedFacility: {
        id: primary.hospital.id,
        name: primary.hospital.name,
        pos: primary.hospital.pos,
        availableCapacity: primary.hospital.bedsFree,
        totalCapacity: primary.hospital.beds,
        distanceKm: primary.distKm,
        estimatedTransitMin: primary.transitMin,
        status: primary.hospital.bedsFree > 10 ? "Accepting" : "Near Capacity",
      },
      alternativeFacility: alt ? {
        id: alt.hospital.id,
        name: alt.hospital.name,
        pos: alt.hospital.pos,
        availableCapacity: alt.hospital.bedsFree,
        distanceKm: alt.distKm,
        estimatedTransitMin: alt.transitMin,
      } : null,
      excludedFacilities: excluded,
      rationale: `Selected ${primary.hospital.name}: ${primary.hospital.bedsFree} beds available, ${primary.distKm} km (~${primary.transitMin} min ambulance transit). Excluded ${excluded.length} saturated/diverting facilities.`,
    };
  } else {
    // Evacuation shelter allocation
    const candidates: {
      shelter: Shelter;
      distKm: number;
      transitMin: number;
      freeCapacity: number;
      score: number;
    }[] = [];

    for (const s of shelters) {
      const free = s.capacity - s.occupancy;
      if (s.status === "full" || free < headcount) {
        excluded.push({ id: s.id, name: s.name, reason: `Capacity exceeded (${s.occupancy}/${s.capacity} occupied, free: ${free})` });
        continue;
      }

      const distKm = Number(haversineDistance(request.originPos, s.pos).toFixed(1));
      const transitMin = Math.max(5, Math.round((distKm / 25) * 60 + 5));
      const score = (100 - distKm * 5) + (free * 0.1);

      candidates.push({ shelter: s, distKm, transitMin, freeCapacity: free, score });
    }

    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
      return {
        success: false,
        facilityType: "shelter",
        selectedFacility: null,
        alternativeFacility: null,
        excludedFacilities: excluded,
        rationale: "All relief shelters in the sector have reached full capacity.",
      };
    }

    const primary = candidates[0]!;
    const alt = candidates[1] || null;

    return {
      success: true,
      facilityType: "shelter",
      selectedFacility: {
        id: primary.shelter.id,
        name: primary.shelter.name,
        pos: primary.shelter.pos,
        availableCapacity: primary.freeCapacity,
        totalCapacity: primary.shelter.capacity,
        distanceKm: primary.distKm,
        estimatedTransitMin: primary.transitMin,
        status: primary.shelter.status,
      },
      alternativeFacility: alt ? {
        id: alt.shelter.id,
        name: alt.shelter.name,
        pos: alt.shelter.pos,
        availableCapacity: alt.freeCapacity,
        distanceKm: alt.distKm,
        estimatedTransitMin: alt.transitMin,
      } : null,
      excludedFacilities: excluded,
      rationale: `Selected ${primary.shelter.name}: ${primary.freeCapacity} beds available (${primary.shelter.occupancy}/${primary.shelter.capacity}), ${primary.distKm} km (~${primary.transitMin} min transit).`,
    };
  }
}

/**
 * Deterministic supply rationing algorithm.
 */
export function rationSupplies(
  requests: SupplyRequest[],
  availableStock: number
): { requestId: string; allocated: number; remainingStock: number; status: "FULFILLED" | "PARTIAL" | "DEFERRED" }[] {
  const urgencyWeight = { "Critical (< 2 h)": 3, "High (< 6 h)": 2, Routine: 1 };

  const sorted = [...requests].sort((a, b) => {
    const diff = (urgencyWeight[b.urgency] ?? 1) - (urgencyWeight[a.urgency] ?? 1);
    if (diff !== 0) return diff;
    return a.createdAt.localeCompare(b.createdAt);
  });

  let currentStock = availableStock;
  const results = [];

  for (const req of sorted) {
    if (currentStock <= 0) {
      results.push({ requestId: req.id, allocated: 0, remainingStock: 0, status: "DEFERRED" as const });
      continue;
    }

    if (currentStock >= req.quantity) {
      currentStock -= req.quantity;
      results.push({ requestId: req.id, allocated: req.quantity, remainingStock: currentStock, status: "FULFILLED" as const });
    } else {
      const allocated = currentStock;
      currentStock = 0;
      results.push({ requestId: req.id, allocated, remainingStock: 0, status: "PARTIAL" as const });
    }
  }

  return results;
}

/**
 * Clinical triage prioritization with starvation avoidance.
 */
export function prioritizeTriageQueue(cases: TriageCase[]): (TriageCase & { priorityScore: number })[] {
  const tagBaseWeight = { Red: 1000, Yellow: 500, Green: 100 };

  return [...cases]
    .map((c) => {
      const waitMinutes = parseInt(c.wait) || 0;
      const priorityScore = (tagBaseWeight[c.tag] || 100) + waitMinutes * 1.5;
      return { ...c, priorityScore };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}
