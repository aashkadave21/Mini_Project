import { haversineDistance } from "./routing-engine.js";
import type { RescueTeam, Incident, Shelter, SupplyRequest, TriageCase } from "../types/index.js";

export interface AllocationDecision {
  missionId: string;
  incidentId: string;
  assignedTeamId: string;
  teamCallsign: string;
  score: number;
  rationale: string;
}

/**
 * Deterministic multi-factor greedy rescue team allocation.
 * Inputs: Incidents requiring rescue, Available rescue teams.
 * Time Complexity: O(|Incidents| * |Teams| log |Teams|)
 */
export function allocateRescueTeams(
  incidents: Incident[],
  teams: RescueTeam[]
): AllocationDecision[] {
  const availableTeams = teams.filter((t) => t.status === "available" && t.fuel >= 20);
  const unassignedIncidents = incidents.filter(
    (i) => i.status === "unassigned" || i.status === "dispatched"
  );

  const decisions: AllocationDecision[] = [];
  const assignedTeamIds = new Set<string>();

  // Sort incidents by urgency: critical (100) > warning (50) > info (10)
  const severityRank = { critical: 100, warning: 50, info: 10, success: 0 };
  const sortedIncidents = [...unassignedIncidents].sort(
    (a, b) => severityRank[b.severity] + b.victims - (severityRank[a.severity] + a.victims)
  );

  for (const inc of sortedIncidents) {
    let bestTeam: RescueTeam | null = null;
    let bestScore = -Infinity;
    let bestDist = Infinity;

    for (const team of availableTeams) {
      if (assignedTeamIds.has(team.id)) continue;

      const distKm = haversineDistance(team.pos, inc.pos);
      // Mission feasibility: team must have fuel for round-trip (assume 1% fuel = 2km)
      const maxRangeKm = team.fuel * 2;
      if (distKm * 2 > maxRangeKm) continue;

      // Scoring function:
      // High severity + more victims + higher team members - distance penalty + fuel margin
      const score =
        severityRank[inc.severity] * 2 +
        inc.victims * 1.5 -
        distKm * 4.0 +
        team.members * 3.0 +
        team.fuel * 0.5;

      if (score > bestScore || (score === bestScore && team.id < (bestTeam?.id ?? ""))) {
        bestScore = score;
        bestTeam = team;
        bestDist = distKm;
      }
    }

    if (bestTeam) {
      assignedTeamIds.add(bestTeam.id);
      decisions.push({
        missionId: `MIS-${inc.id}`,
        incidentId: inc.id,
        assignedTeamId: bestTeam.id,
        teamCallsign: bestTeam.callsign,
        score: Number(bestScore.toFixed(2)),
        rationale: `Selected ${bestTeam.callsign} (${bestTeam.unit}) with ${bestTeam.members} responders, ${bestTeam.fuel}% fuel at ${bestDist.toFixed(1)} km for ${inc.severity.toUpperCase()} incident with ${inc.victims} casualties.`,
      });
    }
  }

  return decisions;
}

/**
 * Deterministic supply rationing algorithm.
 * Distributes available warehouse stock fairly across shelter requests without exceeding stock.
 */
export function rationSupplies(
  requests: SupplyRequest[],
  availableStock: number
): { requestId: string; allocated: number; remainingStock: number; status: "FULFILLED" | "PARTIAL" | "DEFERRED" }[] {
  const urgencyWeight = { "Critical (< 2 h)": 3, "High (< 6 h)": 2, Routine: 1 };

  // Sort requests deterministically: urgency DESC, then createdAt ASC
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
      // Partial fulfillment
      const allocated = currentStock;
      currentStock = 0;
      results.push({ requestId: req.id, allocated, remainingStock: 0, status: "PARTIAL" as const });
    }
  }

  return results;
}

/**
 * Clinical triage prioritization with starvation avoidance.
 * Score = Clinical Urgency Base + (Wait Minutes * 1.5)
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
