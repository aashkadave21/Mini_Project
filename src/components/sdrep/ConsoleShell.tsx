import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  ChevronLeft,
  CloudRain,
  Command,
  Menu,
  Radio,
  Search,
  ShieldAlert,
  Signal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusPill } from "./primitives";
import { ThemeToggle } from "./theme";

export interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export function ConsoleShell({
  groups,
  workspace,
  operator,
  role,
  children,
}: {
  groups: NavGroup[];
  workspace: string;
  operator: string;
  role: string;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [clock, setClock] = useState("--:--:--");

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-GB"));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-dvh w-full bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar transition-[width,transform] duration-200 lg:static lg:translate-x-0",
          collapsed ? "lg:w-16" : "lg:w-60",
          open ? "w-64 translate-x-0" : "w-64 -translate-x-full",
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-3">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <ShieldAlert className="size-4" />
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">SDREP</span>
                <span className="label-eyebrow block truncate text-[9px]">{workspace}</span>
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="ml-auto grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
          {groups.map((group) => (
            <div key={group.label}>
              {!collapsed && <p className="label-eyebrow px-2 pb-1.5">{group.label}</p>}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.to;
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        title={item.label}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "h-5 w-0.5 shrink-0 rounded-full transition-colors",
                            active ? "bg-accent" : "bg-transparent",
                          )}
                        />
                        <Icon className="size-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {!collapsed && item.badge ? (
                          <span className="num ml-auto shrink-0 rounded-full bg-critical/20 px-1.5 text-[10px] text-critical">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-sidebar-border p-2">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="hidden w-full items-center gap-2 rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground lg:flex"
          >
            <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>

      {open ? (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface/85 px-3 backdrop-blur-xl sm:px-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground lg:hidden"
          >
            <Menu className="size-4" />
          </button>

          <StatusPill tone="critical" pulse className="shrink-0">
            RED ALERT
          </StatusPill>

          <div className="ml-1 hidden min-w-0 items-center gap-4 text-xs text-muted-foreground xl:flex">
            <span className="flex items-center gap-1.5">
              <CloudRain className="size-3.5 text-info" />
              <span className="num">88 mm/h</span> · Wind 46 km/h
            </span>
            <span className="flex items-center gap-1.5">
              <Signal className="size-3.5 text-warning" />
              Mesh <span className="num">92%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Activity className="size-3.5 text-success" />
              Systems nominal
            </span>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="hidden items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-3 md:flex"
            >
              <Search className="size-3.5" />
              Search operations
              <kbd className="num ml-4 flex items-center gap-0.5 rounded border border-border px-1 text-[10px]">
                <Command className="size-2.5" />K
              </kbd>
            </button>
            <span className="num hidden rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs text-muted-foreground sm:block">
              {clock}
            </span>
            <button
              type="button"
              aria-label="Notifications"
              className="relative grid size-9 place-items-center rounded-md border border-border bg-surface-2 text-muted-foreground hover:text-foreground"
            >
              <Bell className="size-4" />
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-critical" />
            </button>
            <ThemeToggle />
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 py-1 pl-1 pr-2">
              <span className="num grid size-7 place-items-center rounded bg-primary text-[11px] font-semibold text-primary-foreground">
                {operator.slice(0, 2).toUpperCase()}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-xs font-medium">{operator}</span>
                <span className="label-eyebrow block text-[9px]">{role}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("sdrep_token");
                  localStorage.removeItem("sdrep_user");
                  window.location.href = "/login";
                }}
                title="Sign out"
                className="ml-1 text-[10px] text-muted-foreground hover:text-critical"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <div className="flex items-center gap-3 overflow-hidden border-b border-border alert-gradient px-4 py-1.5 text-[11px]">
          <Radio className="size-3.5 shrink-0 text-critical" />
          <p className="num truncate text-muted-foreground">
            00:41 — Sector 7 embankment breach escalated · 00:38 Route A recomputed · 00:35 SH-02
            marked FULL · 00:28 Sector 18 mesh degraded
          </p>
        </div>

        <main className="min-w-0 flex-1 p-3 sm:p-4 lg:p-5">{children}</main>
      </div>
    </div>
  );
}
