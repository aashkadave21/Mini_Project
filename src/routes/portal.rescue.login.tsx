import { useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ShieldAlert,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Siren,
  Radio,
  Navigation,
  ArrowRight,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { StatusPill } from "@/components/sdrep/primitives";
import { ThemeToggle } from "@/components/sdrep/theme";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/portal/rescue/login")({
  validateSearch: (search: Record<string, unknown>): {
    redirect?: string;
    unauthorized?: string;
  } => ({
    redirect: (search["redirect"] as string) || undefined,
    unauthorized: (search["unauthorized"] as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Rescue Operations Login — SDREP Tactical Command" },
      { name: "description", content: "Tactical access portal for NDRF, Fire & Rescue, USAR, Coast Guard, and Disaster Response Units." },
    ],
  }),
  component: RescueLoginPage,
});

function RescueLoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/portal/rescue/login" });
  const { login } = useAuth();

  const [username, setUsername] = useState("ALPHA-1");
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
      setErrorMessage("Please enter your team callsign, employee ID, or official email.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const user = await login({
        username: username.trim(),
        password,
        expectedRole: "RESCUE_TEAM",
        rememberMe,
      });

      if (user.role !== "RESCUE_TEAM" && user.role !== "CONTROL_CENTRE_ADMIN") {
        setErrorMessage(`Account role is '${user.role}'. Rescue operations requires tactical unit credentials.`);
        return;
      }

      const dest = search.redirect || "/portal/rescue";
      navigate({ to: dest });
    } catch (err: any) {
      setErrorMessage(err.message || "Authentication failed. Invalid unit callsign or passkey.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotInput.trim()) return;
    try {
      const res = await api.auth.forgotPassword({ identifier: forgotInput.trim(), portal: "RESCUE" });
      setForgotMessage(res.message);
    } catch (err: any) {
      setForgotMessage(err.message || "Failed to submit recovery request.");
    }
  };

  const loadDemoRescue = () => {
    setUsername("ALPHA-1");
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
            <span className="text-sm font-semibold tracking-wide">SDREP TACTICAL NETWORK</span>
          </Link>
          <StatusPill tone="critical" pulse>DEFCON-1 Readiness Active</StatusPill>
        </div>

        <div className="relative space-y-6">
          <div>
            <div className="flex items-center gap-2 text-warning">
              <Siren className="size-5" />
              <span className="label-eyebrow text-warning">FIELD OPERATIONS GATEWAY</span>
            </div>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-foreground">
              Mission tasking, victim extraction queue, and multi-agency field coordination.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Real-time telemetry link for NDRF water rescue units, fire & hazmat response, urban search & rescue (USAR), and air reconnaissance.
            </p>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-surface-2/80 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span className="flex items-center gap-2">
                <Radio className="size-4 text-success" /> Tactical Radio Net Status
              </span>
              <StatusPill tone="success">VHF 156.8 MHz Secure</StatusPill>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Field telemetry stream is cryptographically isolated. Real-time GPS location sharing and mission reports are audited by Disaster Control Centre.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md border border-border bg-surface-2/60 p-3">
              <span className="label-eyebrow">Active Deployments</span>
              <p className="mt-1 font-medium text-foreground">6 Units Deployed</p>
              <p className="text-[10px] text-muted-foreground">ALPHA-1 on-scene Sector 7</p>
            </div>
            <div className="rounded-md border border-border bg-surface-2/60 p-3">
              <span className="label-eyebrow">Corridor Routing</span>
              <p className="mt-1 font-medium text-info">Ridge Link Clear</p>
              <p className="text-[10px] text-muted-foreground">Riverside Arterial Flooded</p>
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-between text-[11px] text-muted-foreground">
          <span>NDRF · Fire & Rescue · USAR Command</span>
          <span className="flex items-center gap-1 font-mono text-[10px]">
            <ShieldCheck className="size-3 text-success" /> FIPS 140-2 Validated
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
            <span className="grid size-9 place-items-center rounded-lg bg-warning/15 text-warning">
              <Siren className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Rescue Operations Login</h1>
              <p className="text-xs text-muted-foreground">Authorized access for tactical rescue personnel</p>
            </div>
          </div>

          {/* Access notice */}
          <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Lock className="size-3.5 text-warning" /> Authorized Personnel Only
            </div>
            <p className="mt-1 text-[11px] leading-relaxed">
              Public self-registration is disabled for tactical responders. Team credentials and hardware tokens are provisioned by agency administration.
            </p>
          </div>

          {/* Unauthorized alert */}
          {search.unauthorized && (
            <div className="mt-4 flex items-start gap-2.5 rounded-md border border-critical/40 bg-critical/10 p-3 text-xs text-critical">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">Access Denied</p>
                <p className="mt-0.5 text-critical/90">Your account does not possess Tactical Rescue permissions. Please sign in with authorized unit credentials.</p>
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
              <label htmlFor="r-ident" className="block text-xs font-medium text-foreground">
                Official email, Employee ID, or Callsign
              </label>
              <input
                id="r-ident"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. ALPHA-1, verma.alpha1@ndrf.gov.in"
                required
                autoFocus
                className="num mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="r-pass" className="block text-xs font-medium text-foreground">
                  Security Passphrase
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] text-accent hover:underline"
                >
                  Credential help?
                </button>
              </div>
              <div className="relative mt-1">
                <input
                  id="r-pass"
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
                <span>Remember tactical session</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Verifying tactical clearance…" : "Authenticate & Open Mission Board"}
            </button>
          </form>

          {/* Quick Demo Rescue Shortcut */}
          <div className="mt-6 rounded-lg border border-border bg-surface-2 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="label-eyebrow">Verified Unit Credentials</span>
              <button
                type="button"
                onClick={loadDemoRescue}
                className="text-[11px] text-accent font-medium hover:underline flex items-center gap-1"
              >
                Auto-fill ALPHA-1 <ArrowRight className="size-3" />
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Callsign: <code className="num font-semibold text-foreground">ALPHA-1</code> (NDRF Water Rescue) · Pass: <code className="num text-foreground">Password123!</code>
            </p>
          </div>

          {/* Comms Link */}
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-4">
            <span>Lost radio net link?</span>
            <span className="font-mono text-[11px] text-foreground">Control Desk VHF: Ch. 16</span>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-foreground">Tactical Credential Support</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Rescue personnel passkey resets must be authorized by Disaster Control Centre to ensure operational chain of custody.
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
                  placeholder="Official email or callsign"
                  className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm text-foreground"
                />
                <button
                  type="submit"
                  className="w-full rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground"
                >
                  Log Reset Requisition
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
