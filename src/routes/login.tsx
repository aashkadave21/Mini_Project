import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { StatusPill } from "@/components/sdrep/primitives";
import { ThemeToggle } from "@/components/sdrep/theme";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Operator Sign-in — SDREP Secure Access" },
      { name: "description", content: "Authenticated access for disaster management operators, rescue units, shelter administrators and hospital coordinators." },
      { property: "og:title", content: "Operator Sign-in — SDREP" },
      { property: "og:description", content: "Secure access for emergency response personnel." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden command-gradient p-10 lg:flex">
        <div aria-hidden className="pointer-events-none absolute inset-0 grid-backdrop opacity-50" />
        <div className="relative flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground"><ShieldAlert className="size-4" /></span>
          <span className="text-sm font-semibold">SDREP</span>
        </div>
        <div className="relative">
          <StatusPill tone="critical" pulse>Cyclone Marut · Red alert</StatusPill>
          <h2 className="mt-4 max-w-md text-3xl font-semibold leading-tight">Authorised personnel only. Every action is logged.</h2>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">Sessions are tied to your duty roster and expire after 15 minutes of inactivity.</p>
        </div>
        <p className="relative text-[11px] text-muted-foreground">Demonstration interface · simulated data</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-between">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Public site</Link>
            <ThemeToggle />
          </div>
          <h1 className="text-2xl font-semibold">Operator sign-in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use your agency credentials and hardware token.</p>
          <form className="mt-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div><label htmlFor="id" className="block text-xs text-muted-foreground">Operator ID</label>
              <input id="id" placeholder="OPS-1" className="num mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2.5 text-sm" /></div>
            <div><label htmlFor="pw" className="block text-xs text-muted-foreground">Passphrase</label>
              <input id="pw" type="password" placeholder="••••••••••" className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2.5 text-sm" /></div>
            <div><label htmlFor="otp" className="block text-xs text-muted-foreground">Token code</label>
              <input id="otp" inputMode="numeric" placeholder="000000" className="num mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2.5 text-sm tracking-[0.4em]" /></div>
            <Link to="/control" className="block w-full rounded-md bg-primary px-3 py-2.5 text-center text-sm font-medium text-primary-foreground">Sign in to control centre</Link>
          </form>
          <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
            <Link to="/portal/rescue" className="rounded-md border border-border bg-surface-2 px-3 py-2 text-center hover:bg-surface-3">Rescue portal</Link>
            <Link to="/portal/hospital" className="rounded-md border border-border bg-surface-2 px-3 py-2 text-center hover:bg-surface-3">Hospital portal</Link>
            <Link to="/portal/shelter" className="rounded-md border border-border bg-surface-2 px-3 py-2 text-center hover:bg-surface-3">Shelter portal</Link>
            <Link to="/portal/citizen" className="rounded-md border border-border bg-surface-2 px-3 py-2 text-center hover:bg-surface-3">Citizen portal</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
