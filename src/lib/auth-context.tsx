import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api-client";

export type UserRole =
  | "CITIZEN"
  | "RESCUE_TEAM"
  | "SHELTER_ADMIN"
  | "HOSPITAL_STAFF"
  | "CONTROL_CENTRE_ADMIN";

export interface UserSession {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  associatedEntityId?: string;
}

export function getDefaultRouteForRole(role: string): string {
  switch (role) {
    case "CONTROL_CENTRE_ADMIN":
      return "/control";
    case "RESCUE_TEAM":
      return "/portal/rescue";
    case "SHELTER_ADMIN":
      return "/portal/shelter";
    case "HOSPITAL_STAFF":
    case "HOSPITAL_COORDINATOR":
      return "/portal/hospital";
    case "CITIZEN":
      return "/portal/citizen";
    default:
      return "/login";
  }
}

export function getRoleLabel(role: string): string {
  switch (role) {
    case "CONTROL_CENTRE_ADMIN":
      return "Control Centre Administrator";
    case "RESCUE_TEAM":
      return "Tactical Rescue Unit";
    case "SHELTER_ADMIN":
      return "Relief Shelter Administrator";
    case "HOSPITAL_STAFF":
    case "HOSPITAL_COORDINATOR":
      return "Hospital Triage Coordinator";
    case "CITIZEN":
      return "Verified Citizen";
    default:
      return role;
  }
}

interface AuthContextType {
  user: UserSession | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: { username: string; password: string; expectedRole?: string; rememberMe?: boolean }) => Promise<UserSession>;
  registerCitizen: (payload: {
    fullName: string;
    email?: string;
    mobile?: string;
    password: string;
    sector?: string;
    conditions?: string;
    emergencyContact?: string;
  }) => Promise<UserSession>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<UserSession | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem("sdrep_user");
    try {
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("sdrep_token");
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkAuth = async (): Promise<UserSession | null> => {
    const currentToken = localStorage.getItem("sdrep_token");
    if (!currentToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return null;
    }

    try {
      const res = await api.auth.me();
      if (res.success && res.user) {
        setUser(res.user);
        setToken(currentToken);
        localStorage.setItem("sdrep_user", JSON.stringify(res.user));
        return res.user;
      } else {
        throw new Error("Invalid session");
      }
    } catch {
      // Token is invalid or expired
      localStorage.removeItem("sdrep_token");
      localStorage.removeItem("sdrep_user");
      setUser(null);
      setToken(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (credentials: {
    username: string;
    password: string;
    expectedRole?: string;
    rememberMe?: boolean;
  }): Promise<UserSession> => {
    setIsLoading(true);
    try {
      const res = await api.auth.login(credentials);
      if (!res.token || !res.user) {
        throw new Error(res.message || "Authentication failed. No token returned.");
      }

      localStorage.setItem("sdrep_token", res.token);
      localStorage.setItem("sdrep_user", JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const registerCitizen = async (payload: {
    fullName: string;
    email?: string;
    mobile?: string;
    password: string;
    sector?: string;
    conditions?: string;
    emergencyContact?: string;
  }): Promise<UserSession> => {
    setIsLoading(true);
    try {
      const res = await api.auth.registerCitizen(payload);
      if (!res.token || !res.user) {
        throw new Error(res.message || "Registration failed.");
      }

      localStorage.setItem("sdrep_token", res.token);
      localStorage.setItem("sdrep_user", JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem("sdrep_token");
      localStorage.removeItem("sdrep_user");
      setUser(null);
      setToken(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, registerCitizen, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
