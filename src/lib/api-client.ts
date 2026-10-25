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
    login: (credentials: { username: string; password: string; expectedRole?: string; rememberMe?: boolean }) =>
      request<{ success: boolean; token: string; user: any; message?: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    me: () => request<{ success: boolean; user: any }>("/auth/me"),
    logout: () =>
      request<{ success: boolean; message: string }>("/auth/logout", {
        method: "POST",
      }),
    registerCitizen: (payload: {
      fullName: string;
      email?: string;
      mobile?: string;
      password: string;
      sector?: string;
      conditions?: string;
      emergencyContact?: string;
    }) =>
      request<{ success: boolean; token: string; user: any; message: string }>("/auth/register-citizen", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    forgotPassword: (payload: { identifier: string; portal?: string }) =>
      request<{ success: boolean; message: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    changePassword: (payload: { currentPassword: string; newPassword: string }) =>
      request<{ success: boolean; message: string }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify(payload),
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
    getMyRequests: () => request<{ success: boolean; data: any[] }>("/citizens/me/requests"),
    updateProfile: (payload: { bloodGroup?: string; conditions?: string; medication?: string; emergencyContact?: string; sector?: string }) =>
      request<{ success: boolean; message: string; data: any }>("/citizens/me/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
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
    addFamilyMember: (payload: { name: string; status?: string; tone?: string }) =>
      request<{ success: boolean; message: string; data: any }>("/citizens/me/family", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    removeFamilyMember: (memberId: string) =>
      request<{ success: boolean; message: string }>("/citizens/me/family/" + memberId, {
        method: "DELETE",
      }),
    submitSOS: (payload: { sector?: string; headcount?: number; medicalUrgency?: boolean; notes?: string }) =>
      request<{ success: boolean; message: string; data: any }>("/sos", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  rescue: {
    getActive: () => request<{ success: boolean; data: any }>("/rescue/active"),
    getAllTeams: () => request<{ success: boolean; data: any[] }>("/rescue/teams"),
    getAllMissions: () => request<{ success: boolean; data: any[] }>("/rescue/missions"),
    getReports: () => request<{ success: boolean; data: any[] }>("/rescue/reports"),
    updateMissionStatus: (missionId: string, status: string, outcomeReport?: string) =>
      request<{ success: boolean; message: string; data: any }>(`/rescue/missions/${missionId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, outcomeReport }),
      }),
    updateTeamStatus: (teamId: string, status?: string, fuel?: number) =>
      request<{ success: boolean; message: string; data: any }>(`/rescue/teams/${teamId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, fuel }),
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
    getAll: () => request<{ success: boolean; data: any[] }>("/shelters"),
    getShelter: (id: string) => request<{ success: boolean; data: any }>(`/shelters/${id}`),
    getEvacuees: (id: string) => request<{ success: boolean; data: any[] }>(`/shelters/${id}/evacuees`),
    registerIntake: (shelterId: string, payload: { fullName: string; familyCount: number; originSector: string; mobilityNeeds?: string; specialNeeds?: string }) =>
      request<{ success: boolean; message: string; data: any }>(`/shelters/${shelterId}/intake`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    checkout: (shelterId: string, payload: { evacueeId?: string; count?: number }) =>
      request<{ success: boolean; message: string; data: any }>(`/shelters/${shelterId}/checkout`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    updateInventory: (shelterId: string, payload: { waterStock?: number; foodStock?: number; blanketsStock?: number; medicalKitsStock?: number; sanitationStock?: number }) =>
      request<{ success: boolean; message: string; data: any }>(`/shelters/${shelterId}/inventory`, {
        method: "PATCH",
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
    getAll: () => request<{ success: boolean; data: any[] }>("/hospitals"),
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
    updateTriageStatus: (id: string, caseId: string, payload: { status?: string; tag?: string }) =>
      request<{ success: boolean; message: string; data: any }>(`/hospitals/${id}/triage/${caseId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    registerAmbulance: (id: string, payload: { unit: string; eta?: string; triage?: string; cases?: number }) =>
      request<{ success: boolean; data: any }>(`/hospitals/${id}/ambulances`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    confirmAmbulanceArrival: (id: string, ambId: string) =>
      request<{ success: boolean; message: string; data: any }>(`/hospitals/${id}/ambulances/${ambId}/arrive`, {
        method: "POST",
      }),
    updateBloodStock: (idOrGroup: string, groupOrUnits: string | number, maybeUnits?: number) => {
      const id = maybeUnits !== undefined ? idOrGroup : "HSP-1";
      const group = (maybeUnits !== undefined ? groupOrUnits : idOrGroup) as string;
      const units = (maybeUnits !== undefined ? maybeUnits : groupOrUnits) as number;
      return request<{ success: boolean; message: string; data: any }>(`/hospitals/${id}/blood`, {
        method: "PATCH",
        body: JSON.stringify({ group, units }),
      });
    },
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
    getAuditLogs: () => request<{ success: boolean; data: any[] }>("/analytics/audit-logs"),
  },
};
