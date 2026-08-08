import { lazy, Suspense, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { TacticalMapProps } from "./TacticalMap";

const TacticalMap = lazy(() => import("./TacticalMap"));

function Fallback({ height }: { height?: string | undefined }) {
  return (
    <div
      className="grid place-items-center rounded-lg border border-border bg-surface-2 grid-backdrop"
      style={{ height: height ?? "100%", width: "100%" }}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Acquiring geospatial feed…
      </div>
    </div>
  );
}

export function MapCanvas(props: TacticalMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <Fallback height={props.height} />;
  return (
    <Suspense fallback={<Fallback height={props.height} />}>
      <TacticalMap {...props} />
    </Suspense>
  );
}
