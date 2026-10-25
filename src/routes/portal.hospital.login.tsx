import { useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ShieldAlert,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Hospital,
  HeartPulse,
  Ambulance,
  BedDouble,
  Droplet,
  ArrowRight,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { StatusPill } from "@/components/sdrep/primitives";
import { ThemeToggle } from "@/components/sdrep/theme";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/portal/hospital/login")({
  validateSearch: (search: Record<string, unknown>): {
    redirect?: string;
    unauthorized?: string;
  } => ({
    redirect: (search["redirect"] as string) || undefined,
    unauthorized: (search["unauthorized"] as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Hospital Operations Login — SDREP Medical Surge Network" },
      { name: "description", content: "Clinical portal sign-in for casualty intake, mass-casualty triage, emergency bed and ICU capacity, and ambulance arrivals." },
    ],
  }),
  component: HospitalLoginPage,
});

function HospitalLoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/portal/hospital/login" });
  const { login } = useAuth();

  const [username, setUsername] = useState("HSP-1");
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
      setErrorMessage("Please enter your Hospital ID, clinical email, or triage username.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const user = await login({
        username: username.trim(),
        password,
        expectedRole: "HOSPITAL_STAFF",
        rememberMe,
      });

      if (user.role !== "HOSPITAL_STAFF" && user.role !== "CONTROL_CENTRE_ADMIN") {
        setErrorMessage(`Account role is '${user.role}'. Hospital portal requires clinical emergency staff authorization.`);
        return;
      }

      const dest = search.redirect || "/portal/hospital";
      navigate({ to: dest });
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid clinical credentials or unauthorized hospital operator ID.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotInput.trim()) return;
    try {
      const res = await api.auth.forgotPassword({ identifier: forgotInput.trim(), portal: "HOSPITAL" });
      setForgotMessage(res.message);
    } catch (err: any) {
      setForgotMessage(err.message || "Failed to submit recovery request.");
    }
  };

  const loadDemoHospital = () => {
    setUsername("HSP-1");
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
            <span className="text-sm font-semibold tracking-wide">SDREP MEDICAL SURGE NETWORK</span>
          </Link>
          <StatusPill tone="critical" pulse>MCI Protocol Phase 2</StatusPill>
        </div>

        <div className="relative space-y-6">
          <div>
            <div className="flex items-center gap-2 text-info">
              <Hospital className="size-5" />
              <span className="label-eyebrow text-info">CLINICAL TRIAGE COMMAND</span>
            </div>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-foreground">
              Casualty intake, START triage queue, ICU bed tracking, and ambulance dispatch coordination.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Provides real-time clinical visibility across regional trauma centres, coordinating ambulance arrivals, emergency department surge load, and blood bank reserves.
            </p>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-surface-2/80 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span className="flex items-center gap-2">
                <HeartPulse className="size-4 text-critical" /> Standardized START Triage Protocol
              </span>
              <StatusPill tone="critical">Red Tag Priority</StatusPill>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Clinical decision workflow enforces algorithmically prioritized queues: Red (Immediate Resuscitation), Yellow (Delayed Urgent), Green (Minimal Ambulatory).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md border border-border bg-surface-2/60 p-3">
              <span className="label-eyebrow">Facility Identification</span>
              <p className="mt-1 font-medium text-foreground">City General Hospital</p>
              <p className="text-[10px] text-muted-foreground">Facility ID: HSP-1 · Level 1 Trauma</p>
            </div>
            <div className="rounded-md border border-border bg-surface-2/60 p-3">
              <span className="label-eyebrow">Surge Capacity</span>
              <p className="mt-1 font-medium text-warning">72 Free Beds / 5 ICU</p>
              <p className="text-[10px] text-muted-foreground">11 inbound casualties (next 25 min)</p>
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Department of Health & Emergency Medical Services</span>
          <span className="flex items-center gap-1 font-mono text-[10px]">
            <ShieldCheck className="size-3 text-success" /> HIPAA / Clinical Privacy Active
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
            <span className="grid size-9 place-items-center rounded-lg bg-info/15 text-info">
              <Hospital className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Hospital Operations Login</h1>
              <p className="text-xs text-muted-foreground">Authorized access for triage officers & clinical coordinators</p>
            </div>
          </div>

          {/* Privacy & Authorized notice */}
          <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Lock className="size-3.5 text-info" /> Authorized Medical Personnel Only
            </div>
            <p className="mt-1 text-[11px] leading-relaxed">
              Restricted to authorized emergency department staff. In compliance with patient privacy regulations, no sensitive patient identifiable health information is collected or exposed on this login interface.
            </p>
          </div>

          {/* Unauthorized alert */}
          {search.unauthorized && (
            <div className="mt-4 flex items-start gap-2.5 rounded-md border border-critical/40 bg-critical/10 p-3 text-xs text-critical">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">Access Denied</p>
                <p className="mt-0.5 text-critical/90">Your credentials do not possess Clinical Hospital privileges. Please sign in with an authorized hospital coordinator account.</p>
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
              <label htmlFor="h-ident" className="block text-xs font-medium text-foreground">
                Hospital ID, Official Clinical Email, or Operator Username
              </label>
              <input
                id="h-ident"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. HSP-1, sheikh.triage@citygen.org"
                required
                autoFocus
                className="num mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="h-pass" className="block text-xs font-medium text-foreground">
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
                  id="h-pass"
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
                <span>Maintain clinical session</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Verifying medical credentials…" : "Sign in to Hospital Portal"}
            </button>
          </form>

          {/* Quick Demo Hospital Shortcut */}
          <div className="mt-6 rounded-lg border border-border bg-surface-2 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="label-eyebrow">Verified Facility Credentials</span>
              <button
                type="button"
                onClick={loadDemoHospital}
                className="text-[11px] text-accent font-medium hover:underline flex items-center gap-1"
              >
                Auto-fill HSP-1 <ArrowRight className="size-3" />
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Facility: <code className="num font-semibold text-foreground">HSP-1</code> (City General Hospital) · Pass: <code className="num text-foreground">Password123!</code>
            </p>
          </div>

          {/* Clinical Emergency Desk Link */}
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-4">
            <span>Hospital Incident Command Desk:</span>
            <span className="font-mono text-[11px] text-foreground">Direct Line: 022-2623-HOSP</span>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-foreground">Clinical Credential Support</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Hospital coordinator credentials are authenticated against the Department of Health directory. Enter your official email or Hospital ID to request assistance.
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
                  placeholder="Hospital ID or official email"
                  className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm text-foreground"
                />
                <button
                  type="submit"
                  className="w-full rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground"
                >
                  Send Verification Request
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
