import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ChevronLeft,
  CloudRain,
  Menu,
  Radio,
  Search,
  ShieldAlert,
  Signal,
  X,
  LogOut,
  ChevronRight,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusPill } from "./primitives";
import { ThemeToggle } from "./theme";
import { useAuth, getRoleLabel } from "@/lib/auth-context";

export interface PortalTabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeTone?: "critical" | "warning" | "success" | "info";
}

export interface PortalTabGroup {
  label: string;
  items: PortalTabItem[];
}

export function PortalShell({
  portalTitle,
  portalSubtitle,
  icon: PortalIcon,
  groups,
  activeTab,
  onTabChange,
  loginRoute,
  badgeContent,
  children,
}: {
  portalTitle: string;
  portalSubtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  groups: PortalTabGroup[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  loginRoute: string;
  badgeContent?: ReactNode;
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [openMobile, setOpenMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [clock, setClock] = useState("--:--:--");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-GB"));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate({ to: loginRoute });
  };

  // Find active tab info
  const allItems = groups.flatMap((g) => g.items);
  const currentItem = allItems.find((i) => i.id === activeTab) || allItems[0];

  return (
    <div className="flex min-h-dvh w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar transition-[width,transform] duration-200 lg:static lg:translate-x-0",
          collapsed ? "lg:w-16" : "lg:w-64",
          openMobile ? "w-64 translate-x-0" : "w-64 -translate-x-full"
        )}
      >
        {/* Sidebar Brand Header */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-3.5">
          <Link to="/" className="flex min-w-0 items-center gap-2.5 group">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground group-hover:scale-105 transition-transform">
              <PortalIcon className="size-4" />
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <span className="block truncate text-xs font-bold tracking-tight">SDREP CONSOLE</span>
                <span className="label-eyebrow block truncate text-[9px] text-accent">{portalTitle}</span>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setOpenMobile(false)}
            aria-label="Close navigation"
            className="ml-auto grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Portal Identifier Badge */}
        {!collapsed && (
          <div className="border-b border-sidebar-border/60 bg-surface-2/30 px-3.5 py-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="label-eyebrow text-[9px]">ACTIVE OPERATOR</span>
              <span className="size-2 rounded-full bg-success animate-pulse" />
            </div>
            <p className="mt-0.5 truncate font-medium text-foreground text-xs">{user?.fullName || "Verified Operator"}</p>
            <p className="truncate text-[10px] text-muted-foreground font-mono">
              {user?.associatedEntityId ? `ID: ${user.associatedEntityId}` : getRoleLabel(user?.role || "")}
            </p>
          </div>
        )}

        {/* Navigation Groups */}
        <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
          {groups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="label-eyebrow px-2.5 pb-1 text-[9px] text-muted-foreground font-semibold">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onTabChange(item.id);
                          setOpenMobile(false);
                        }}
                        title={item.label}
                        className={cn(
                          "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-all",
                          active
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-xs"
                            : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "h-4 w-0.5 shrink-0 rounded-full transition-colors",
                            active ? "bg-accent" : "bg-transparent"
                          )}
                        />
                        <Icon className={cn("size-4 shrink-0", active ? "text-accent" : "text-muted-foreground group-hover:text-foreground")} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {!collapsed && item.badge && (
                          <span
                            className={cn(
                              "num ml-auto shrink-0 rounded-full px-1.5 py-0.2 text-[9px] font-medium",
                              item.badgeTone === "critical"
                                ? "bg-critical/20 text-critical"
                                : item.badgeTone === "warning"
                                ? "bg-warning/20 text-warning"
                                : item.badgeTone === "success"
                                ? "bg-success/20 text-success"
                                : "bg-surface-3 text-muted-foreground"
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer with Collapse & Sign Out */}
        <div className="shrink-0 border-t border-sidebar-border p-2 space-y-1">
          <button
            type="button"
            onClick={handleLogout}
            title="Sign out of portal"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-muted-foreground hover:bg-critical/15 hover:text-critical transition-colors"
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>

          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="hidden w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground lg:flex"
          >
            <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && <span className="text-[11px]">Collapse sidebar</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {openMobile && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setOpenMobile(false)}
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2.5 border-b border-border bg-surface/90 px-3 backdrop-blur-xl sm:px-4">
          <button
            type="button"
            onClick={() => setOpenMobile(true)}
            aria-label="Open navigation"
            className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground hover:bg-surface-2 lg:hidden"
          >
            <Menu className="size-4" />
          </button>

          {/* Breadcrumb / Title */}
          <div className="flex items-center gap-1.5 min-w-0 text-xs">
            <Link to="/" className="text-muted-foreground hover:text-foreground hidden sm:inline">SDREP</Link>
            <ChevronRight className="size-3 text-muted-foreground hidden sm:inline" />
            <span className="font-semibold text-foreground truncate">{portalTitle}</span>
            <ChevronRight className="size-3 text-muted-foreground" />
            <span className="text-accent font-medium truncate">{currentItem?.label}</span>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="num hidden rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted-foreground sm:block">
              {clock}
            </span>

            <StatusPill tone="critical" pulse className="hidden md:inline-flex">
              RED ALERT
            </StatusPill>

            {badgeContent}

            <ThemeToggle />

            {/* Operator Menu */}
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 py-1 pl-1 pr-2.5">
              <span className="num grid size-7 place-items-center rounded bg-primary text-[11px] font-bold text-primary-foreground">
                {(user?.fullName || user?.username || "OP").slice(0, 2).toUpperCase()}
              </span>
              <div className="hidden leading-tight sm:block min-w-0 max-w-[120px]">
                <span className="block truncate text-xs font-semibold">{user?.fullName || user?.username}</span>
                <span className="label-eyebrow block truncate text-[9px]">{user?.associatedEntityId || user?.role}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                className="ml-1 text-[11px] text-muted-foreground hover:text-critical transition-colors"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Live Operational Ticker */}
        <div className="flex items-center gap-2.5 overflow-hidden border-b border-border alert-gradient px-4 py-1.5 text-[11px]">
          <Radio className="size-3.5 shrink-0 text-critical animate-pulse" />
          <p className="num truncate text-muted-foreground">
            Active: Cyclone Marut · High Alert · Embankment Breach Sector 7 · 5 Relief Camps Open · Emergency Dispatch Channel: Net-1
          </p>
        </div>

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 p-3.5 sm:p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
