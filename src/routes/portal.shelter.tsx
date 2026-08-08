import { createFileRoute } from "@tanstack/react-router";
import { Boxes, HandHeart, Tent, Users } from "lucide-react";
import { Bar, MetricCard, PageHeading, Panel, PanelHeader, StatusPill } from "@/components/sdrep/primitives";

export const Route = createFileRoute("/portal/shelter")({
  head: () => ({
    meta: [
      { title: "Shelter Administrator Portal — SDREP" },
      { name: "description", content: "Manage relief camp occupancy, intake of incoming evacuees, food, water and medical inventory, supply requests and volunteers." },
      { property: "og:title", content: "Shelter Administrator Portal — SDREP" },
      { property: "og:description", content: "Occupancy, inventory and volunteer management for relief camps." },
    ],
  }),
  component: ShelterPortal,
});

const inventory = [
  { item: "Drinking water (L)", stock: 4200, target: 9000 },
  { item: "Ready meals", stock: 1580, target: 3600 },
  { item: "Blankets", stock: 1720, target: 2000 },
  { item: "Medical kits", stock: 46, target: 120 },
  { item: "Sanitation supplies", stock: 310, target: 400 },
];

const volunteers = [
  { name: "R. Nair", role: "Intake desk", shift: "20:00–04:00", tone: "success" as const },
  { name: "P. Sharma", role: "Medical support", shift: "22:00–06:00", tone: "success" as const },
  { name: "J. Fernandes", role: "Kitchen", shift: "unassigned", tone: "warning" as const },
  { name: "A. Khan", role: "Logistics", shift: "16:00–00:00", tone: "info" as const },
];

function ShelterPortal() {
  return (
    <div className="space-y-4">
      <PageHeading
        eyebrow="SH-01 · Municipal Stadium Relief Camp"
        title="Shelter operations"
        description="Camp is at 78% capacity with 220 evacuees expected in the next 90 minutes."
        actions={<button className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"><Boxes className="size-3.5" /> Request supplies</button>}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Occupancy" value="1,876" tone="warning" icon={<Users className="size-4" />} hint="capacity 2,400" />
        <MetricCard label="Incoming" value="220" tone="critical" hint="ETA 40–90 min" />
        <MetricCard label="Beds free" value="524" tone="success" icon={<Tent className="size-4" />} />
        <MetricCard label="Volunteers on shift" value="3/4" tone="info" icon={<HandHeart className="size-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Inventory levels" />
          <ul className="space-y-3.5 p-4">
            {inventory.map((r) => {
              const pct = (r.stock / r.target) * 100;
              return (
                <li key={r.item}>
                  <p className="flex justify-between text-xs"><span>{r.item}</span><span className="num text-muted-foreground">{r.stock.toLocaleString()} / {r.target.toLocaleString()}</span></p>
                  <div className="mt-1.5"><Bar value={pct} tone={pct < 35 ? "critical" : pct < 65 ? "warning" : "success"} /></div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Incoming evacuee batches" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead><tr className="border-b border-border text-left">{["Batch", "From", "Persons", "ETA", "Needs"].map((h) => <th key={h} className="label-eyebrow px-4 py-2 font-normal">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {[
                  ["BT-11", "Sector 7", 84, "18 min", "Medical"],
                  ["BT-12", "Sector 7", 62, "34 min", "Infants"],
                  ["BT-13", "Sector 12", 74, "71 min", "Elderly"],
                ].map((r) => (
                  <tr key={r[0] as string} className="hover:bg-surface-2">
                    <td className="num px-4 py-2.5">{r[0]}</td><td className="px-4 py-2.5">{r[1]}</td>
                    <td className="num px-4 py-2.5">{r[2]}</td><td className="num px-4 py-2.5">{r[3]}</td>
                    <td className="px-4 py-2.5"><StatusPill tone="info">{r[4]}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Volunteer roster" icon={<HandHeart className="size-4" />} />
          <ul className="divide-y divide-border">
            {volunteers.map((v) => (
              <li key={v.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                <div className="min-w-0"><p className="truncate text-sm">{v.name}</p><p className="text-[11px] text-muted-foreground">{v.role}</p></div>
                <StatusPill tone={v.tone}>{v.shift}</StatusPill>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Supply request" />
          <form className="space-y-3 p-4" onSubmit={(e) => e.preventDefault()}>
            <label className="block text-xs text-muted-foreground" htmlFor="sup">Resource</label>
            <select id="sup" className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm">
              {inventory.map((i) => <option key={i.item}>{i.item}</option>)}
            </select>
            <label className="block text-xs text-muted-foreground" htmlFor="qty">Quantity</label>
            <input id="qty" type="number" defaultValue={1000} className="num w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm" />
            <label className="block text-xs text-muted-foreground" htmlFor="urg">Urgency</label>
            <select id="urg" className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm"><option>Critical (&lt; 2 h)</option><option>High (&lt; 6 h)</option><option>Routine</option></select>
            <button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Send to control centre</button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
