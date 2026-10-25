import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ShieldAlert, Loader2, AlertTriangle, ArrowRight, LogOut, ArrowLeft } from "lucide-react";
import { useAuth, getRoleLabel, getDefaultRouteForRole, type UserRole } from "@/lib/auth-context";
import { StatusPill } from "./primitives";

export function RoleGuard({
  allowedRoles,
  loginRoute,
  portalTitle,
  children,
}: {
  allowedRoles: UserRole[];
  loginRoute: string;
  portalTitle: string;
  children: ReactNode;
}) {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate({
        to: loginRoute,
        search: { redirect: window.location.pathname },
      });
    }
  }, [isLoading, user, loginRoute, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background p-4 text-center">
        <div className="grid size-12 place-items-center rounded-xl border border-border bg-surface-2 text-primary">
          <Loader2 className="size-6 animate-spin" />
        </div>
        <p className="text-sm font-medium text-foreground">Verifying operational credentials…</p>
        <p className="text-xs text-muted-foreground">Enforcing cryptographic session tokens & server-side RBAC.</p>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  const isAuthorized = allowedRoles.includes(user.role) || user.role === "CONTROL_CENTRE_ADMIN";

  if (!isAuthorized) {
    const userRoleLabel = getRoleLabel(user.role);
    const requiredRoleLabels = allowedRoles.map(getRoleLabel).join(" or ");

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg rounded-xl border border-critical/40 bg-surface p-8 shadow-2xl">
          <div className="flex items-center gap-3 text-critical">
            <span className="grid size-10 place-items-center rounded-lg bg-critical/15">
              <ShieldAlert className="size-6" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Restricted Operational Portal</h2>
              <p className="text-xs text-muted-foreground">Least-privilege security policy enforced</p>
            </div>
          </div>

          <div className="mt-6 space-y-3 rounded-lg border border-border bg-surface-2 p-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Active Session:</span>
              <span className="font-semibold text-foreground">{user.fullName} ({user.username})</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Your Role:</span>
              <StatusPill tone="warning">{userRoleLabel}</StatusPill>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2">
              <span className="text-muted-foreground">Required Authorization:</span>
              <span className="font-medium text-critical">{requiredRoleLabels}</span>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
            You do not have the required role privileges to access the <strong>{portalTitle}</strong>. In accordance with emergency operations protocols, cross-role portal browsing is restricted to prevent unauthorized task execution.
          </p>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <button
              onClick={() => {
                logout().then(() => {
                  navigate({ to: loginRoute });
                });
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <LogOut className="size-3.5" /> Switch to Authorized Account
            </button>
            <button
              onClick={() => {
                navigate({ to: getDefaultRouteForRole(user.role) });
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-surface-2 py-2.5 text-xs font-medium text-foreground hover:bg-surface-3"
            >
              <ArrowLeft className="size-3.5" /> Return to My Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
