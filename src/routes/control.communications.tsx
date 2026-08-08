import { createFileRoute } from "@tanstack/react-router";
import { MessagesSquare, Radio, Send, Signal, WifiOff } from "lucide-react";
import { MetricCard, PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";

export const Route = createFileRoute("/control/communications")({
  head: () => ({
    meta: [
      { title: "Communications — SDREP Control Centre" },
      { name: "description", content: "Radio net status, mass notification broadcast and inter-agency messaging for coordinated disaster response." },
      { property: "og:title", content: "Communications — SDREP" },
      { property: "og:description", content: "Radio nets, broadcasts and inter-agency messaging." },
    ],
  }),
  component: CommsPage,
});

const nets = [
  { id: "NET-1", name: "Command net (VHF)", status: "nominal", load: "42%" },
  { id: "NET-2", name: "Rescue tactical", status: "nominal", load: "67%" },
  { id: "NET-3", name: "Sector 18 mesh", status: "degraded", load: "91%" },
  { id: "NET-4", name: "Dock CCTV backhaul", status: "down", load: "—" },
  { id: "NET-5", name: "Satellite fallback", status: "standby", load: "3%" },
];

const messages = [
  { from: "ALPHA-1", time: "00:41", text: "Embankment breach widening, request pumps and 2 boats." },
  { from: "HSP-2", time: "00:39", text: "ICU at capacity. Divert red-tag casualties to HSP-3." },
  { from: "SH-02", time: "00:36", text: "Shelter full. Turning away arrivals, need reassignment." },
  { from: "OPS-1", time: "00:34", text: "All units: Riverside Arterial closed. Use Ridge Link." },
];

function CommsPage() {
  return (
    <div className="space-y-4">
      <PageHeading
        eyebrow="Coordination"
        title="Communications"
        description="Monitor radio nets, issue mass notifications and maintain the inter-agency message log."
        actions={
          <button className="flex items-center gap-2 rounded-md bg-critical px-3 py-2 text-xs font-medium text-critical-foreground">
            <Radio className="size-3.5" /> Broadcast all-hazards alert
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Nets online" value="4/5" tone="warning" icon={<Signal className="size-4" />} />
        <MetricCard label="Field radios" value="118" tone="success" hint="6 unreachable" />
        <MetricCard label="SMS delivered" value="42,910" tone="info" delta="98.2%" />
        <MetricCard label="Outages" value="1" tone="critical" icon={<WifiOff className="size-4" />} hint="Dock CCTV backhaul" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Panel>
          <PanelHeader title="Radio nets" icon={<Signal className="size-4" />} />
          <ul className="divide-y divide-border">
            {nets.map((n) => (
              <li key={n.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{n.name}</p>
                  <p className="num text-[11px] text-muted-foreground">{n.id} · load {n.load}</p>
                </div>
                <StatusPill tone={n.status === "down" ? "critical" : n.status === "degraded" ? "warning" : n.status === "standby" ? "info" : "success"} pulse={n.status === "degraded"}>
                  {n.status}
                </StatusPill>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="flex flex-col">
          <PanelHeader title="Inter-agency channel" icon={<MessagesSquare className="size-4" />} meta="OPS · secure" />
          <ul className="flex-1 space-y-3 p-4">
            {messages.map((m) => (
              <li key={m.time} className="rounded-lg border border-border bg-surface-2 p-3">
                <p className="num flex justify-between text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{m.from}</span>
                  <span>{m.time}</span>
                </p>
                <p className="mt-1 text-sm">{m.text}</p>
              </li>
            ))}
          </ul>
          <form className="flex items-center gap-2 border-t border-border p-3" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="msg" className="sr-only">Message</label>
            <input
              id="msg"
              placeholder="Message all stations…"
              className="min-w-0 flex-1 rounded-md border border-input bg-surface-2 px-3 py-2 text-sm placeholder:text-muted-foreground"
            />
            <button type="submit" className="flex shrink-0 items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
              <Send className="size-4" /> <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
