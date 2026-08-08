import { Link } from "@tanstack/react-router";
import { ShieldAlert, Phone } from "lucide-react";
import { ThemeToggle } from "./theme";
import { StatusPill } from "./primitives";

const links = [
  { to: "/", label: "Home" },
  { to: "/status", label: "Live status" },
  { to: "/evacuate", label: "Evacuation portal" },
  { to: "/about", label: "Preparedness" },
  { to: "/contacts", label: "Contacts" },
];

export function PublicNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <ShieldAlert className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">SDREP</span>
            <span className="label-eyebrow block text-[9px]">Disaster Authority</span>
          </span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeProps={{ className: "bg-surface-2 text-foreground" }}
              activeOptions={{ exact: l.to === "/" }}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <a
            href="tel:112"
            className="hidden items-center gap-2 rounded-md border border-critical/40 bg-critical/10 px-3 py-2 text-sm font-semibold text-critical sm:flex"
          >
            <Phone className="size-4" /> 112
          </a>
          <ThemeToggle />
          <Link
            to="/login"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Operator login
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <p className="text-sm font-semibold">Smart Disaster Rescue &amp; Evacuation Planner</p>
          <p className="mt-2 max-w-sm text-xs text-muted-foreground">
            An integrated situational-awareness and evacuation coordination platform for disaster
            management authorities, rescue services, shelters and hospitals.
          </p>
          <StatusPill tone="success" className="mt-3">
            Public feed operational
          </StatusPill>
        </div>
        <div className="text-xs text-muted-foreground">
          <p className="label-eyebrow">Citizens</p>
          <ul className="mt-2 space-y-1.5">
            <li>
              <Link to="/evacuate" className="hover:text-foreground">
                Find my shelter
              </Link>
            </li>
            <li>
              <Link to="/status" className="hover:text-foreground">
                Live disaster status
              </Link>
            </li>
            <li>
              <Link to="/about" className="hover:text-foreground">
                Preparedness guide
              </Link>
            </li>
          </ul>
        </div>
        <div className="text-xs text-muted-foreground">
          <p className="label-eyebrow">Agencies</p>
          <ul className="mt-2 space-y-1.5">
            <li>
              <Link to="/control" className="hover:text-foreground">
                Control centre
              </Link>
            </li>
            <li>
              <Link to="/portal/rescue" className="hover:text-foreground">
                Rescue team portal
              </Link>
            </li>
            <li>
              <Link to="/portal/hospital" className="hover:text-foreground">
                Hospital portal
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-4 py-4 text-center text-[11px] text-muted-foreground">
        Demonstration interface. Data shown is simulated and must not be used for real emergency
        decisions. In an emergency call 112.
      </div>
    </footer>
  );
}
