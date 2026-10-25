import { useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ShieldAlert,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  HeartPulse,
  Phone,
  CheckCircle2,
  MapPin,
  ArrowRight,
  UserPlus,
  LogIn,
  AlertTriangle,
} from "lucide-react";
import { StatusPill } from "@/components/sdrep/primitives";
import { ThemeToggle } from "@/components/sdrep/theme";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/portal/citizen/login")({
  validateSearch: (search: Record<string, unknown>): {
    redirect?: string;
    unauthorized?: string;
  } => ({
    redirect: (search["redirect"] as string) || undefined,
    unauthorized: (search["unauthorized"] as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Citizen Portal Login — SDREP Disaster Response" },
      { name: "description", content: "Citizen sign-in for evacuation status, shelter routing, family tracking, and emergency SOS assistance." },
    ],
  }),
  component: CitizenLoginPage,
});

function CitizenLoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/portal/citizen/login" });
  const { login, registerCitizen } = useAuth();

  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("citizen");
  const [password, setPassword] = useState("Password123!");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotInput, setForgotInput] = useState("");
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  // Register state
  const [regName, setRegName] = useState("");
  const [regContact, setRegContact] = useState("");
  const [regSector, setRegSector] = useState("Sector 7 · Riverside");
  const [regConditions, setRegConditions] = useState("None");
  const [regEmergencyContact, setRegEmergencyContact] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage("Please enter your registered email, mobile number, or username.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await login({
        username: username.trim(),
        password,
        expectedRole: "CITIZEN",
        rememberMe,
      });

      if (user.role !== "CITIZEN" && user.role !== "CONTROL_CENTRE_ADMIN") {
        setErrorMessage(`Logged in with role '${user.role}'. Citizen portal requires citizen credentials.`);
        return;
      }

      const dest = search.redirect || "/portal/citizen";
      navigate({ to: dest });
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid credentials. Please verify your email/mobile and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regContact.trim() || !regPassword) {
      setErrorMessage("Please fill in all mandatory fields.");
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const isEmail = regContact.includes("@");
    try {
      await registerCitizen({
        fullName: regName.trim(),
        email: isEmail ? regContact.trim() : undefined,
        mobile: !isEmail ? regContact.trim() : undefined,
        password: regPassword,
        sector: regSector,
        conditions: regConditions,
        emergencyContact: regEmergencyContact || regContact,
      });

      setSuccessMessage("Account created successfully! Loading your personal evacuation dashboard…");
      setTimeout(() => {
        navigate({ to: "/portal/citizen" });
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || "Registration failed. Account may already exist.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotInput.trim()) return;
    try {
      const res = await api.auth.forgotPassword({ identifier: forgotInput.trim(), portal: "CITIZEN" });
      setForgotMessage(res.message);
    } catch (err: any) {
      setForgotMessage(err.message || "Failed to submit recovery request.");
    }
  };

  const loadDemoCitizen = () => {
    setActiveTab("login");
    setUsername("citizen");
    setPassword("Password123!");
    setErrorMessage(null);
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Tactical Left Panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden command-gradient p-10 lg:flex">
        <div aria-hidden className="pointer-events-none absolute inset-0 grid-backdrop opacity-40" />

        <div className="relative flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <ShieldAlert className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-wide">SDREP CITIZEN SAFETY</span>
          </Link>
          <StatusPill tone="critical" pulse>Cyclone Marut · Red Alert</StatusPill>
        </div>

        <div className="relative space-y-6">
          <div>
            <div className="flex items-center gap-2 text-accent">
              <User className="size-5" />
              <span className="label-eyebrow text-accent">CITIZEN EVACUATION PORTAL</span>
            </div>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-foreground">
              Personal evacuation routing, live shelter readiness, and one-tap emergency SOS.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              If your sector is under a mandatory evacuation order, proceed immediately along designated safe corridors to your assigned relief camp.
            </p>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-surface-2/80 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                <HeartPulse className="size-4 text-critical" /> Emergency Life Support Hotline
              </span>
              <a
                href="tel:112"
                className="flex items-center gap-1.5 rounded-md bg-critical px-2.5 py-1 text-xs font-semibold text-critical-foreground hover:bg-critical/90"
              >
                <Phone className="size-3" /> Call 112
              </a>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Direct police, fire, and medical emergency dispatch. Available 24/7 during natural hazard events.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md border border-border bg-surface-2/60 p-3">
              <span className="label-eyebrow">Assigned Camp</span>
              <p className="mt-1 font-medium text-foreground">SH-01 Municipal Stadium</p>
              <p className="text-[10px] text-muted-foreground">Route A · 2.4 km on foot</p>
            </div>
            <div className="rounded-md border border-border bg-surface-2/60 p-3">
              <span className="label-eyebrow">Evacuation Status</span>
              <p className="mt-1 font-medium text-critical">Sector 7 Mandatory</p>
              <p className="text-[10px] text-muted-foreground">Embankment breach 2.1 m</p>
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-between text-[11px] text-muted-foreground">
          <span>National Disaster Management Framework</span>
          <Link to="/about" className="hover:text-foreground underline">Safety Guidelines</Link>
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
            <span className="grid size-9 place-items-center rounded-lg bg-accent/15 text-accent">
              <User className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Citizen Portal Login</h1>
              <p className="text-xs text-muted-foreground">Access your personal evacuation plan & relief assistance</p>
            </div>
          </div>

          {/* Unauthorized alert */}
          {search.unauthorized && (
            <div className="mt-4 flex items-start gap-2.5 rounded-md border border-critical/40 bg-critical/10 p-3 text-xs text-critical">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">Authentication Required</p>
                <p className="mt-0.5 text-critical/90">Please sign in with a verified citizen account to access your personal evacuation status.</p>
              </div>
            </div>
          )}

          {/* Form alerts */}
          {errorMessage && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-critical/40 bg-critical/10 p-3 text-xs text-critical">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-success/40 bg-success/10 p-3 text-xs text-success">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Tab Selector */}
          <div className="mt-6 flex rounded-lg border border-border bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => { setActiveTab("login"); setErrorMessage(null); }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all ${
                activeTab === "login"
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LogIn className="size-3.5" /> Sign in
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab("register"); setErrorMessage(null); }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all ${
                activeTab === "register"
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserPlus className="size-3.5" /> Register as citizen
            </button>
          </div>

          {activeTab === "login" ? (
            <form className="mt-5 space-y-4" onSubmit={handleLogin}>
              <div>
                <label htmlFor="c-ident" className="block text-xs font-medium text-foreground">
                  Email address or registered mobile number
                </label>
                <input
                  id="c-ident"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. s.iyer@citizen.net or citizen"
                  required
                  autoFocus
                  className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="c-pass" className="block text-xs font-medium text-foreground">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-[11px] text-accent hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative mt-1">
                  <input
                    id="c-pass"
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
                  <span>Remember me on this device</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? "Verifying citizen access…" : "Sign in to Citizen Portal"}
              </button>
            </form>
          ) : (
            <form className="mt-5 space-y-3.5" onSubmit={handleRegister}>
              <div>
                <label htmlFor="reg-name" className="block text-xs font-medium text-foreground">
                  Full name *
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Anand K. Patil"
                  className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label htmlFor="reg-contact" className="block text-xs font-medium text-foreground">
                  Email or Mobile phone number *
                </label>
                <input
                  id="reg-contact"
                  type="text"
                  required
                  value={regContact}
                  onChange={(e) => setRegContact(e.target.value)}
                  placeholder="e.g. anand.patil@example.com or +91 98201 11223"
                  className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-sector" className="block text-xs font-medium text-foreground">
                    Current sector
                  </label>
                  <select
                    id="reg-sector"
                    value={regSector}
                    onChange={(e) => setRegSector(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option>Sector 7 · Riverside</option>
                    <option>Sector 3 · Port</option>
                    <option>Sector 12 · Old Town</option>
                    <option>Sector 9 · Civic</option>
                    <option>Sector 18 · North Ridge</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="reg-cond" className="block text-xs font-medium text-foreground">
                    Medical condition / Note
                  </label>
                  <input
                    id="reg-cond"
                    type="text"
                    value={regConditions}
                    onChange={(e) => setRegConditions(e.target.value)}
                    placeholder="e.g. Asthma, Mobility aid"
                    className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-xs text-foreground"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-emg" className="block text-xs font-medium text-foreground">
                  Emergency contact number
                </label>
                <input
                  id="reg-emg"
                  type="text"
                  value={regEmergencyContact}
                  onChange={(e) => setRegEmergencyContact(e.target.value)}
                  placeholder="+91 98200 00000 (Family / Next of Kin)"
                  className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div>
                <label htmlFor="reg-pwd" className="block text-xs font-medium text-foreground">
                  Create password *
                </label>
                <input
                  id="reg-pwd"
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="mt-1 w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-accent py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? "Creating citizen registration…" : "Register & View Evacuation Plan"}
              </button>
            </form>
          )}

          {/* Quick Demo Citizen Credentials */}
          <div className="mt-6 rounded-lg border border-border bg-surface-2 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="label-eyebrow">Demo Account Shortcut</span>
              <button
                type="button"
                onClick={loadDemoCitizen}
                className="text-[11px] text-accent font-medium hover:underline flex items-center gap-1"
              >
                Auto-fill citizen <ArrowRight className="size-3" />
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              User: <code className="num font-semibold text-foreground">citizen</code> · Pass: <code className="num text-foreground">Password123!</code>
            </p>
          </div>

          {/* Emergency 112 Help Banner */}
          <div className="mt-4 flex items-center justify-between rounded-lg border border-critical/30 bg-critical/10 p-3 text-xs text-critical">
            <div className="flex items-center gap-2">
              <Phone className="size-4" />
              <span>Immediate life threat?</span>
            </div>
            <a href="tel:112" className="font-semibold underline">Call 112 directly</a>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-foreground">Citizen Account Recovery</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter your registered email address or mobile number to receive verification and emergency access instructions.
            </p>

            {forgotMessage ? (
              <div className="mt-4 rounded-md border border-success/30 bg-success/10 p-3 text-xs text-success">
                {forgotMessage}
              </div>
            ) : (
              <form className="mt-4 space-y-3" onSubmit={handleForgotSubmit}>
                <input
                  type="text"
                  required
                  value={forgotInput}
                  onChange={(e) => setForgotInput(e.target.value)}
                  placeholder="Registered email or mobile"
                  className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm text-foreground"
                />
                <button
                  type="submit"
                  className="w-full rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground"
                >
                  Send Recovery Link
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
