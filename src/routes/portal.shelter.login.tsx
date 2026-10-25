import { useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ShieldAlert,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Building2,
  Tent,
  Boxes,
  Users,
  ArrowRight,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { StatusPill } from "@/components/sdrep/primitives";
import { ThemeToggle } from "@/components/sdrep/theme";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/portal/shelter/login")({
  validateSearch: (search: Record<string, unknown>): {
    redirect?: string;
    unauthorized?: string;
  } => ({
    redirect: (search["redirect"] as string) || undefined,
    unauthorized: (search["unauthorized"] as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Shelter Administration Login — SDREP Relief Management" },
      { name: "description", content: "Administrative login for relief camps, municipal shelter managers, evacuee intake coordinators and logistics officers." },
    ],
  }),
  component: ShelterLoginPage,
});

function ShelterLoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/portal/shelter/login" });
  const { login } = useAuth();

  const [username, setUsername] = useState("SH-01");
  const [password, setPassword] = useState("Password123!");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotInput, setForgotInput] = useState("");
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage("Please enter your registered Shelter ID or administrator email.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const user = await login({
        username: username.trim(),
        password,
        expectedRole: "SHELTER_ADMIN",
        rememberMe,
      });

      if (user.role !== "SHELTER_ADMIN" && user.role !== "CONTROL_CENTRE_ADMIN") {
        setErrorMessage(`Account role is '${user.role}'. Shelter management requires administrator authorization.`);
        return;
      }

      const dest = search.redirect || "/portal/shelter";
      navigate({ to: dest });
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid credentials or unauthorized shelter operator ID.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotInput.trim()) return;
    try {
      const res = await api.auth.forgotPassword({ identifier: forgotInput.trim(), portal: "SHELTER" });
      setForgotMessage(res.message);
    } catch (err: any) {
      setForgotMessage(err.message || "Failed to submit recovery request.");
    }
  };

  const loadDemoShelter = () => {
    setUsername("SH-01");
    setPassword("Password123!");
    setErrorMessage(null);
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Tactical Left Panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden command-gradient p-10 lg:flex">
        <div aria-hidden className="pointer-events-none absolute inset-0 grid-backdrop opacity-45" />

        <div className="relative flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <ShieldAlert className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-wide">SDREP RELIEF NETWORK</span>
          </Link>
          <StatusPill tone="warning" pulse>Relief Camp Protocol Active</StatusPill>
        </div>

        <div className="relative space-y-6">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <Building2 className="size-5" />
              <span className="label-eyebrow text-primary">CAMP ADMINISTRATION CONSOLE</span>
            </div>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-foreground">
              Capacity oversight, evacuee registration, supply logistics, and volunteer management.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Coordinates relief operations across 5 designated regional camps, monitoring bed occupancy, ration consumption, sanitation standards, and incoming evacuee transfers.
            </p>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-surface-2/80 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span className="flex items-center gap-2">
                <Tent className="size-4 text-warning" /> Sphere Humanitarian Standards
              </span>
              <StatusPill tone="info">Capacity Rules Enforced</StatusPill>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Overbooking prevention active. System automatically recalculates inventory consumption (water 15L/person, rations 2.2kg/person) upon intake registration.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md border border-border bg-surface-2/60 p-3">
              <span className="label-eyebrow">District Network</span>
              <p className="mt-1 font-medium text-foreground">5 Relief Camps</p>
              <p className="text-[10px] text-muted-foreground">5,960 total bed capacity</p>
            </div>
            <div className="rounded-md border border-border bg-surface-2/60 p-3">
              <span className="label-eyebrow">Municipal Stadium (SH-01)</span>
              <p className="mt-1 font-medium text-warning">1,876 Occupied (78%)</p>
              <p className="text-[10px] text-muted-foreground">524 free beds remaining</p>
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-between text-[11px] text-muted-foreground">
          <span>District Disaster Management Authority (DDMA)</span>
          <span className="flex items-center gap-1 font-mono text-[10px]">
            <ShieldCheck className="size-3 text-success" /> ACID Transactions Active
          </span>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <Link to="/" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              ← Return to public homepage
            </Link>
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary">
              <Building2 className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Shelter Administration Login</h1>
              <p className="text-xs text-muted-foreground">Sign in to manage camp operations & logistics</p>
            </div>
          </div>

          {/* Access notice */}
          <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Lock className="size-3.5 text-primary" /> Authorized Administrators Only
            </div>
            <p className="mt-1 text-[11px] leading-relaxed">
              Shelter administrator accounts are provisioned and authorized by the District Relief Authority. Freely self-assigned accounts are prohibited.
            </p>
          </div>

          {/* Unauthorized alert */}
          {search.unauthorized && (
            <div className="mt-4 flex items-start gap-2.5 rounded-md border border-critical/40 bg-critical/10 p-3 text-xs text-critical">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">Access Denied</p>
                <p className="mt-0.5 text-critical/90">Your account does not possess Shelter Administration privileges. Please sign in with camp administrator credentials.</p>
              </div>
            </div>
          )}

          {/* Form error alert */}
          {errorMessage && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-critical/40 bg-critical/10 p-3 text-xs text-critical">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <div>
              <label htmlFor="s-ident" className="block text-xs font-medium text-foreground">
                Administrator ID or Registered Email
              </label>
              <input
                id="s-ident"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. SH-01, kulkarni.sh01@relief.gov.in"
                required
                autoFocus
                className="num mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="s-pass" className="block text-xs font-medium text-foreground">
                  Security Passphrase
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] text-accent hover:underline"
                >
                  Credential support?
                </button>
              </div>
              <div className="relative mt-1">
                <input
                  id="s-pass"
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

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-muted-foreground">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-3.5 rounded border-border"
                />
                <span>Keep administrator session active</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Verifying camp administrator…" : "Sign in to Shelter Console"}
            </button>
          </form>

          {/* Quick Demo Shelter Shortcut */}
          <div className="mt-6 rounded-lg border border-border bg-surface-2 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="label-eyebrow">Verified Administrator Credentials</span>
              <button
                type="button"
                onClick={loadDemoShelter}
                className="text-[11px] text-accent font-medium hover:underline flex items-center gap-1"
              >
                Auto-fill SH-01 <ArrowRight className="size-3" />
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Operator: <code className="num font-semibold text-foreground">SH-01</code> (Municipal Stadium Relief Camp) · Pass: <code className="num text-foreground">Password123!</code>
            </p>
          </div>

          {/* Logistics Support Banner */}
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-4">
            <span>District Relief Logistics Desk:</span>
            <span className="font-mono text-[11px] text-foreground">Ext. 4410 (DDMA)</span>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-foreground">Shelter Administrator Support</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Shelter administrator passkeys are managed under District Emergency Authority security policy. Enter your registered identifier to record a recovery request.
            </p>

            {forgotMessage ? (
              <div className="mt-4 rounded-md border border-info/30 bg-info/10 p-3 text-xs text-info">
                {forgotMessage}
              </div>
            ) : (
              <form className="mt-4 space-y-3" onSubmit={handleForgotSubmit}>
                <input
                  type="text"
                  required
                  value={forgotInput}
                  onChange={(e) => setForgotInput(e.target.value)}
                  placeholder="Shelter ID or official email"
                  className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm text-foreground"
                />
                <button
                  type="submit"
                  className="w-full rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground"
                >
                  Submit Recovery Request
                </button>
              </form>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => { setShowForgotModal(false); setForgotMessage(null); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
