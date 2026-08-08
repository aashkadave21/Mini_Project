import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText } from "lucide-react";
import { PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";
import { dispatchLog } from "@/lib/sdrep-data";

export const Route = createFileRoute("/control/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Audit — SDREP Control Centre" },
      { name: "description", content: "Generate situation reports, after-action summaries and export the immutable operational audit log." },
      { property: "og:title", content: "Reports & Audit — SDREP" },
      { property: "og:description", content: "Situation reports and operational audit trail." },
    ],
  }),
  component: ReportsPage,
});

const reports = [
  { id: "SITREP-014", name: "Situation report — 00:00 cycle", state: "ready", size: "1.2 MB" },
  { id: "SITREP-013", name: "Situation report — 22:00 cycle", state: "ready", size: "1.1 MB" },
  { id: "AAR-002", name: "After-action review — Port fire", state: "drafting", size: "—" },
  { id: "RES-007", name: "Resource consumption ledger", state: "ready", size: "480 KB" },
  { id: "CAS-003", name: "Casualty & triage summary", state: "restricted", size: "260 KB" },
];

function ReportsPage() {
  return (
    <div className="space-y-4">
      <PageHeading
        eyebrow="Records"
        title="Reports & audit trail"
        description="Scheduled situation reports and a tamper-evident log of every operational action."
        actions={
          <button className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
            <FileText className="size-3.5" /> Generate SITREP
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Report library" />
          <ul className="divide-y divide-border">
            {reports.map((r) => (
              <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{r.name}</p>
                  <p className="num text-[11px] text-muted-foreground">{r.id} · {r.size}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill tone={r.state === "ready" ? "success" : r.state === "drafting" ? "warning" : "critical"}>{r.state}</StatusPill>
                  <button aria-label={`Download ${r.id}`} disabled={r.state !== "ready"} className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground disabled:opacity-40 hover:text-foreground">
                    <Download className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Audit log" meta="append-only" />
          <ul className="divide-y divide-border text-xs">
            {dispatchLog.map((d) => (
              <li key={d.time} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
                <span className="num text-muted-foreground">{d.time}</span>
                <span className="truncate">{d.action}</span>
                <span className="num text-[10px] text-muted-foreground">{d.actor}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
