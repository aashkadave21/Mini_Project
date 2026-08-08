import { createFileRoute, Outlet } from "@tanstack/react-router";
import { HeartPulse, Hospital, Siren, Tent, User } from "lucide-react";
import { ConsoleShell, type NavGroup } from "@/components/sdrep/ConsoleShell";

const groups: NavGroup[] = [
  {
    label: "Portals",
    items: [
      { label: "Citizen", to: "/portal/citizen", icon: User },
      { label: "Rescue team", to: "/portal/rescue", icon: Siren },
      { label: "Shelter admin", to: "/portal/shelter", icon: Tent },
      { label: "Hospital", to: "/portal/hospital", icon: Hospital },
    ],
  },
  { label: "Reference", items: [{ label: "Preparedness", to: "/about", icon: HeartPulse }] },
];

export const Route = createFileRoute("/portal")({ component: PortalLayout });

function PortalLayout() {
  return (
    <ConsoleShell groups={groups} workspace="Field Portals" operator="S. Iyer" role="Field User">
      <Outlet />
    </ConsoleShell>
  );
}
