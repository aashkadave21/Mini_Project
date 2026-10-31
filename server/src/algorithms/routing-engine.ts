import { MinPriorityQueue } from "./priority-queue.js";
import type { RoadNode, RoadSegment, HazardZone } from "../types/index.js";

export interface CostWeights {
  weightDistance: number;
  weightTime: number;
  weightHazard: number;
}

export const DEFAULT_WEIGHTS: CostWeights = {
  weightDistance: 1.0,
  weightTime: 0.6,
  weightHazard: 2.5,
};

export interface RouteComputationResult {
  success: boolean;
  algorithm: "Dijkstra" | "A*";
  nodePath: string[];
  edgeIds: string[];
  coordinates: [number, number][];
  totalDistanceKm: number;
  estimatedTimeMin: number;
  hazardExposureScore: number;
  exploredNodesCount: number;
  executionTimeMs: number;
  errorMessage?: string;
  congestedSegmentsCount?: number;
  congestedEdgeNames?: string[];
  nominalBaseTimeMin?: number;
  actualEstimatedTimeMin?: number;
}

export interface CongestionRoutingComparison {
  originNodeId: string;
  destinationNodeId: string;
  originLabel: string;
  destinationLabel: string;
  standardRoute: RouteComputationResult & {
    congestedSegmentsCount: number;
    congestedEdgeNames: string[];
    nominalBaseTimeMin: number;
    actualEstimatedTimeMin: number;
  };
  congestionAwareRoute: RouteComputationResult & {
    congestedSegmentsCount: number;
    congestedEdgeNames: string[];
    nominalBaseTimeMin: number;
    actualEstimatedTimeMin: number;
  };
  metrics: {
    timeSavedMinutes: number;
    timeReductionPct: number;
    distanceDeltaKm: number;
    congestedAvoidedCount: number;
    hazardExposureReduction: number;
    summary: string;
  };
}

/**
 * Computes Haversine great-circle distance between two [lat, lng] coordinates in km.
 */
export function haversineDistance(
  [lat1, lon1]: [number, number],
  [lat2, lon2]: [number, number]
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class DisasterRoutingEngine {
  private nodes: Map<string, RoadNode> = new Map();
  private adjacencyList: Map<string, { edge: RoadSegment; neighborNodeId: string }[]> = new Map();
  private hazards: HazardZone[] = [];
  private weights: CostWeights = DEFAULT_WEIGHTS;

  constructor(nodes: RoadNode[] = [], edges: RoadSegment[] = [], hazards: HazardZone[] = [], weights = DEFAULT_WEIGHTS) {
    this.weights = weights;
    this.updateNetwork(nodes, edges, hazards);
  }

  public updateNetwork(nodes: RoadNode[], edges: RoadSegment[], hazards: HazardZone[]): void {
    this.nodes.clear();
    this.adjacencyList.clear();
    this.hazards = hazards;

    for (const node of nodes) {
      this.nodes.set(node.id, node);
      this.adjacencyList.set(node.id, []);
    }

    for (const edge of edges) {
      if (!this.adjacencyList.has(edge.startNode)) {
        this.adjacencyList.set(edge.startNode, []);
      }
      if (!this.adjacencyList.has(edge.endNode)) {
        this.adjacencyList.set(edge.endNode, []);
      }

      // Add bi-directional connectivity for road segments
      this.adjacencyList.get(edge.startNode)!.push({ edge, neighborNodeId: edge.endNode });
      this.adjacencyList.get(edge.endNode)!.push({ edge, neighborNodeId: edge.startNode });
    }
  }

  /**
   * Calculates dynamic cost for an edge based on distance, traffic/congestion,
   * road condition, and hazard exposure.
   * Returns Infinity if the road is closed/blocked to strictly exclude it.
   */
  public calculateEdgeCost(edge: RoadSegment, ignoreCongestion = false): number {
    // 1. Strict exclusion of blocked/closed roads
    if (edge.state === "blocked") {
      return Infinity;
    }

    // 2. Condition multiplier
    let conditionMultiplier = 1.0;
    if (!ignoreCongestion) {
      if (edge.state === "congested") conditionMultiplier = 1.8;
      if (edge.state === "flooded") conditionMultiplier = 3.5;
    }

    // 3. Hazard penalty
    let hazardPenalty = 0;
    if (!ignoreCongestion) {
      for (const hazard of this.hazards) {
        for (const pt of edge.path) {
          // Simple bounding proximity check to hazard center/ring
          const center = hazard.ring[0] || [0, 0];
          const distToHazard = haversineDistance(pt, center);
          if (distToHazard < 1.0) {
            hazardPenalty += hazard.penaltyWeight * (1.0 - distToHazard);
          }
        }
      }
    }

    const distanceCost = edge.distanceKm;
    const timeCost = edge.baseTimeMin * conditionMultiplier;

    return (
      this.weights.weightDistance * distanceCost +
      this.weights.weightTime * timeCost +
      this.weights.weightHazard * hazardPenalty
    );
  }

  /**
   * Dijkstra's Shortest Path Algorithm
   * Guarantee: Finds the mathematically optimal lowest-cost non-negative weighted path.
   * Time Complexity: O((|V| + |E|) log |V|) with MinPriorityQueue binary heap.
   * Space Complexity: O(|V| + |E|)
   */
  public findRouteDijkstra(
    startNodeId: string,
    targetNodeId: string,
    options?: { ignoreCongestion?: boolean }
  ): RouteComputationResult {
    const startTime = performance.now();
    const ignoreCongestion = Boolean(options?.ignoreCongestion);

    if (!this.nodes.has(startNodeId)) {
      return this.failureResult("Dijkstra", `Start node ${startNodeId} not found in graph.`);
    }
    if (!this.nodes.has(targetNodeId)) {
      return this.failureResult("Dijkstra", `Target node ${targetNodeId} not found in graph.`);
    }

    const distances = new Map<string, number>();
    const previous = new Map<string, { nodeId: string; edge: RoadSegment } | null>();
    const pq = new MinPriorityQueue<string>();
    const visited = new Set<string>();

    for (const nodeId of this.nodes.keys()) {
      distances.set(nodeId, Infinity);
      previous.set(nodeId, null);
    }

    distances.set(startNodeId, 0);
    pq.enqueue(startNodeId, 0);

    let exploredCount = 0;

    while (!pq.isEmpty()) {
      const current = pq.dequeue()!;
      if (visited.has(current)) continue;
      visited.add(current);
      exploredCount++;

      if (current === targetNodeId) break;

      const neighbors = this.adjacencyList.get(current) || [];
      for (const { edge, neighborNodeId } of neighbors) {
        if (visited.has(neighborNodeId)) continue;

        const edgeCost = this.calculateEdgeCost(edge, ignoreCongestion);
        if (!isFinite(edgeCost)) continue; // Blocked road: completely excluded

        const newDist = distances.get(current)! + edgeCost;
        if (newDist < distances.get(neighborNodeId)!) {
          distances.set(neighborNodeId, newDist);
          previous.set(neighborNodeId, { nodeId: current, edge });
          pq.enqueue(neighborNodeId, newDist);
        }
      }
    }

    const executionTimeMs = Number((performance.now() - startTime).toFixed(3));

    if (distances.get(targetNodeId) === Infinity) {
      return {
        success: false,
        algorithm: "Dijkstra",
        nodePath: [],
        edgeIds: [],
        coordinates: [],
        totalDistanceKm: 0,
        estimatedTimeMin: 0,
        hazardExposureScore: 0,
        exploredNodesCount: exploredCount,
        executionTimeMs,
        errorMessage: "No safe passable route found. All connecting paths are blocked or flooded.",
      };
    }

    // Reconstruct path
    const nodePath: string[] = [];
    const edgeIds: string[] = [];
    const coordinates: [number, number][] = [];
    const congestedEdgeNames: string[] = [];
    let curr: string | null = targetNodeId;
    let totalDist = 0;
    let nominalBaseTime = 0;
    let actualTimeWithConditions = 0;
    let hazardScore = 0;

    while (curr) {
      nodePath.unshift(curr);
      const prevEntry = previous.get(curr);
      if (!prevEntry) break;

      edgeIds.unshift(prevEntry.edge.id);
      totalDist += prevEntry.edge.distanceKm;
      nominalBaseTime += prevEntry.edge.baseTimeMin;

      let edgeMultiplier = 1.0;
      if (prevEntry.edge.state === "congested") {
        edgeMultiplier = 1.8;
        congestedEdgeNames.unshift(prevEntry.edge.name);
      } else if (prevEntry.edge.state === "flooded") {
        edgeMultiplier = 3.5;
        congestedEdgeNames.unshift(prevEntry.edge.name);
      }
      actualTimeWithConditions += prevEntry.edge.baseTimeMin * edgeMultiplier;

      if (prevEntry.edge.state === "flooded") hazardScore += 1.5;
      for (const hazard of this.hazards) {
        for (const pt of prevEntry.edge.path) {
          const center = hazard.ring[0] || [0, 0];
          const distToHazard = haversineDistance(pt, center);
          if (distToHazard < 1.0) {
            hazardScore += hazard.penaltyWeight * (1.0 - distToHazard);
          }
        }
      }

      for (let i = prevEntry.edge.path.length - 1; i >= 0; i--) {
        coordinates.unshift(prevEntry.edge.path[i]!);
      }
      curr = prevEntry.nodeId;
    }

    return {
      success: true,
      algorithm: "Dijkstra",
      nodePath,
      edgeIds,
      coordinates: coordinates.length > 0 ? coordinates : [this.nodes.get(startNodeId)!.pos, this.nodes.get(targetNodeId)!.pos],
      totalDistanceKm: Number(totalDist.toFixed(2)),
      estimatedTimeMin: Math.round(actualTimeWithConditions * 1.5),
      hazardExposureScore: Number(hazardScore.toFixed(2)),
      exploredNodesCount: exploredCount,
      executionTimeMs,
      congestedSegmentsCount: congestedEdgeNames.length,
      congestedEdgeNames,
      nominalBaseTimeMin: Math.round(nominalBaseTime * 1.5),
      actualEstimatedTimeMin: Math.round(actualTimeWithConditions * 1.5),
    };
  }

  /**
   * A* Search Algorithm
   * Admissible heuristic: h(n) = Euclidean/Haversine distance from node n to target.
   * Since h(n) <= true distance cost, A* is guaranteed to be optimal.
   */
  public findRouteAStar(startNodeId: string, targetNodeId: string): RouteComputationResult {
    const startTime = performance.now();

    if (!this.nodes.has(startNodeId) || !this.nodes.has(targetNodeId)) {
      return this.failureResult("A*", "Start or target node missing.");
    }

    const targetPos = this.nodes.get(targetNodeId)!.pos;
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();
    const previous = new Map<string, { nodeId: string; edge: RoadSegment } | null>();
    const pq = new MinPriorityQueue<string>();
    const closedSet = new Set<string>();

    for (const nodeId of this.nodes.keys()) {
      gScore.set(nodeId, Infinity);
      fScore.set(nodeId, Infinity);
    }

    gScore.set(startNodeId, 0);
    const initialH = haversineDistance(this.nodes.get(startNodeId)!.pos, targetPos);
    fScore.set(startNodeId, initialH);
    pq.enqueue(startNodeId, initialH);

    let exploredCount = 0;

    while (!pq.isEmpty()) {
      const current = pq.dequeue()!;
      if (current === targetNodeId) break;
      if (closedSet.has(current)) continue;
      closedSet.add(current);
      exploredCount++;

      const neighbors = this.adjacencyList.get(current) || [];
      for (const { edge, neighborNodeId } of neighbors) {
        if (closedSet.has(neighborNodeId)) continue;

        const edgeCost = this.calculateEdgeCost(edge);
        if (!isFinite(edgeCost)) continue;

        const tentativeG = gScore.get(current)! + edgeCost;
        if (tentativeG < gScore.get(neighborNodeId)!) {
          previous.set(neighborNodeId, { nodeId: current, edge });
          gScore.set(neighborNodeId, tentativeG);
          const h = haversineDistance(this.nodes.get(neighborNodeId)!.pos, targetPos);
          const f = tentativeG + h * this.weights.weightDistance;
          fScore.set(neighborNodeId, f);
          pq.enqueue(neighborNodeId, f);
        }
      }
    }

    const executionTimeMs = Number((performance.now() - startTime).toFixed(3));

    if (gScore.get(targetNodeId) === Infinity) {
      return {
        success: false,
        algorithm: "A*",
        nodePath: [],
        edgeIds: [],
        coordinates: [],
        totalDistanceKm: 0,
        estimatedTimeMin: 0,
        hazardExposureScore: 0,
        exploredNodesCount: exploredCount,
        executionTimeMs,
        errorMessage: "No route reachable with A* search.",
      };
    }

    // Reconstruct path
    const nodePath: string[] = [];
    const edgeIds: string[] = [];
    const coordinates: [number, number][] = [];
    let curr: string | null = targetNodeId;
    let totalDist = 0;
    let totalTime = 0;
    let hazardScore = 0;

    while (curr) {
      nodePath.unshift(curr);
      const prevEntry = previous.get(curr);
      if (!prevEntry) break;

      edgeIds.unshift(prevEntry.edge.id);
      totalDist += prevEntry.edge.distanceKm;
      totalTime += prevEntry.edge.baseTimeMin;
      if (prevEntry.edge.state === "flooded") hazardScore += 1.5;

      for (let i = prevEntry.edge.path.length - 1; i >= 0; i--) {
        coordinates.unshift(prevEntry.edge.path[i]!);
      }
      curr = prevEntry.nodeId;
    }

    return {
      success: true,
      algorithm: "A*",
      nodePath,
      edgeIds,
      coordinates: coordinates.length > 0 ? coordinates : [this.nodes.get(startNodeId)!.pos, this.nodes.get(targetNodeId)!.pos],
      totalDistanceKm: Number(totalDist.toFixed(2)),
      estimatedTimeMin: Math.round(totalTime * 1.5),
      hazardExposureScore: Number(hazardScore.toFixed(2)),
      exploredNodesCount: exploredCount,
      executionTimeMs,
    };
  }

  public calculateRoute(
    startNodeId: string,
    targetNodeId: string,
    algorithm: "dijkstra" | "astar" = "dijkstra"
  ): RouteComputationResult {
    if (algorithm === "astar") {
      return this.findRouteAStar(startNodeId, targetNodeId);
    }
    return this.findRouteDijkstra(startNodeId, targetNodeId);
  }

  /**
   * Scenario D: Congestion-Aware vs. Standard Routing Comparison
   * Compares standard Dijkstra routing (unaware of dynamic congestion multipliers)
   * with congestion-aware routing incorporating real-time delays and hazard penalties.
   */
  public compareCongestionRouting(startNodeId: string, targetNodeId: string): CongestionRoutingComparison {
    const startNode = this.nodes.get(startNodeId);
    const targetNode = this.nodes.get(targetNodeId);

    const standard = this.findRouteDijkstra(startNodeId, targetNodeId, { ignoreCongestion: true }) as any;
    const congestionAware = this.findRouteDijkstra(startNodeId, targetNodeId, { ignoreCongestion: false }) as any;

    const timeSaved = Math.max(0, standard.estimatedTimeMin - congestionAware.estimatedTimeMin);
    const pctReduction = standard.estimatedTimeMin > 0
      ? Math.round((timeSaved / standard.estimatedTimeMin) * 100)
      : 0;
    const distDelta = Number((congestionAware.totalDistanceKm - standard.totalDistanceKm).toFixed(2));
    const avoidedCount = Math.max(0, (standard.congestedSegmentsCount || 0) - (congestionAware.congestedSegmentsCount || 0));

    let summary = "";
    if (avoidedCount > 0 || timeSaved > 0) {
      summary = `Congestion-aware routing bypassed ${avoidedCount} congested choke point(s), saving estimated ${timeSaved} min (${pctReduction}% time reduction) with a ${distDelta >= 0 ? `+${distDelta} km detour` : `${distDelta} km distance`}.`;
    } else {
      summary = `Current optimal corridor is clear of congestion clusters; standard and congestion-aware routes are identical (${standard.totalDistanceKm} km, ~${standard.estimatedTimeMin} min).`;
    }

    return {
      originNodeId: startNodeId,
      destinationNodeId: targetNodeId,
      originLabel: startNode?.label || startNodeId,
      destinationLabel: targetNode?.label || targetNodeId,
      standardRoute: standard,
      congestionAwareRoute: congestionAware,
      metrics: {
        timeSavedMinutes: timeSaved,
        timeReductionPct: pctReduction,
        distanceDeltaKm: distDelta,
        congestedAvoidedCount: avoidedCount,
        hazardExposureReduction: Number(Math.max(0, standard.hazardExposureScore - congestionAware.hazardExposureScore).toFixed(2)),
        summary,
      },
    };
  }

  private failureResult(algorithm: "Dijkstra" | "A*", message: string): RouteComputationResult {
    return {
      success: false,
      algorithm,
      nodePath: [],
      edgeIds: [],
      coordinates: [],
      totalDistanceKm: 0,
      estimatedTimeMin: 0,
      hazardExposureScore: 0,
      exploredNodesCount: 0,
      executionTimeMs: 0,
      errorMessage: message,
    };
  }

  /**
   * Scenario H: BFS/DFS Reachability and Isolated Component Analysis
   * Finds connected components using passable edges (state !== "blocked").
   * Detects cut-off neighbourhoods, unreachable shelters, and hospitals.
   */
  public analyzeReachabilityBFS(
    shelters: { id: string; name: string; pos: [number, number] }[] = [],
    hospitals: { id: string; name: string; pos: [number, number] }[] = [],
    incidents: { id: string; title: string; pos: [number, number]; severity: string; status: string }[] = []
  ): ReachabilityAnalysisResult {
    const visited = new Set<string>();
    const components: string[][] = [];

    // Helper: find nearest road node to coordinates
    const findNearestNodeId = (pos: [number, number]): string => {
      let nearestId = "";
      let minD = Infinity;
      for (const [id, node] of this.nodes.entries()) {
        const d = haversineDistance(pos, node.pos);
        if (d < minD) {
          minD = d;
          nearestId = id;
        }
      }
      return nearestId;
    };

    // Run BFS on each unvisited node to discover connected components
    for (const startId of this.nodes.keys()) {
      if (visited.has(startId)) continue;

      const component: string[] = [];
      const queue: string[] = [startId];
      visited.add(startId);

      while (queue.length > 0) {
        const current = queue.shift()!;
        component.push(current);

        const neighbors = this.adjacencyList.get(current) || [];
        for (const { edge, neighborNodeId } of neighbors) {
          if (edge.state === "blocked") continue; // Exclude blocked road
          if (!visited.has(neighborNodeId)) {
            visited.add(neighborNodeId);
            queue.push(neighborNodeId);
          }
        }
      }

      components.push(component);
    }

    // Sort components by size descending; largest is the primary network
    components.sort((a, b) => b.length - a.length);

    const primaryComponent = components[0] || [];
    const reachableNodeIds = primaryComponent;
    const primarySet = new Set(primaryComponent);

    const isolatedNodeIds: string[] = [];
    for (const c of components.slice(1)) {
      isolatedNodeIds.push(...c);
    }

    // Check which shelters are isolated
    const isolatedShelters = shelters
      .map((s) => ({ ...s, nearestNodeId: findNearestNodeId(s.pos) }))
      .filter((s) => !primarySet.has(s.nearestNodeId));

    // Check which hospitals are isolated
    const isolatedHospitals = hospitals
      .map((h) => ({ ...h, nearestNodeId: findNearestNodeId(h.pos) }))
      .filter((h) => !primarySet.has(h.nearestNodeId));

    // Check which active incidents are isolated
    const isolatedIncidents = incidents
      .filter((i) => i.status !== "resolved" && i.status !== "cancelled")
      .map((i) => ({ ...i, nearestNodeId: findNearestNodeId(i.pos) }))
      .filter((i) => !primarySet.has(i.nearestNodeId))
      .map((i) => ({ id: i.id, title: i.title, pos: i.pos, severity: i.severity }));

    // Blocked edges count
    let blockedCount = 0;
    const seenEdges = new Set<string>();
    for (const neighbors of this.adjacencyList.values()) {
      for (const { edge } of neighbors) {
        if (!seenEdges.has(edge.id)) {
          seenEdges.add(edge.id);
          if (edge.state === "blocked") blockedCount++;
        }
      }
    }

    // Generate actionable recommendations
    const recommendations: string[] = [];
    if (isolatedNodeIds.length === 0) {
      recommendations.push("Network fully connected: All sectors and emergency facilities are reachable via primary corridors.");
    } else {
      recommendations.push(`Network partitioned into ${components.length} isolated components (${isolatedNodeIds.length} road intersections cut off).`);

      if (isolatedShelters.length > 0) {
        recommendations.push(`CRITICAL: Shelter(s) ${isolatedShelters.map((s) => s.name).join(", ")} cut off from main route network. Divert evacuees to alternative shelters.`);
      }
      if (isolatedHospitals.length > 0) {
        recommendations.push(`ALERT: Hospital(s) ${isolatedHospitals.map((h) => h.name).join(", ")} isolated. Inbound ambulances must be rerouted to operational facilities.`);
      }
      if (isolatedIncidents.length > 0) {
        recommendations.push(`URGENT: ${isolatedIncidents.length} active emergency zone(s) unreachable by standard road transport. Dispatch amphibious NDRF watercraft or Coast Guard air rescue.`);
      }
      recommendations.push("Recommendation: Clear debris on key bridge segments or activate alternate bypass lanes to reconnect severed sectors.");
    }

    const isolatedNodesDetailed = Array.from(this.nodes.values()).map((node) => ({
      id: node.id,
      label: node.label,
      pos: node.pos,
      isolated: !primarySet.has(node.id),
    }));

    return {
      reachableNodeIds,
      isolatedNodeIds,
      isolatedNodes: isolatedNodesDetailed,
      connectedComponents: components,
      isolatedShelters,
      isolatedHospitals,
      isolatedIncidents,
      blockedEdgesCount: blockedCount,
      recommendations,
    };
  }
}

export interface ReachabilityAnalysisResult {
  reachableNodeIds: string[];
  isolatedNodeIds: string[];
  isolatedNodes: { id: string; label: string; pos: [number, number]; isolated: boolean }[];
  connectedComponents: string[][];
  isolatedShelters: { id: string; name: string; pos: [number, number]; nearestNodeId: string }[];
  isolatedHospitals: { id: string; name: string; pos: [number, number]; nearestNodeId: string }[];
  isolatedIncidents: { id: string; title: string; pos: [number, number]; severity: string }[];
  blockedEdgesCount: number;
  recommendations: string[];
}

