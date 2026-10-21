import { DisasterRoutingEngine } from "./routing-engine.js";
import type { RoadNode, RoadSegment } from "../types/index.js";

export interface BenchmarkMetrics {
  vertexCount: number;
  edgeCount: number;
  dijkstraTimeMs: number;
  dijkstraNodesExplored: number;
  aStarTimeMs: number;
  aStarNodesExplored: number;
  distanceKm: number;
  pathsMatch: boolean;
}

/**
 * Generates a synthetic grid-like urban road network of size N x N.
 */
export function generateSyntheticRoadNetwork(gridSize: number): { nodes: RoadNode[]; edges: RoadSegment[] } {
  const nodes: RoadNode[] = [];
  const edges: RoadSegment[] = [];
  const baseLat = 19.05;
  const baseLng = 72.82;
  const step = 0.01;

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const id = `N_${r}_${c}`;
      nodes.push({
        id,
        label: `Intersection (${r}, ${c})`,
        pos: [baseLat + r * step, baseLng + c * step],
      });

      // Horizontal edge
      if (c + 1 < gridSize) {
        const nextId = `N_${r}_${c + 1}`;
        edges.push({
          id: `E_H_${r}_${c}`,
          name: `Avenue ${r}-${c}`,
          startNode: id,
          endNode: nextId,
          state: "clear",
          distanceKm: 1.1,
          baseTimeMin: 2.0,
          path: [
            [baseLat + r * step, baseLng + c * step],
            [baseLat + r * step, baseLng + (c + 1) * step],
          ],
        });
      }

      // Vertical edge
      if (r + 1 < gridSize) {
        const nextId = `N_${r + 1}_${c}`;
        edges.push({
          id: `E_V_${r}_${c}`,
          name: `Cross Street ${r}-${c}`,
          startNode: id,
          endNode: nextId,
          state: "clear",
          distanceKm: 1.1,
          baseTimeMin: 2.0,
          path: [
            [baseLat + r * step, baseLng + c * step],
            [baseLat + (r + 1) * step, baseLng + c * step],
          ],
        });
      }
    }
  }

  return { nodes, edges };
}

export function runRoutingBenchmark(): BenchmarkMetrics[] {
  const gridSizes = [4, 6, 8, 10, 15]; // Corresponding to 16, 36, 64, 100, 225 nodes
  const results: BenchmarkMetrics[] = [];

  for (const size of gridSizes) {
    const { nodes, edges } = generateSyntheticRoadNetwork(size);
    const engine = new DisasterRoutingEngine(nodes, edges);

    const startNode = nodes[0]!.id;
    const endNode = nodes[nodes.length - 1]!.id;

    const dijkstraResult = engine.findRouteDijkstra(startNode, endNode);
    const aStarResult = engine.findRouteAStar(startNode, endNode);

    results.push({
      vertexCount: nodes.length,
      edgeCount: edges.length,
      dijkstraTimeMs: dijkstraResult.executionTimeMs,
      dijkstraNodesExplored: dijkstraResult.exploredNodesCount,
      aStarTimeMs: aStarResult.executionTimeMs,
      aStarNodesExplored: aStarResult.exploredNodesCount,
      distanceKm: dijkstraResult.totalDistanceKm,
      pathsMatch: dijkstraResult.totalDistanceKm === aStarResult.totalDistanceKm,
    });
  }

  return results;
}
