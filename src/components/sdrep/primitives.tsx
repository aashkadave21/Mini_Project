import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  className,
  children,
  glass,
}: {
  className?: string;
  children: ReactNode;
  glass?: boolean;
}) {
  return (
    <section className={cn(glass ? "glass rounded-lg" : "panel", className)}>{children}</section>
  );
}

export function PanelHeader({
  title,
  meta,
  icon,
  action,
}: {
  title: string;
  meta?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        {icon ? <span className="shrink-0 text-accent">{icon}</span> : null}
        <h2 className="truncate text-sm font-semibold tracking-tight">{title}</h2>
        {meta ? <span className="num shrink-0 text-[11px] text-muted-foreground">{meta}</span> : null}
      </div>
      {action}
    </header>
  );
}

const toneMap = {
  critical: "bg-critical/15 text-critical border-critical/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  success: "bg-success/15 text-success border-success/30",
  info: "bg-info/15 text-info border-info/30",
  neutral: "bg-muted text-muted-foreground border-border",
} as const;

export type Tone = keyof typeof toneMap;

export function StatusPill({
  tone = "neutral",
  children,
  pulse,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        toneMap[tone],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full bg-current", pulse && "animate-pulse-ring")}
      />
      {children}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  unit,
  delta,
  tone = "neutral",
  icon,
  hint,
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  tone?: Tone;
  icon?: ReactNode;
  hint?: string;
}) {
  const accent = {
    critical: "text-critical",
    warning: "text-warning",
    success: "text-success",
    info: "text-info",
    neutral: "text-foreground",
  }[tone];

  return (
    <article className="panel group relative overflow-hidden p-4 transition-colors hover:border-ring/50">
      <div className="flex items-start justify-between gap-3">
        <p className="label-eyebrow">{label}</p>
        {icon ? <span className={cn("shrink-0 opacity-70", accent)}>{icon}</span> : null}
      </div>
      <p className={cn("num mt-3 text-3xl font-semibold", accent)}>
        {value}
        {unit ? <span className="ml-1 text-sm text-muted-foreground">{unit}</span> : null}
      </p>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
        {delta ? <span className="num">{delta}</span> : null}
        {hint ? <span className="truncate">{hint}</span> : null}
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-ring/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
      />
    </article>
  );
}

export function Bar({ value, tone = "info" }: { value: number; tone?: Tone }) {
  const bg = {
    critical: "bg-critical",
    warning: "bg-warning",
    success: "bg-success",
    info: "bg-info",
    neutral: "bg-muted-foreground",
  }[tone];
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-700", bg)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-muted-foreground">
        {icon}
      </span>
      <p className="text-sm font-medium">{title}</p>
      {body ? <p className="max-w-xs text-xs text-muted-foreground">{body}</p> : null}
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="label-eyebrow">{eyebrow}</p> : null}
        <h1 className="mt-1 truncate text-xl font-semibold sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
