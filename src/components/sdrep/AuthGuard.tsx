import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Loader2, LogOut, ShieldAlert } from "lucide-react";
import { useAuth, getDefaultRouteForRole, getRoleLabel, type UserRole } from "@/lib/auth-context";

interface AuthGuardProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!isLoading && !user) {
      navigate({
        to: "/login",
        search: { redirect: pathname, unauthorized: "true", from: pathname },
      });
    }
  }, [isLoading, user, pathname, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Verifying operational security credentials…</p>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  // Check role authorization
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    const defaultRoute = getDefaultRouteForRole(user.role);

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-critical/30 bg-surface-2 p-6 text-center shadow-lg">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-critical/10 text-critical">
            <ShieldAlert className="size-6" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-foreground">Access Restricted</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Your current account (<strong>{user.username}</strong> · {getRoleLabel(user.role)}) does not possess permissions to view or operate this dashboard.
          </p>

          <div className="mt-4 rounded-md border border-border bg-surface p-3 text-left text-xs">
            <p className="text-muted-foreground">
              <strong>Required Role(s):</strong> {allowedRoles.map((r) => getRoleLabel(r)).join(", ")}
            </p>
            <p className="mt-1 text-muted-foreground">
              <strong>Your Assigned Role:</strong> {getRoleLabel(user.role)}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              to={defaultRoute}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <span>Go to my portal</span>
              <ArrowRight className="size-3.5" />
            </Link>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate({ to: "/login" });
              }}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface-3"
            >
              <LogOut className="size-3.5" />
              <span>Switch account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
