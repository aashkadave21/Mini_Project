import { createFileRoute } from "@tanstack/react-router";
import {
  Layers,
  Locate,
  Navigation,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  SlidersHorizontal,
  ArrowRight,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { MapCanvas } from "@/components/sdrep/MapCanvas";
import { Panel, PanelHeader, PageHeading, StatusPill } from "@/components/sdrep/primitives";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/control/map")({
  head: () => ({
    meta: [
      { title: "Live Hazard & Network Map — SDREP Control Centre" },
      { name: "description", content: "Full-screen geospatial view of hazards, dynamic road blocking, reachability BFS analysis, and Dijkstra vs A* route computation." },
      { property: "og:title", content: "Live Hazard & Network Map — SDREP" },
      { property: "og:description", content: "Geospatial situational awareness and topological network reachability." },
    ],
  }),
  component: LiveMapPage,
});

const layerKeys = ["hazards", "roads", "routes", "shelters", "hospitals", "teams", "incidents", "reachability"] as const;

function LiveMapPage() {
  const [on, setOn] = useState<Record<(typeof layerKeys)[number], boolean>>({
    hazards: true,
    roads: true,
    routes: true,
    shelters: true,
    hospitals: true,
    teams: true,
    incidents: true,
    reachability: true,
  });

  const [roads, setRoads] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [shelters, setShelters] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Scenario A: Route Comparison state
  const [startNode, setStartNode] = useState("N_S7");
  const [targetNode, setTargetNode] = useState("N_SH01");
  const [dijkstraResult, setDijkstraResult] = useState<any | null>(null);
  const [aStarResult, setAStarResult] = useState<any | null>(null);
  const [comparingRoutes, setComparingRoutes] = useState(false);

  // Scenario H: Reachability BFS state
  const [reachabilityData, setReachabilityData] = useState<any | null>(null);
  const [analyzingReachability, setAnalyzingReachability] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [corrRes, incRes, shelterRes, hospRes, teamRes] = await Promise.allSettled([
        api.evacuation.getCorridors(),
        api.public.getIncidents(),
        api.shelter.getAll(),
        api.hospital.getAll(),
        api.rescue.getAllTeams(),
      ]);

      if (corrRes.status === "fulfilled" && corrRes.value.data) {
        setRoads(corrRes.value.data.roads || []);
        setRoutes(corrRes.value.data.routes || []);
      }
      if (incRes.status === "fulfilled" && incRes.value.data) setIncidents(incRes.value.data);
      if (shelterRes.status === "fulfilled" && shelterRes.value.data) setShelters(shelterRes.value.data);
      if (hospRes.status === "fulfilled" && hospRes.value.data) setHospitals(hospRes.value.data);
      if (teamRes.status === "fulfilled" && teamRes.value.data) setTeams(teamRes.value.data);
    } catch (err) {
      console.error("Failed to load map network data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Scenario A: Toggle Road Block / Condition
  const handleToggleRoad = async (roadId: string, newState: string) => {
    try {
      const res = await api.evacuation.toggleRoadState(roadId, newState);
      setActionFeedback(res.message);
      await fetchData();
      // If we currently have comparison routes, re-run them to demonstrate re-routing!
      if (dijkstraResult || aStarResult) {
        runRouteComparison();
      }
      setTimeout(() => setActionFeedback(null), 6000);
    } catch (err: any) {
      setActionFeedback(`Error updating road: ${err.message}`);
    }
  };

  // Scenario A: Compare Dijkstra vs A*
  const runRouteComparison = async () => {
    setComparingRoutes(true);
    try {
      const [dijkstra, aStar] = await Promise.all([
        api.evacuation.getRoute(startNode, targetNode, "Dijkstra"),
        api.evacuation.getRoute(startNode, targetNode, "A*"),
      ]);

      setDijkstraResult(dijkstra.data);
      setAStarResult(aStar.data);
    } catch (err: any) {
      setActionFeedback(`Routing error: ${err.message}`);
    } finally {
      setComparingRoutes(false);
    }
  };

  // Scenario H: Run Reachability BFS
  const runReachabilityAnalysis = async () => {
    setAnalyzingReachability(true);
    try {
      const res = await api.evacuation.getReachability();
      setReachabilityData(res.data);
      setOn((prev) => ({ ...prev, reachability: true }));
      setActionFeedback(`Reachability BFS complete: Found ${res.data?.connectedComponents?.length || 1} connected component(s).`);
      setTimeout(() => setActionFeedback(null), 8000);
    } catch (err: any) {
      setActionFeedback(`Reachability analysis error: ${err.message}`);
    } finally {
      setAnalyzingReachability(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeading
        eyebrow="Geospatial & Graph Routing"
        title="Interactive Road Network & Tactical Map"
        description="Manually toggle road blockages, observe dynamic Dijkstra/A* corridor recalculation, and perform BFS reachability analysis for isolated zones."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={runReachabilityAnalysis}
              disabled={analyzingReachability}
              className="flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-medium text-warning hover:bg-warning/20 disabled:opacity-50 transition-colors"
            >
              {analyzingReachability ? <RefreshCw className="size-3.5 animate-spin" /> : <ShieldAlert className="size-3.5" />}
              {analyzingReachability ? "Running BFS Traversal…" : "Run Reachability Analysis (BFS)"}
            </button>
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs hover:bg-surface-3 transition-colors"
            >
              <RefreshCw className="size-3.5" /> Refresh Network
            </button>
          </div>
        }
      />

      {actionFeedback && (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-xs text-primary font-medium">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Scenario H Reachability Analysis Banner (if analyzed) */}
      {reachabilityData && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2 text-warning">
              <ShieldAlert className="size-4" /> Scenario H: Network Reachability & Component Isolation (BFS)
            </h3>
            <span className="text-xs font-mono text-muted-foreground">
              Blocked Roads: {reachabilityData.blockedEdgesCount} · Components: {reachabilityData.connectedComponents?.length}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div className="rounded bg-surface-2 p-2.5">
              <span className="text-muted-foreground">Reachable Intersections</span>
              <p className="text-base font-bold text-success">{reachabilityData.reachableNodeIds?.length}</p>
            </div>
            <div className="rounded bg-surface-2 p-2.5">
              <span className="text-muted-foreground">Isolated Intersections</span>
              <p className={`text-base font-bold ${reachabilityData.isolatedNodeIds?.length > 0 ? "text-critical" : "text-muted-foreground"}`}>
                {reachabilityData.isolatedNodeIds?.length}
              </p>
            </div>
            <div className="rounded bg-surface-2 p-2.5">
              <span className="text-muted-foreground">Cut-Off Shelters</span>
              <p className={`text-base font-bold ${reachabilityData.isolatedShelters?.length > 0 ? "text-critical" : "text-muted-foreground"}`}>
                {reachabilityData.isolatedShelters?.length}
              </p>
            </div>
            <div className="rounded bg-surface-2 p-2.5">
              <span className="text-muted-foreground">Cut-Off Hospitals</span>
              <p className={`text-base font-bold ${reachabilityData.isolatedHospitals?.length > 0 ? "text-critical" : "text-muted-foreground"}`}>
                {reachabilityData.isolatedHospitals?.length}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">Actionable Tactical Recommendations:</p>
            <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
              {reachabilityData.recommendations?.map((rec: string, i: number) => (
                <li key={i} className={rec.includes("CRITICAL") || rec.includes("URGENT") ? "text-critical font-medium" : ""}>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* Left Sidebar: Controls & Road Manipulation */}
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Layer Toggles" icon={<Layers className="size-4" />} />
            <ul className="p-3">
              {layerKeys.map((k) => (
                <li key={k}>
                  <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs capitalize hover:bg-surface-2">
                    {k}
                    <input
                      type="checkbox"
                      checked={on[k]}
                      onChange={() => setOn((p) => ({ ...p, [k]: !p[k] }))}
                      className="size-3.5 accent-[var(--color-primary)]"
                    />
                  </label>
                </li>
              ))}
            </ul>
          </Panel>

          {/* Scenario A: Road Condition Manipulation */}
          <Panel>
            <PanelHeader
              title="Road Status & Control (Scenario A)"
              meta={`${roads.length} segments`}
              icon={<SlidersHorizontal className="size-4" />}
            />
            <div className="p-3 text-[11px] text-muted-foreground border-b border-border bg-surface-2/40">
              Change road state to trigger dynamic Dijkstra route recalculation and graph exclusion.
            </div>
            <ul className="max-h-72 divide-y divide-border overflow-y-auto text-xs">
              {roads.map((r) => (
                <li key={r.id} className="p-3 hover:bg-surface-2 transition-colors space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{r.name}</span>
                    <StatusPill tone={r.state === "blocked" ? "critical" : r.state === "flooded" ? "info" : r.state === "congested" ? "warning" : "success"}>
                      {r.state}
                    </StatusPill>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{r.distanceKm} km · {r.baseTimeMin} min base</span>
                    <div className="flex items-center gap-1">
                      {r.state === "blocked" ? (
                        <button
                          onClick={() => handleToggleRoad(r.id, "clear")}
                          className="rounded bg-success/20 px-2 py-0.5 text-[10px] font-semibold text-success hover:bg-success/30"
                        >
                          Reopen
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleRoad(r.id, "blocked")}
                          className="rounded bg-critical/20 px-2 py-0.5 text-[10px] font-semibold text-critical hover:bg-critical/30"
                        >
                          Block Road
                        </button>
                      )}
                      <select
                        value={r.state}
                        onChange={(e) => handleToggleRoad(r.id, e.target.value)}
                        className="rounded border border-border bg-popover px-1 py-0.5 text-[10px]"
                      >
                        <option value="clear">Clear</option>
                        <option value="congested">Congested</option>
                        <option value="flooded">Flooded</option>
                        <option value="blocked">Blocked</option>
                      </select>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          {/* Scenario A: Algorithm Comparison Sandbox */}
          <Panel>
            <PanelHeader title="Algorithm Comparison (Dijkstra vs A*)" icon={<Zap className="size-4 text-primary" />} />
            <div className="p-3 space-y-2.5 text-xs">
              <div>
                <label className="text-[11px] text-muted-foreground font-medium">Origin Intersection</label>
                <select
                  value={startNode}
                  onChange={(e) => setStartNode(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-surface-2 p-1.5 text-xs"
                >
                  <option value="N_S7">N_S7 · Sector 7 Riverside</option>
                  <option value="N_S3">N_S3 · Sector 3 Port Entrance</option>
                  <option value="N_S12">N_S12 · Sector 12 Market</option>
                  <option value="N_CIVIC">N_CIVIC · Civic Centre Ring</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground font-medium">Destination Node</label>
                <select
                  value={targetNode}
                  onChange={(e) => setTargetNode(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-surface-2 p-1.5 text-xs"
                >
                  <option value="N_SH01">N_SH01 · Municipal Stadium Relief Camp</option>
                  <option value="N_SH04">N_SH04 · North Ridge Complex</option>
                  <option value="N_SH03">N_SH03 · Community Hall Sector 12</option>
                </select>
              </div>

              <button
                onClick={runRouteComparison}
                disabled={comparingRoutes}
                className="w-full rounded bg-primary py-1.5 font-medium text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {comparingRoutes ? <RefreshCw className="size-3 animate-spin" /> : <Navigation className="size-3" />}
                {comparingRoutes ? "Computing Both Paths…" : "Run Side-by-Side Comparison"}
              </button>

              {dijkstraResult && aStarResult && (
                <div className="mt-2 space-y-2 border-t border-border pt-2 text-[11px]">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-left">
                        <th className="py-1">Metric</th>
                        <th className="py-1 font-semibold text-primary">Dijkstra</th>
                        <th className="py-1 font-semibold text-success">A*</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <td className="py-1 text-muted-foreground">Distance</td>
                        <td className="py-1 font-mono">{dijkstraResult.totalDistanceKm} km</td>
                        <td className="py-1 font-mono">{aStarResult.totalDistanceKm} km</td>
                      </tr>
                      <tr>
                        <td className="py-1 text-muted-foreground">Est. Time</td>
                        <td className="py-1 font-mono">{dijkstraResult.estimatedTimeMin} min</td>
                        <td className="py-1 font-mono">{aStarResult.estimatedTimeMin} min</td>
                      </tr>
                      <tr>
                        <td className="py-1 text-muted-foreground">Hazard Score</td>
                        <td className="py-1 font-mono">{dijkstraResult.hazardExposureScore}</td>
                        <td className="py-1 font-mono">{aStarResult.hazardExposureScore}</td>
                      </tr>
                      <tr className="bg-surface-2/40">
                        <td className="py-1 font-medium">Nodes Explored</td>
                        <td className="py-1 font-mono font-bold text-primary">{dijkstraResult.exploredNodesCount}</td>
                        <td className="py-1 font-mono font-bold text-success">{aStarResult.exploredNodesCount}</td>
                      </tr>
                      <tr>
                        <td className="py-1 text-muted-foreground">Compute Time</td>
                        <td className="py-1 font-mono">{dijkstraResult.executionTimeMs} ms</td>
                        <td className="py-1 font-mono">{aStarResult.executionTimeMs} ms</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-[10px] text-muted-foreground italic">
                    A* achieves optimal path while exploring fewer nodes due to Euclidean distance heuristic guidance.
                  </p>
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* Right Main Panel: Live Interactive Map */}
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Operational Theatre Map"
            meta={`${roads.filter((r) => r.state === "blocked").length} roads blocked · ${routes.length} corridors live`}
          />
          <div className="p-2">
            <MapCanvas
              height="clamp(460px, 72vh, 850px)"
              layers={on}
              zoom={13}
              incidents={incidents}
              roads={roads}
              routes={routes}
              shelters={shelters}
              hospitals={hospitals}
              teams={teams}
              isolatedNodes={reachabilityData?.isolatedNodes}
              highlightRoute={aStarResult?.coordinates}
              comparisonRoute={dijkstraResult?.coordinates}
              onRoadClick={(road) => {
                const nextState = road.state === "blocked" ? "clear" : "blocked";
                handleToggleRoad(road.id, nextState);
              }}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}
