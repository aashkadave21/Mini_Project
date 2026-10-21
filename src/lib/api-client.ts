/**
 * Centralized SDREP Full-Stack REST API Client
 * Connects frontend components to http://localhost:3001/api/v1
 */

const API_BASE = import.meta.env["VITE_API_URL"] || "http://localhost:3001/api/v1";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  requestId?: string;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("sdrep_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || `Request failed with HTTP status ${res.status}`);
    }

    return data as T;
  } catch (err: any) {
    console.error(`[API Client Error] ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  auth: {
    login: (credentials: { username: string; password: string }) =>
      request<{ success: boolean; token: string; user: any; message?: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    me: () => request<{ success: boolean; user: any }>("/auth/me"),
    logout: () =>
      request<{ success: boolean; message: string }>("/auth/logout", {
        method: "POST",
      }),
  },

  public: {
    getStatus: () => request<{ success: boolean; data: any }>("/public/status"),
    getIncidents: () => request<{ success: boolean; data: any[] }>("/public/incidents"),
    getAlerts: () => request<{ success: boolean; data: any[] }>("/public/alerts"),
    getStatistics: () => request<{ success: boolean; data: any }>("/public/statistics"),
  },

  citizen: {
    getProfile: () => request<{ success: boolean; data: any }>("/citizens/me"),
    updateChecklist: (itemIndex: number, checked: boolean) =>
      request<{ success: boolean; data: any[] }>("/citizens/me/checklist", {
        method: "PATCH",
        body: JSON.stringify({ itemIndex, checked }),
      }),
    updateFamily: (memberId: string, status: string, tone = "success") =>
      request<{ success: boolean; data: any[] }>("/citizens/me/family/checkin", {
        method: "POST",
        body: JSON.stringify({ memberId, status, tone }),
      }),
    submitSOS: (payload: { sector?: string; headcount?: number; medicalUrgency?: boolean; notes?: string }) =>
      request<{ success: boolean; message: string; data: any }>("/sos", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  rescue: {
    getActive: () => request<{ success: boolean; data: any }>("/rescue/active"),
    updateMissionStatus: (missionId: string, status: string, outcomeReport?: string) =>
      request<{ success: boolean; message: string; data: any }>(`/rescue/missions/${missionId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, outcomeReport }),
      }),
    submitReport: (incidentId: string, observation: string) =>
      request<{ success: boolean; message: string; data: any }>(`/rescue/missions/${incidentId}/reports`, {
        method: "POST",
        body: JSON.stringify({ incidentId, observation }),
      }),
    autoAllocate: () =>
      request<{ success: boolean; message: string; data: any }>("/rescue/auto-allocate", {
        method: "POST",
      }),
  },

  shelter: {
    getShelter: (id: string) => request<{ success: boolean; data: any }>(`/shelters/${id}`),
    registerIntake: (shelterId: string, payload: { fullName: string; familyCount: number; originSector: string; mobilityNeeds?: string; specialNeeds?: string }) =>
      request<{ success: boolean; message: string; data: any }>(`/shelters/${shelterId}/intake`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    requestSupplies: (shelterId: string, payload: { resource: string; quantity: number; urgency: string }) =>
      request<{ success: boolean; message: string; data: any }>(`/shelters/${shelterId}/supply-requests`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    addVolunteer: (shelterId: string, payload: { name: string; role: string; shift?: string }) =>
      request<{ success: boolean; data: any }>(`/shelters/${shelterId}/volunteers`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  hospital: {
    getDetails: (id: string) => request<{ success: boolean; data: any }>(`/hospitals/${id}`),
    declareDiversion: (id: string, diversion?: boolean, reason?: string) =>
      request<{ success: boolean; message: string; data: any }>(`/hospitals/${id}/diversion`, {
        method: "POST",
        body: JSON.stringify({ diversion, reason }),
      }),
    addTriageCase: (id: string, payload: { tag: string; desc: string }) =>
      request<{ success: boolean; message: string; data: any }>(`/hospitals/${id}/triage`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  evacuation: {
    getCorridors: () => request<{ success: boolean; data: any }>("/evacuation/corridors"),
    getRoute: (startNode?: string, targetNode?: string, algorithm = "Dijkstra") =>
      request<{ success: boolean; data: any }>(`/evacuation/route?startNode=${startNode || ""}&targetNode=${targetNode || ""}&algorithm=${algorithm}`),
    recalculateAll: () =>
      request<{ success: boolean; message: string; data: any }>("/evacuation/route/recalculate", {
        method: "POST",
      }),
    toggleRoadState: (roadId: string, state?: string) =>
      request<{ success: boolean; message: string; data: any }>(`/evacuation/roads/${roadId}/toggle`, {
        method: "POST",
        body: JSON.stringify({ state }),
      }),
  },

  analytics: {
    getOverview: () => request<{ success: boolean; data: any }>("/analytics/overview"),
    getBenchmark: () => request<{ success: boolean; results: any[] }>("/analytics/benchmark"),
  },
};
