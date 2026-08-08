import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
  BarChart3,
  FileText,
  Gauge,
  Hospital,
  Map,
  MessagesSquare,
  Navigation,
  Settings,
  Siren,
  Tent,
} from "lucide-react";
import { ConsoleShell, type NavGroup } from "@/components/sdrep/ConsoleShell";

const groups: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { label: "Dashboard", to: "/control", icon: Gauge },
      { label: "Live map", to: "/control/map", icon: Map },
      { label: "Evacuation", to: "/control/evacuation", icon: Navigation },
      { label: "Rescue operations", to: "/control/rescue", icon: Siren, badge: "6" },
    ],
  },
  {
    label: "Resources",
    items: [
      { label: "Shelters", to: "/control/shelters", icon: Tent },
      { label: "Hospitals", to: "/control/hospitals", icon: Hospital },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Analytics", to: "/control/analytics", icon: BarChart3 },
      { label: "Communications", to: "/control/communications", icon: MessagesSquare },
      { label: "Reports", to: "/control/reports", icon: FileText },
      { label: "Settings", to: "/control/settings", icon: Settings },
    ],
  },
];

export const Route = createFileRoute("/control")({
  component: ControlLayout,
});

function ControlLayout() {
  return (
    <ConsoleShell
      groups={groups}
      workspace="Control Centre"
      operator="A. Rao"
      role="Duty Officer · OPS-1"
    >
      <Outlet />
    </ConsoleShell>
  );
}
