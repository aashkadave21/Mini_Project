import { createFileRoute } from "@tanstack/react-router";
import {
  Area, AreaChart, Bar as RBar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useState, useEffect } from "react";
import {
  Cpu,
  Flame,
  Radio,
  Zap,
  Activity,
  Layers,
  MapPin,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { MetricCard, PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/control/analytics")({
  head: () => ({
    meta: [
      { title: "Operational Analytics & Algorithm Evaluation — SDREP Control Centre" },
      { name: "description", content: "K-Means congestion clustering, idle vehicle staging, and dynamic performance benchmarking under increasing emergency loads." },
      { property: "og:title", content: "Operational Analytics & Algorithm Evaluation — SDREP" },
      { property: "og:description", content: "Decision-support analytics, clustering, and dynamic performance metrics." },
    ],
  }),
  component: AnalyticsPage,
});

const axis = { stroke: "var(--color-muted-foreground)", fontSize: 10, tickLine: false, axisLine: false };
const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--color-popover-foreground)",
};

function AnalyticsPage() {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Scenario D: Congestion Clustering state
  const [kClusters, setKClusters] = useState(3);
  const [clusteringData, setClusteringData] = useState<any | null>(null);
  const [runningClustering, setRunningClustering] = useState(false);

  // Scenario D: Congestion Routing Comparison state
  const [congestionOrigin, setCongestionOrigin] = useState("N_S7");
  const [congestionDestination, setCongestionDestination] = useState("N_SH01");
  const [congestionCompData, setCongestionCompData] = useState<any | null>(null);
  const [loadingCongestionComp, setLoadingCongestionComp] = useState(false);

  // Scenario I: Dynamic Benchmark Runner state
  const [benchLoad, setBenchLoad] = useState(50);
  const [benchResult, setBenchResult] = useState<any | null>(null);
  const [runningBenchmark, setRunningBenchmark] = useState(false);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await api.analytics.getOverview();
        if (res.data) setOverview(res.data);
      } catch (err) {
        console.error("Failed to load analytics overview:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
    runClustering(3);
    runCongestionComparison("N_S7", "N_SH01");
  }, []);

  // Scenario D: Run K-Means Clustering
  const runClustering = async (k = kClusters) => {
    setRunningClustering(true);
    try {
      const res = await api.analytics.getCongestionClusters(k);
      setClusteringData(res.data);
    } catch (err) {
      console.warn("Clustering error:", err);
    } finally {
      setRunningClustering(false);
    }
  };

  // Scenario D: Run Congestion Routing Comparison
  const runCongestionComparison = async (origin = congestionOrigin, destination = congestionDestination) => {
    setLoadingCongestionComp(true);
    try {
      const res = await api.evacuation.compareCongestion(origin, destination);
      if (res.data) setCongestionCompData(res.data);
    } catch (err) {
      console.warn("Congestion comparison error:", err);
    } finally {
      setLoadingCongestionComp(false);
    }
  };

  // Scenario I: Run Dynamic Performance Benchmark
  const runDynamicBenchmark = async (count = benchLoad) => {
    setRunningBenchmark(true);
    try {
      const res = await api.analytics.runDynamicBenchmark({ requestCount: count, gridSize: 8 });
      setBenchResult(res.data);
    } catch (err) {
      console.warn("Benchmark error:", err);
    } finally {
      setRunningBenchmark(false);
    }
  };

  const trendData = overview?.congestionTrend || [
    { t: "18:00", congestion: 14, throughput: 85 },
    { t: "19:00", congestion: 20, throughput: 80 },
    { t: "20:00", congestion: 38, throughput: 68 },
    { t: "21:00", congestion: 48, throughput: 55 },
    { t: "22:00", congestion: 55, throughput: 48 },
    { t: "23:00", congestion: 60, throughput: 42 },
    { t: "Now", congestion: 61, throughput: 39 },
  ];

  const progressData = overview?.evacuationProgress || [
    { t: "18:00", evacuated: 450, pending: 3600 },
    { t: "19:00", evacuated: 980, pending: 3100 },
    { t: "20:00", evacuated: 1540, pending: 2540 },
    { t: "21:00", evacuated: 2200, pending: 1880 },
    { t: "22:00", evacuated: 2750, pending: 1330 },
    { t: "23:00", evacuated: 3200, pending: 910 },
    { t: "Now", evacuated: 3500, pending: 650 },
  ];

  return (
    <div className="space-y-4">
      <PageHeading
        eyebrow="Intelligence & Evaluation"
        title="Operational Analytics & Performance Benchmarks"
        description="K-Means congestion clustering, idle vehicle staging recommendations, and dynamic algorithm stress-testing under increasing emergency workloads."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => runClustering(kClusters)}
              disabled={runningClustering}
              className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              {runningClustering ? <RefreshCw className="size-3.5 animate-spin" /> : <Flame className="size-3.5" />}
              {runningClustering ? "Clustering…" : "Run K-Means Clustering (Scenario D)"}
            </button>
            <button
              onClick={() => runDynamicBenchmark(benchLoad)}
              disabled={runningBenchmark}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {runningBenchmark ? <RefreshCw className="size-3.5 animate-spin" /> : <Cpu className="size-3.5" />}
              {runningBenchmark ? "Benchmarking…" : "Run Dynamic Benchmark (Scenario I)"}
            </button>
          </div>
        }
      />

      {/* Metric strip */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Network congestion" value={overview?.roadSummary?.congested || "61"} unit="%" tone="warning" hint="from live road telemetry" />
        <MetricCard label="Total sheltered" value={overview?.shelterSummary?.totalOccupancy?.toLocaleString() || "3,589"} tone="success" delta={`${overview?.shelterSummary?.loadPercent || 68}%`} />
        <MetricCard label="Active clusters" value={clusteringData?.clusters?.length || 3} tone="info" hint="K-Means choke points" />
        <MetricCard label="Benchmark Throughput" value={benchResult ? `${benchResult.throughputReqSec}` : "142"} unit="req/s" tone="success" />
      </div>

      {/* Scenario D: K-Means Congestion Clustering & Strategic Staging Section */}
      <Panel>
        <PanelHeader
          title="Scenario D: K-Means Congestion Clustering & Proactive Idle Vehicle Staging"
          meta={`K = ${clusteringData?.k || 3} · ${clusteringData?.observationCount || 12} observations`}
          icon={<Flame className="size-4 text-warning" />}
          action={
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Cluster Count (k):</span>
              {[2, 3, 4].map((kVal) => (
                <button
                  key={kVal}
                  onClick={() => {
                    setKClusters(kVal);
                    runClustering(kVal);
                  }}
                  className={`rounded px-2.5 py-1 text-xs font-semibold ${
                    kClusters === kVal
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-2 text-muted-foreground hover:bg-surface-3"
                  }`}
                >
                  k = {kVal}
                </button>
              ))}
            </div>
          }
        />
        <div className="p-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            The K-Means clustering algorithm partitions multi-source geospatial traffic observations (speed detectors, road states, incident density) into high-risk congestion choke points. Proactive staging positions idle rescue vehicles outside hazard zones for rapid response.
          </p>

          {/* Cluster Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clusteringData?.clusters?.map((c: any) => (
              <div key={c.clusterId} className="rounded-lg border border-border bg-surface-2 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm" style={{ color: c.color }}>{c.label}</span>
                  <StatusPill tone={c.risk === "HIGH_CONGESTION" ? "critical" : c.risk === "MODERATE_DELAY" ? "warning" : "success"}>
                    {c.risk.replace("_", " ")}
                  </StatusPill>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <span>Centroid: [{c.center?.[0]}, {c.center?.[1]}]</span>
                  <span>Radius: {c.radiusKm} km</span>
                  <span>Intensity: {c.meanIntensity}/100</span>
                  <span>Sensors: {c.observationCount}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Proactive Staging Recommendations */}
          <div className="border-t border-border pt-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MapPin className="size-3.5 text-primary" /> Recommended Idle Vehicle Staging Positions:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {clusteringData?.stagingRecommendations?.map((st: any, idx: number) => (
                <div key={idx} className="rounded border border-primary/30 bg-primary/5 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{st.landmark}</span>
                    <span className="text-[10px] font-mono text-primary font-bold">Depot #{idx + 1}</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">{st.sector}</p>
                  <p className="text-foreground text-[11px]">{st.rationale}</p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-primary/20">
                    <span>Hazard Buffer: {st.bufferFromHazardsKm} km</span>
                    <span>To Cluster: {st.distanceToClusterKm} km</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scenario D: Congestion-Aware vs. Standard Routing Comparison */}
          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="size-3.5 text-primary" /> Congestion-Aware vs. Standard Routing Comparison (Scenario D)
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Compares standard congestion-blind Dijkstra shortest-path against SDREP congestion-aware routing incorporating real-time speed, flood, and bottleneck penalties.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={congestionOrigin}
                  onChange={(e) => {
                    setCongestionOrigin(e.target.value);
                    runCongestionComparison(e.target.value, congestionDestination);
                  }}
                  className="rounded border border-border bg-surface-2 px-2 py-1 text-xs"
                >
                  <option value="N_S7">N_S7 · Sector 7 Riverside</option>
                  <option value="N_CIVIC">N_CIVIC · Civic Centre Ring</option>
                  <option value="N_S3">N_S3 · Sector 3 Port Entrance</option>
                  <option value="N_S12">N_S12 · Sector 12 Market</option>
                </select>
                <span className="text-xs text-muted-foreground">→</span>
                <select
                  value={congestionDestination}
                  onChange={(e) => {
                    setCongestionDestination(e.target.value);
                    runCongestionComparison(congestionOrigin, e.target.value);
                  }}
                  className="rounded border border-border bg-surface-2 px-2 py-1 text-xs"
                >
                  <option value="N_SH01">N_SH01 · Municipal Stadium Relief Camp</option>
                  <option value="N_SH04">N_SH04 · North Ridge Complex</option>
                  <option value="N_SH03">N_SH03 · Community Hall Gate</option>
                </select>
                <button
                  type="button"
                  onClick={() => runCongestionComparison(congestionOrigin, congestionDestination)}
                  disabled={loadingCongestionComp}
                  className="rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {loadingCongestionComp ? "Evaluating…" : "Re-evaluate"}
                </button>
              </div>
            </div>

            {congestionCompData && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Standard Route Card */}
                  <div className="rounded border border-border bg-surface-2 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">Standard Routing (Congestion-Blind)</span>
                      <StatusPill tone={congestionCompData.standardRoute?.congestedSegmentsCount > 0 ? "critical" : "info"}>
                        {congestionCompData.standardRoute?.congestedSegmentsCount > 0 ? "Traverses Choke Points" : "Nominal Shortest"}
                      </StatusPill>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Follows shortest path assuming nominal speeds, disregarding active congestion delays and flood penalties.
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-border pt-2">
                      <div>
                        <span className="text-muted-foreground">Route Distance:</span>
                        <p className="font-mono font-bold text-foreground">{congestionCompData.standardRoute?.totalDistanceKm} km</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Actual Delayed Travel Time:</span>
                        <p className="font-mono font-bold text-critical">{congestionCompData.standardRoute?.actualEstimatedTimeMin} min</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Nominal (Uncongested):</span>
                        <p className="font-mono text-muted-foreground">{congestionCompData.standardRoute?.nominalBaseTimeMin} min</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Hazard Penalty Score:</span>
                        <p className="font-mono text-warning font-semibold">{congestionCompData.standardRoute?.hazardExposureScore}</p>
                      </div>
                    </div>
                    {congestionCompData.standardRoute?.congestedEdgeNames?.length > 0 && (
                      <div className="text-[10px] text-critical bg-critical/10 p-1.5 rounded">
                        Traversed Choke Points: {congestionCompData.standardRoute.congestedEdgeNames.join(", ")}
                      </div>
                    )}
                  </div>

                  {/* Congestion-Aware Route Card */}
                  <div className="rounded border border-primary/40 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-primary">Congestion-Aware Routing (SDREP Engine)</span>
                      <StatusPill tone="success">
                        Dynamic Penalties Active
                      </StatusPill>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Incorporates real-time speed degradation, flood penalties (3.5x), and hazard proximity to bypass bottlenecks.
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-primary/20 pt-2">
                      <div>
                        <span className="text-muted-foreground">Route Distance:</span>
                        <p className="font-mono font-bold text-foreground">{congestionCompData.congestionAwareRoute?.totalDistanceKm} km</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Actual Travel Time:</span>
                        <p className="font-mono font-bold text-success">{congestionCompData.congestionAwareRoute?.actualEstimatedTimeMin} min</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Congested Choke Points:</span>
                        <p className="font-mono text-success font-semibold">{congestionCompData.congestionAwareRoute?.congestedSegmentsCount} traversed</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Hazard Penalty Score:</span>
                        <p className="font-mono text-success font-semibold">{congestionCompData.congestionAwareRoute?.hazardExposureScore}</p>
                      </div>
                    </div>
                    {congestionCompData.congestionAwareRoute?.congestedEdgeNames?.length > 0 ? (
                      <div className="text-[10px] text-warning bg-warning/10 p-1.5 rounded">
                        Required Traversals: {congestionCompData.congestionAwareRoute.congestedEdgeNames.join(", ")}
                      </div>
                    ) : (
                      <div className="text-[10px] text-success bg-success/10 p-1.5 rounded font-medium">
                        ✓ All clustered bottlenecks successfully bypassed via safe alternate corridors.
                      </div>
                    )}
                  </div>
                </div>

                {/* Efficiency Summary Banner */}
                <div className="rounded border border-border bg-surface-2 p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-foreground">Operational Efficiency:</span>
                    <span className="text-success font-mono font-bold">
                      {congestionCompData.metrics?.timeSavedMinutes > 0 ? `-${congestionCompData.metrics.timeSavedMinutes} min (${congestionCompData.metrics.timeReductionPct}% faster)` : "Optimal Path Match"}
                    </span>
                    <span className="text-muted-foreground font-mono">
                      Detour: {congestionCompData.metrics?.distanceDeltaKm >= 0 ? `+${congestionCompData.metrics.distanceDeltaKm} km` : `${congestionCompData.metrics?.distanceDeltaKm} km`}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground italic">
                    {congestionCompData.metrics?.summary}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Panel>

      {/* Scenario I: Dynamic Performance Benchmark Section */}
      <Panel>
        <PanelHeader
          title="Scenario I: Dynamic Performance Benchmark under Scaled Emergency Load"
          meta="Stress test: 10, 50, 100+ simultaneous requests"
          icon={<Cpu className="size-4 text-primary" />}
          action={
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Simultaneous Requests:</span>
              {[10, 50, 100].map((cnt) => (
                <button
                  key={cnt}
                  onClick={() => {
                    setBenchLoad(cnt);
                    runDynamicBenchmark(cnt);
                  }}
                  className={`rounded px-2.5 py-1 text-xs font-semibold ${
                    benchLoad === cnt
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-2 text-muted-foreground hover:bg-surface-3"
                  }`}
                >
                  {cnt} Reqs
                </button>
              ))}
            </div>
          }
        />
        <div className="p-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Measures algorithmic scaling across the entire pipeline: <strong>Priority Queue Min-Heap ranking</strong>, <strong>Greedy vehicle capability allocation</strong>, and <strong>A* Shortest-Path routing</strong> under heavy simultaneous emergency loads.
          </p>

          {runningBenchmark ? (
            <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <RefreshCw className="size-4 animate-spin" /> Executing dynamic load stress test for {benchLoad} requests…
            </div>
          ) : benchResult ? (
            <div className="space-y-4">
              {/* Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                <div className="rounded bg-surface-2 p-2.5">
                  <span className="text-muted-foreground text-[11px]">Total Time</span>
                  <p className="text-base font-bold text-foreground font-mono">{benchResult.totalExecutionTimeMs} ms</p>
                </div>
                <div className="rounded bg-surface-2 p-2.5">
                  <span className="text-muted-foreground text-[11px]">Throughput</span>
                  <p className="text-base font-bold text-success font-mono">{benchResult.throughputReqSec} req/s</p>
                </div>
                <div className="rounded bg-surface-2 p-2.5">
                  <span className="text-muted-foreground text-[11px]">Avg / p95 Latency</span>
                  <p className="text-base font-bold text-primary font-mono">{benchResult.avgResponseTimeMs} / {benchResult.p95ResponseTimeMs} ms</p>
                </div>
                <div className="rounded bg-surface-2 p-2.5">
                  <span className="text-muted-foreground text-[11px]">Fleet Utilization</span>
                  <p className="text-base font-bold text-warning font-mono">{benchResult.vehicleUtilizationPct}%</p>
                </div>
                <div className="rounded bg-surface-2 p-2.5">
                  <span className="text-muted-foreground text-[11px]">Heap Delta</span>
                  <p className="text-base font-bold text-foreground font-mono">{benchResult.memoryUsedMb} MB</p>
                </div>
                <div className="rounded bg-surface-2 p-2.5">
                  <span className="text-muted-foreground text-[11px]">Unassigned Queue</span>
                  <p className={`text-base font-bold font-mono ${benchResult.queuedIncidentsUnassigned > 0 ? "text-critical" : "text-success"}`}>
                    {benchResult.queuedIncidentsUnassigned}
                  </p>
                </div>
              </div>

              {/* Breakdown by Algorithm Phase */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded border border-border bg-surface-2 p-3">
                  <div className="flex justify-between font-semibold">
                    <span>Priority Queue Heap</span>
                    <span className="font-mono text-primary">{benchResult.priorityQueueSortTimeMs} ms</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Min-heap insertion & starvation aging computation for {benchResult.requestCount} items.
                  </p>
                </div>

                <div className="rounded border border-border bg-surface-2 p-3">
                  <div className="flex justify-between font-semibold">
                    <span>Greedy Fleet Allocation</span>
                    <span className="font-mono text-primary">{benchResult.allocationDecisionTimeMs} ms</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Capability filtering, distance scoring, and assignment decisions across {benchResult.vehicleFleetSize} units.
                  </p>
                </div>

                <div className="rounded border border-border bg-surface-2 p-3">
                  <div className="flex justify-between font-semibold">
                    <span>A* Routing Engine</span>
                    <span className="font-mono text-primary">{benchResult.routingComputeTimeMs} ms</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Multi-target shortest path generation on {benchResult.vertexCount}-node graph.
                  </p>
                </div>
              </div>

              {/* Degradation Chart */}
              {benchResult.loadSteps && (
                <div className="rounded border border-border bg-surface-2/60 p-3">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Response Latency Degradation Curve (10 → 50 → {benchResult.requestCount} requests)
                  </span>
                  <div className="h-44 mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={benchResult.loadSteps}>
                        <CartesianGrid stroke="var(--color-grid-line)" vertical={false} />
                        <XAxis dataKey="loadLevel" {...axis} unit=" reqs" />
                        <YAxis {...axis} width={32} unit=" ms" />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Line type="monotone" dataKey="avgTimeMs" name="Avg Latency (ms)" stroke="var(--color-primary)" strokeWidth={2} dot />
                        <Line type="monotone" dataKey="p95TimeMs" name="p95 Latency (ms)" stroke="var(--color-warning)" strokeWidth={2} dot />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Bottleneck Identification */}
              {benchResult.bottlenecks?.length > 0 && (
                <div className="rounded border border-critical/30 bg-critical/5 p-3 text-xs space-y-1">
                  <p className="font-semibold text-critical flex items-center gap-1.5">
                    <AlertTriangle className="size-4" /> Algorithmic Bottleneck Analysis:
                  </p>
                  <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                    {benchResult.bottlenecks.map((b: string, i: number) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Click &quot;Run Dynamic Benchmark&quot; to test performance under selected emergency request load.
            </p>
          )}
        </div>
      </Panel>

      {/* Existing Trends */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Congestion vs Throughput Trend" meta="%" />
          <div className="h-64 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid stroke="var(--color-grid-line)" vertical={false} />
                <XAxis dataKey="t" {...axis} /><YAxis {...axis} width={28} />
                <Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="congestion" stroke="var(--color-warning)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="throughput" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Evacuation Progress" meta="persons" />
          <div className="h-64 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={progressData}>
                <CartesianGrid stroke="var(--color-grid-line)" vertical={false} />
                <XAxis dataKey="t" {...axis} /><YAxis {...axis} width={40} />
                <Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="evacuated" stackId="1" stroke="var(--color-success)" fill="var(--color-success)" fillOpacity={0.35} />
                <Area type="monotone" dataKey="pending" stackId="1" stroke="var(--color-critical)" fill="var(--color-critical)" fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}
