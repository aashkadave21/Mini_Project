import { createFileRoute } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { PublicFooter, PublicNav } from "@/components/sdrep/PublicChrome";
import { PageHeading } from "@/components/sdrep/primitives";
import { emergencyContacts } from "@/lib/sdrep-data";

export const Route = createFileRoute("/contacts")({
  head: () => ({
    meta: [
      { title: "Emergency Contact Directory — SDREP" },
      { name: "description", content: "Verified emergency helpline numbers for fire, medical, police, coast guard, disaster management and vulnerable-person support." },
      { property: "og:title", content: "Emergency Contact Directory — SDREP" },
      { property: "og:description", content: "Verified 24x7 emergency helpline numbers." },
    ],
  }),
  component: ContactsPage,
});

function ContactsPage() {
  return (
    <div className="min-h-dvh">
      <PublicNav />
      <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <PageHeading eyebrow="Directory" title="Emergency contacts" description="All lines operate 24×7. Call 112 if you are unsure which service you need." />
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {emergencyContacts.map((c) => (
            <li key={c.number}>
              <a href={`tel:${c.number}`} className="panel flex items-center gap-4 p-4 transition-colors hover:border-ring/60">
                <span className="num grid size-14 shrink-0 place-items-center rounded-md bg-critical/10 text-lg font-semibold text-critical">{c.number}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">{c.desc}</span>
                </span>
                <Phone className="ml-auto size-4 shrink-0 text-muted-foreground" />
              </a>
            </li>
          ))}
        </ul>
      </main>
      <PublicFooter />
    </div>
  );
}
