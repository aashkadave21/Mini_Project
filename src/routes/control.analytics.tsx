import { createFileRoute } from "@tanstack/react-router";
import {
  Area, AreaChart, Bar as RBar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { MetricCard, PageHeading, Panel, PanelHeader } from "@/components/sdrep/primitives";
import { congestionTrend, evacuationProgress, resourceConsumption, responseTimes } from "@/lib/sdrep-data";

export const Route = createFileRoute("/control/analytics")({
  head: () => ({
    meta: [
      { title: "Operational Analytics — SDREP Control Centre" },
      { name: "description", content: "Trend analysis for congestion, evacuation throughput, response latency and resource consumption during the incident." },
      { property: "og:title", content: "Operational Analytics — SDREP" },
      { property: "og:description", content: "Decision-support analytics for disaster operations." },
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
  return (
    <div className="space-y-4">
      <PageHeading eyebrow="Intelligence" title="Operational analytics" description="Six-hour rolling window across mobility, evacuation, response and logistics indicators." />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Evacuation rate" value="1,240" unit="/h" tone="success" delta="+18%" />
        <MetricCard label="Network congestion" value="61" unit="%" tone="warning" delta="-21" hint="peak 82%" />
        <MetricCard label="Mean response" value="9.8" unit="min" tone="warning" />
        <MetricCard label="Fuel consumed" value="42" unit="%" tone="info" hint="of reserve" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Congestion vs throughput" meta="%" />
          <div className="h-64 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={congestionTrend}>
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
          <PanelHeader title="Evacuated vs pending" meta="persons" />
          <div className="h-64 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evacuationProgress}>
                <CartesianGrid stroke="var(--color-grid-line)" vertical={false} />
                <XAxis dataKey="t" {...axis} /><YAxis {...axis} width={40} />
                <Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="evacuated" stackId="1" stroke="var(--color-success)" fill="var(--color-success)" fillOpacity={0.35} />
                <Area type="monotone" dataKey="pending" stackId="1" stroke="var(--color-critical)" fill="var(--color-critical)" fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Response latency by sector" meta="minutes" />
          <div className="h-64 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={responseTimes}>
                <CartesianGrid stroke="var(--color-grid-line)" vertical={false} />
                <XAxis dataKey="sector" {...axis} /><YAxis {...axis} width={28} />
                <Tooltip contentStyle={tooltipStyle} />
                <RBar dataKey="minutes" radius={[4, 4, 0, 0]} fill="var(--color-primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Resource consumption" meta="% of reserve" />
          <div className="h-64 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resourceConsumption}>
                <CartesianGrid stroke="var(--color-grid-line)" vertical={false} />
                <XAxis dataKey="t" {...axis} /><YAxis {...axis} width={28} />
                <Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 11 }} />
                <RBar dataKey="water" stackId="a" fill="var(--color-info)" />
                <RBar dataKey="food" stackId="a" fill="var(--color-success)" />
                <RBar dataKey="fuel" stackId="a" fill="var(--color-warning)" />
                <RBar dataKey="medical" stackId="a" fill="var(--color-critical)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}
