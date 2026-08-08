import { createFileRoute } from "@tanstack/react-router";
import { PublicFooter, PublicNav } from "@/components/sdrep/PublicChrome";
import { Panel, PanelHeader, PageHeading } from "@/components/sdrep/primitives";
import { preparednessGuides } from "@/lib/sdrep-data";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "Disaster Preparedness Guide — SDREP" },
      { name: "description", content: "What to do before, during and after an evacuation: go-bag contents, safety rules and shelter registration guidance." },
      { property: "og:title", content: "Disaster Preparedness Guide — SDREP" },
      { property: "og:description", content: "Practical preparedness guidance for citizens in disaster-prone areas." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-dvh">
      <PublicNav />
      <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <PageHeading eyebrow="Preparedness" title="Be ready before the siren" description="Three minutes of preparation today saves hours of confusion during an evacuation." />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {preparednessGuides.map((g) => (
            <Panel key={g.title}>
              <PanelHeader title={g.title} />
              <ul className="space-y-3 p-4 text-sm text-muted-foreground">
                {g.points.map((p) => (
                  <li key={p} className="flex gap-2"><span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />{p}</li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
