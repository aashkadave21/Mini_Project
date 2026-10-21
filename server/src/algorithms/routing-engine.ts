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
  public calculateEdgeCost(edge: RoadSegment): number {
    // 1. Strict exclusion of blocked/closed roads
    if (edge.state === "blocked") {
      return Infinity;
    }

    // 2. Condition multiplier
    let conditionMultiplier = 1.0;
    if (edge.state === "congested") conditionMultiplier = 1.8;
    if (edge.state === "flooded") conditionMultiplier = 3.5;

    // 3. Hazard penalty
    let hazardPenalty = 0;
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
  public findRouteDijkstra(startNodeId: string, targetNodeId: string): RouteComputationResult {
    const startTime = performance.now();

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

        const edgeCost = this.calculateEdgeCost(edge);
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
      algorithm: "Dijkstra",
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
}
