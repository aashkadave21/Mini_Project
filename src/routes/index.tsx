import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, Hospital, Radio, ShieldAlert, Siren, User } from "lucide-react";
import { PublicFooter, PublicNav } from "@/components/sdrep/PublicChrome";
import { MapCanvas } from "@/components/sdrep/MapCanvas";
import { Panel, StatusPill } from "@/components/sdrep/primitives";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SDREP — Smart Disaster Rescue & Evacuation Planner" },
      { name: "description", content: "Government-grade disaster command platform: live hazard mapping, evacuation routing, rescue dispatch, shelter and hospital coordination." },
      { property: "og:title", content: "SDREP — Smart Disaster Rescue & Evacuation Planner" },
      { property: "og:description", content: "Situational awareness and evacuation coordination for emergency operations centres." },
    ],
  }),
  component: Landing,
});

const portals = [
  { to: "/portal/citizen", icon: User, title: "Citizen portal", desc: "Alerts, assigned shelter, live route, SOS and family tracking." },
  { to: "/portal/rescue", icon: Siren, title: "Rescue team portal", desc: "Missions, victim queue, navigation, equipment and reporting." },
  { to: "/portal/shelter", icon: Building2, title: "Shelter administrator", desc: "Occupancy, intake, inventory, supply requests and volunteers." },
  { to: "/portal/hospital", icon: Hospital, title: "Hospital portal", desc: "Casualty intake, triage, bed and ICU capacity, blood stock." },
] as const;

function Landing() {
  const [stats, setStats] = useState({
    evacuated: "9,350",
    incidents: "6",
    meanResponse: "9.8 min",
  });

  useEffect(() => {
    api.public
      .getStatistics()
      .then((res) => {
        if (res.data) {
          setStats({
            evacuated: res.data.peopleEvacuated?.toLocaleString() || "9,350",
            incidents: String(res.data.activeIncidents || 6),
            meanResponse: `${res.data.avgResponseMinutes || 9.8} min`,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-dvh">
      <PublicNav />

      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="pointer-events-none absolute inset-0 grid-backdrop opacity-40" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:py-24">
          <div className="animate-rise">
            <StatusPill tone="critical" pulse>Active event · Cyclone Marut · Red alert</StatusPill>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">
              Coordinate every rescue from a single command surface.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground">
              SDREP fuses hazard telemetry, road conditions, shelter capacity and medical surge data
              into one operating picture — so responders decide in seconds, not minutes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/control" className="flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
                Enter control centre <ArrowRight className="size-4" />
              </Link>
              <Link to="/evacuate" className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-5 py-3 text-sm font-medium transition-colors hover:bg-surface-3">
                I need to evacuate
              </Link>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-6">
              {[
                [stats.evacuated, "Evacuated"],
                [stats.incidents, "Active incidents"],
                [stats.meanResponse, "Mean response"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="label-eyebrow">{l}</dt>
                  <dd className="num mt-1 text-2xl font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <Panel className="overflow-hidden" glass>
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="label-eyebrow">Live operational picture</span>
              <StatusPill tone="success">Feed online</StatusPill>
            </div>
            <div className="p-2">
              <MapCanvas height="clamp(320px, 42vh, 460px)" />
            </div>
          </Panel>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <p className="label-eyebrow">Role-based access</p>
        <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">One platform, four field portals</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {portals.map((p) => (
            <Link key={p.to} to={p.to} className="panel group p-5 transition-colors hover:border-ring/60">
              <span className="grid size-10 place-items-center rounded-md bg-surface-2 text-accent">
                <p.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{p.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{p.desc}</p>
              <span className="mt-4 flex items-center gap-1 text-xs text-accent">
                Open <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-3">
          {[
            { icon: ShieldAlert, t: "Hazard-aware routing", d: "Corridors recompute automatically when a road floods, collapses or saturates with traffic." },
            { icon: Radio, t: "Resilient communications", d: "Radio nets, mesh fallbacks and mass notification with delivery accounting." },
            { icon: Hospital, t: "Medical surge visibility", d: "Bed, ICU and blood-bank pressure surfaced next to every casualty decision." },
          ].map((f) => (
            <div key={f.t}>
              <f.icon className="size-5 text-accent" />
              <h3 className="mt-3 text-base font-semibold">{f.t}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
