import { createFileRoute } from "@tanstack/react-router";
import { PageHeading, Panel, PanelHeader } from "@/components/sdrep/primitives";
import { ThemeToggle } from "@/components/sdrep/theme";

export const Route = createFileRoute("/control/settings")({
  head: () => ({
    meta: [
      { title: "Console Settings — SDREP Control Centre" },
      { name: "description", content: "Configure alert thresholds, accessibility preferences, map defaults and operator display options." },
      { property: "og:title", content: "Console Settings — SDREP" },
      { property: "og:description", content: "Operator preferences and alert thresholds." },
    ],
  }),
  component: SettingsPage,
});

function Row({ label, hint, control }: { label: string; hint: string; control: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </li>
  );
}

function Toggle({ defaultOn }: { defaultOn?: boolean }) {
  return (
    <input
      type="checkbox"
      defaultChecked={defaultOn}
      className="size-5 accent-[var(--color-primary)]"
      aria-label="toggle setting"
    />
  );
}

function SettingsPage() {
  return (
    <div className="space-y-4">
      <PageHeading eyebrow="Console" title="Settings" description="Operator-level preferences. Changes apply to this workstation only." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Appearance & accessibility" />
          <ul className="divide-y divide-border">
            <Row label="Theme" hint="Dark is recommended for low-light operations rooms." control={<ThemeToggle />} />
            <Row label="Reduced motion" hint="Disables pulsing indicators and route animations." control={<Toggle />} />
            <Row label="Colourblind-safe alerts" hint="Adds shape and text coding to every severity colour." control={<Toggle defaultOn />} />
            <Row label="High contrast text" hint="Increases foreground contrast to WCAG AAA where possible." control={<Toggle />} />
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Alerting thresholds" />
          <ul className="divide-y divide-border">
            <Row label="Shelter near-full warning" hint="Raise a warning above this occupancy." control={<span className="num text-sm">75%</span>} />
            <Row label="Response time breach" hint="Escalate when mean response exceeds target." control={<span className="num text-sm">8.0 min</span>} />
            <Row label="Flood level escalation" hint="Auto-reroute corridors above this depth." control={<span className="num text-sm">1.8 m</span>} />
            <Row label="Audible critical alarm" hint="Plays a tone for new critical incidents." control={<Toggle defaultOn />} />
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Map defaults" />
          <ul className="divide-y divide-border">
            <Row label="Default zoom" hint="Zoom level on console start-up." control={<span className="num text-sm">13</span>} />
            <Row label="Auto-follow priority incident" hint="Recenters on the highest-severity incident." control={<Toggle defaultOn />} />
            <Row label="Cluster asset markers" hint="Groups nearby units above 40 markers." control={<Toggle defaultOn />} />
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Session" />
          <ul className="divide-y divide-border">
            <Row label="Operator" hint="A. Rao · Duty Officer OPS-1" control={<span className="num text-xs text-muted-foreground">Shift 21:00–05:00</span>} />
            <Row label="Offline cache" hint="Keeps the last known map tiles and roster." control={<Toggle defaultOn />} />
            <Row label="Auto sign-out" hint="Locks the console after inactivity." control={<span className="num text-sm">15 min</span>} />
          </ul>
        </Panel>
      </div>
    </div>
  );
}
