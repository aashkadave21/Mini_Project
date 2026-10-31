import { haversineDistance } from "./routing-engine.js";
import type { RoadSegment, RoadNode, HazardZone } from "../types/index.js";

export interface TrafficObservation {
  id: string;
  pos: [number, number];
  intensity: number; // 0 to 100
  speedKmh: number;
  source: "LOOP_DETECTOR" | "CAMERA_AI" | "CONNECTED_FLEET" | "SIMULATED_HOTSPOT";
  timestamp: string;
}

export interface CongestionCluster {
  clusterId: string;
  label: string;
  center: [number, number];
  radiusKm: number;
  observationCount: number;
  meanIntensity: number;
  risk: "HIGH_CONGESTION" | "MODERATE_DELAY" | "STABLE";
  color: string;
}

export interface StagingRecommendation {
  vehicleId?: string;
  recommendedPosition: [number, number];
  sector: string;
  landmark: string;
  targetClusterId: string;
  distanceToClusterKm: number;
  bufferFromHazardsKm: number;
  rationale: string;
}

/**
 * Standard K-Means Clustering on geospatial traffic & risk observations.
 * Time Complexity: O(k * n * iterations)
 */
export function runKMeansClustering(
  observations: TrafficObservation[],
  k = 3,
  maxIterations = 50
): CongestionCluster[] {
  if (observations.length === 0) return [];
  const actualK = Math.min(k, observations.length);

  // Initialize centroids with k spread points
  let centroids: [number, number][] = observations.slice(0, actualK).map((o) => [o.pos[0], o.pos[1]]);

  let assignments = new Array(observations.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // 1. Assign each point to closest centroid
    let changed = false;
    for (let i = 0; i < observations.length; i++) {
      const obs = observations[i]!;
      let minDist = Infinity;
      let bestCluster = 0;

      for (let c = 0; c < actualK; c++) {
        const dist = haversineDistance(obs.pos, centroids[c]!);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = c;
        }
      }

      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }

    if (!changed && iter > 0) break;

    // 2. Recalculate centroids
    for (let c = 0; c < actualK; c++) {
      const clusterPoints = observations.filter((_, idx) => assignments[idx] === c);
      if (clusterPoints.length > 0) {
        const meanLat = clusterPoints.reduce((sum, p) => sum + p.pos[0], 0) / clusterPoints.length;
        const meanLng = clusterPoints.reduce((sum, p) => sum + p.pos[1], 0) / clusterPoints.length;
        centroids[c] = [Number(meanLat.toFixed(5)), Number(meanLng.toFixed(5))];
      }
    }
  }

  // Derive cluster metadata
  const labels = [
    "Riverside Basin Hotspot (Choke Point A)",
    "Port Logistics Corridor (Choke Point B)",
    "Civic Ring Arterial (Choke Point C)",
    "North Bypass Junction (Choke Point D)",
  ];

  return centroids.map((center, cIdx) => {
    const clusterPoints = observations.filter((_, idx) => assignments[idx] === cIdx);
    const meanIntensity = clusterPoints.length > 0
      ? Math.round(clusterPoints.reduce((sum, p) => sum + p.intensity, 0) / clusterPoints.length)
      : 50;

    // Radius covers furthest point or default 0.6km
    let maxDist = 0.5;
    for (const p of clusterPoints) {
      const d = haversineDistance(center, p.pos);
      if (d > maxDist) maxDist = d;
    }

    let risk: CongestionCluster["risk"] = "MODERATE_DELAY";
    let color = "#f59e0b";
    if (meanIntensity >= 70) {
      risk = "HIGH_CONGESTION";
      color = "#ef4444";
    } else if (meanIntensity < 40) {
      risk = "STABLE";
      color = "#22c55e";
    }

    return {
      clusterId: `CLUST-${cIdx + 1}`,
      label: labels[cIdx] || `Zone ${cIdx + 1}`,
      center,
      radiusKm: Number((maxDist + 0.1).toFixed(2)),
      observationCount: clusterPoints.length,
      meanIntensity,
      risk,
      color,
    };
  });
}

/**
 * Derives optimal strategic staging points for idle rescue vehicles
 * outside hazard perimeters but close to high-demand congestion clusters.
 */
export function recommendIdleVehicleStaging(
  clusters: CongestionCluster[],
  hazards: HazardZone[]
): StagingRecommendation[] {
  const stagingPresets: { pos: [number, number]; sector: string; landmark: string }[] = [
    { pos: [19.076, 72.889], sector: "Sector 9 · Civic", landmark: "Civic Centre Ring Staging Depot" },
    { pos: [19.108, 72.878], sector: "Sector 18 · North Ridge", landmark: "North Ridge Bypass Elevated Staging Area" },
    { pos: [19.079, 72.9], sector: "Sector 12 · Old Town", landmark: "Community Hall Logistics Staging Hub" },
  ];

  return stagingPresets.map((preset, idx) => {
    // Find closest cluster
    let closestCluster = clusters[0] || { clusterId: "CLUST-1", center: [19.09, 72.86], label: "Riverside Basin" };
    let minDist = Infinity;
    for (const cl of clusters) {
      const d = haversineDistance(preset.pos, cl.center);
      if (d < minDist) {
        minDist = d;
        closestCluster = cl;
      }
    }

    // Measure hazard buffer
    let minHazardDist = 10;
    for (const hz of hazards) {
      const hzCenter = hz.ring[0] || [0, 0];
      const d = haversineDistance(preset.pos, hzCenter);
      if (d < minHazardDist) minHazardDist = d;
    }

    return {
      recommendedPosition: preset.pos,
      sector: preset.sector,
      landmark: preset.landmark,
      targetClusterId: closestCluster.clusterId,
      distanceToClusterKm: Number(minDist.toFixed(1)),
      bufferFromHazardsKm: Number(minHazardDist.toFixed(1)),
      rationale: `Position outside ${minHazardDist.toFixed(1)} km hazard perimeter. Fast corridor access (~${Math.round((minDist / 40) * 60)} min) to ${closestCluster.label}.`,
    };
  });
}
