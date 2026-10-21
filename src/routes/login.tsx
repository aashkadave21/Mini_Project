import { useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ShieldAlert, Loader2, AlertCircle, Eye, EyeOff, ShieldCheck, ArrowRight, UserCheck } from "lucide-react";
import { StatusPill } from "@/components/sdrep/primitives";
import { ThemeToggle } from "@/components/sdrep/theme";
import { useAuth, getDefaultRouteForRole, getRoleLabel } from "@/lib/auth-context";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): {
    redirect?: string | undefined;
    unauthorized?: string | undefined;
    from?: string | undefined;
  } => ({
    redirect: (search["redirect"] as string) || undefined,
    unauthorized: (search["unauthorized"] as string) || undefined,
    from: (search["from"] as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Operator Sign-in — SDREP Secure Access" },
      { name: "description", content: "Authenticated access for disaster management operators, rescue units, shelter administrators, hospital coordinators and citizens." },
      { property: "og:title", content: "Operator Sign-in — SDREP" },
      { property: "og:description", content: "Secure role-based access for emergency response personnel." },
    ],
  }),
  component: LoginPage,
});

const DEMO_ACCOUNTS = [
  { role: "CONTROL_CENTRE_ADMIN", username: "OPS-1", name: "Commander S. Deshmukh", portal: "Control Centre", to: "/control" },
  { role: "RESCUE_TEAM", username: "ALPHA-1", name: "Capt. R. Verma", portal: "Rescue Operations", to: "/portal/rescue" },
  { role: "SHELTER_ADMIN", username: "SH-01", name: "Dr. Ananya Kulkarni", portal: "Shelter Management", to: "/portal/shelter" },
  { role: "HOSPITAL_STAFF", username: "HSP-1", name: "Dr. Tariq Sheikh", portal: "Hospital Intake", to: "/portal/hospital" },
  { role: "CITIZEN", username: "citizen", name: "S. Iyer", portal: "Citizen Evacuation", to: "/portal/citizen" },
];

function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const { login } = useAuth();

  const [username, setUsername] = useState("OPS-1");
  const [password, setPassword] = useState("Password123!");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage("Please enter both username/operator ID and passphrase.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const user = await login({
        username: username.trim(),
        password,
      });

      // Redirect user to the destination path or default portal for role
      const targetRoute = search.redirect || getDefaultRouteForRole(user.role);
      navigate({ to: targetRoute });
    } catch (err: any) {
      setErrorMessage(err.message || "Authentication failed. Invalid operator credentials.");
    } finally {
      setLoading(false);
    }
  };

  const selectDemoAccount = (demoUsername: string) => {
    setUsername(demoUsername);
    setPassword("Password123!");
    setErrorMessage(null);
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Tactical Left Panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden command-gradient p-10 lg:flex">
        <div aria-hidden className="pointer-events-none absolute inset-0 grid-backdrop opacity-50" />
        <div className="relative flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <ShieldAlert className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-wide">SDREP COMMAND NETWORK</span>
        </div>

        <div className="relative space-y-4">
          <StatusPill tone="critical" pulse>Active Event · Cyclone Marut · Red Alert</StatusPill>
          <h2 className="max-w-md text-3xl font-semibold leading-tight text-foreground">
            Authorized personnel only. Every operational action is audited.
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Access permissions are strictly governed by agency duty rosters. Select your authorized role or sign in with issued credentials.
          </p>

          <div className="rounded-lg border border-border bg-surface-2/80 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <ShieldCheck className="size-4 text-success" />
              <span>Cryptographic Session Enforcement Active</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Password authentication verified via scrypt key derivation. Real-time authorizations enforced by server-side RBAC middleware.
            </p>
          </div>
        </div>

        <div className="relative text-[11px] text-muted-foreground">
          Sardar Patel Institute of Technology · Department of Computer Engineering
        </div>
      </div>

      {/* Right Interactive Login Panel */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <Link to="/" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              ← Return to public emergency portal
            </Link>
            <ThemeToggle />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in to operational portal</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Authenticate to access your role-specific dashboard, active missions, and operational data.
          </p>

          {/* Unauthorized access alert */}
          {search.unauthorized && (
            <div className="mt-4 flex items-start gap-2.5 rounded-md border border-critical/40 bg-critical/10 p-3 text-xs text-critical">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">Restricted Access Warning</p>
                <p className="mt-0.5 text-critical/90">
                  You attempted to access a protected area ({search.from || "operational dashboard"}) without proper authorization. Please sign in with an account permitted for that portal.
                </p>
              </div>
            </div>
          )}

          {/* Form error alert */}
          {errorMessage && (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-critical/40 bg-critical/10 p-3 text-xs text-critical">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-foreground">
                Username / Operator ID
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. OPS-1, ALPHA-1, SH-01, HSP-1, citizen"
                required
                className="num mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-foreground">
                Passphrase
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 pr-10 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Verifying authorization…" : "Sign in to portal"}
            </button>
          </form>

          {/* Quick Demo Account Shortcuts */}
          <div className="mt-8 border-t border-border pt-6">
            <div className="flex items-center justify-between">
              <span className="label-eyebrow">Demo Account Quick Selection</span>
              <span className="text-[10px] text-muted-foreground">Pass: Password123!</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Click any role to load verified credentials and test its dedicated operational dashboard:
            </p>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((acc) => {
                const isSelected = username === acc.username;
                return (
                  <button
                    key={acc.username}
                    type="button"
                    onClick={() => selectDemoAccount(acc.username)}
                    className={`flex flex-col items-start rounded-md border p-2.5 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary-foreground"
                        : "border-border bg-surface-2 hover:border-muted-foreground/40 hover:bg-surface-3"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="num text-xs font-semibold text-foreground">{acc.username}</span>
                      <span className="text-[10px] text-muted-foreground">{acc.portal}</span>
                    </div>
                    <span className="mt-0.5 truncate text-[11px] text-muted-foreground">{acc.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
