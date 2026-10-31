import { Router } from "express";
import {
  login,
  getCurrentUser,
  logout,
  registerCitizen,
  forgotPassword,
  changePassword,
} from "../controllers/auth.controller.js";
import {
  getPublicStatus,
  getPublicIncidents,
  getPublicAlerts,
  getPublicStatistics,
} from "../controllers/public.controller.js";
import {
  getAllIncidents,
  getPrioritizedIncidents,
  getIncidentById,
  createIncident,
  updateIncident,
  closeIncident,
} from "../controllers/incident.controller.js";
import {
  getCorridors,
  computeRoute,
  recalculateAllRoutes,
  toggleRoadState,
  getSectorsClearance,
  getReachabilityAnalysis,
  compareCongestionRoutes,
} from "../controllers/evacuation.controller.js";
import {
  getAllShelters,
  getShelterById,
  registerEvacueeIntake,
  createSupplyRequest,
  updateVolunteerRoster,
  checkoutEvacuee,
  getEvacueesList,
  updateInventory,
  updateShelterCapacity,
} from "../controllers/shelter.controller.js";
import {
  getAllTeams,
  getAllMissions,
  getActiveMissionDetails,
  updateMissionStatus,
  submitIncidentReport,
  autoAllocateMissions,
  updateTeamStatus,
  getMissionReports,
  getSuitableVehicles,
  assignVehicleAtomic,
  getAllocationComparison,
  syncOfflineMissionUpdates,
} from "../controllers/rescue.controller.js";
import {
  getAllHospitals,
  getHospitalDetails,
  declareHospitalDiversion,
  addTriageCase,
  registerAmbulanceArrival,
  updateTriageStatus,
  confirmAmbulanceArrival,
  updateBloodStock,
  updateHospitalCapacity,
  findSuitableFacilityEndpoint,
} from "../controllers/hospital.controller.js";
import {
  getCitizenProfile,
  updateChecklist,
  updateFamilyCheckin,
  submitSOS,
  syncOfflineQueue,
  getMyRequests,
  updateCitizenProfile,
  addFamilyMember,
  removeFamilyMember,
} from "../controllers/citizen.controller.js";
import {
  getAnalyticsOverview,
  getAlgorithmBenchmark,
  getAuditLogs,
  getCongestionClusters,
  runBenchmarkEndpoint,
} from "../controllers/analytics.controller.js";
import { authenticate, optionalAuthenticate, requireRole } from "../middleware/auth.middleware.js";
import { eventBus } from "../events/event-bus.js";
import { db } from "../db/db.js";

export const apiRouter = Router();

// --- Health Check ---
apiRouter.get("/health", (_req, res) => {
  res.json({
    status: "HEALTHY",
    service: "SDREP-API-Engine",
    version: "1.0.0",
    database: {
      engine: db.backendEngine,
      connected: db.isConnected,
      storage: db.backendEngine === "PostgreSQL" ? "Supabase PostgreSQL (Cloud Relational)" : "Local RelationalStorageEngine (ACID JSON Store)",
    },
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// --- Real-time SSE Stream ---
apiRouter.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const clientId = `CLIENT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const role = (req.query.role as string) || undefined;
  const entityId = (req.query.entityId as string) || undefined;

  eventBus.addClient({ id: clientId, role, entityId, res });

  req.on("close", () => {
    eventBus.removeClient(clientId);
  });
});

// --- Auth Endpoints ---
apiRouter.post("/auth/login", login);
apiRouter.post("/auth/logout", authenticate, logout);
apiRouter.get("/auth/me", authenticate, getCurrentUser);
apiRouter.post("/auth/register-citizen", registerCitizen);
apiRouter.post("/auth/forgot-password", forgotPassword);
apiRouter.post("/auth/change-password", authenticate, changePassword);

// --- Public Endpoints ---
apiRouter.get("/public/status", getPublicStatus);
apiRouter.get("/public/incidents", getPublicIncidents);
apiRouter.get("/public/alerts", getPublicAlerts);
apiRouter.get("/public/statistics", getPublicStatistics);

// --- Incidents & Hazards ---
apiRouter.get("/incidents/priority-queue", getPrioritizedIncidents);
apiRouter.get("/incidents", getAllIncidents);
apiRouter.get("/incidents/:id", getIncidentById);
apiRouter.post("/incidents", optionalAuthenticate, createIncident);
apiRouter.patch("/incidents/:id", optionalAuthenticate, updateIncident);
apiRouter.post("/incidents/:id/close", optionalAuthenticate, closeIncident);

// --- Evacuation & Routing ---
apiRouter.get("/evacuation/corridors", getCorridors);
apiRouter.get("/evacuation/route", computeRoute);
apiRouter.post("/evacuation/route/recalculate", optionalAuthenticate, recalculateAllRoutes);
apiRouter.post("/evacuation/roads/:id/toggle", optionalAuthenticate, toggleRoadState);
apiRouter.get("/evacuation/sectors", getSectorsClearance);
apiRouter.get("/evacuation/reachability", getReachabilityAnalysis);
apiRouter.get("/evacuation/congestion-comparison", compareCongestionRoutes);

// --- Shelters & Intake ---
apiRouter.get("/shelters", getAllShelters);
apiRouter.get("/shelters/:id", getShelterById);
apiRouter.get("/shelters/:id/evacuees", getEvacueesList);
apiRouter.post("/shelters/:id/intake", optionalAuthenticate, registerEvacueeIntake);
apiRouter.post("/shelters/:id/checkout", optionalAuthenticate, checkoutEvacuee);
apiRouter.patch("/shelters/:id/inventory", optionalAuthenticate, updateInventory);
apiRouter.patch("/shelters/:id/capacity", optionalAuthenticate, updateShelterCapacity);
apiRouter.post("/shelters/:id/supply-requests", optionalAuthenticate, createSupplyRequest);
apiRouter.post("/shelters/:id/volunteers", optionalAuthenticate, updateVolunteerRoster);

// --- Rescue & Missions ---
apiRouter.get("/rescue/teams", getAllTeams);
apiRouter.get("/rescue/missions", getAllMissions);
apiRouter.get("/rescue/active", getActiveMissionDetails);
apiRouter.get("/rescue/reports", getMissionReports);
apiRouter.get("/rescue/suitable-vehicles", getSuitableVehicles);
apiRouter.post("/rescue/assign-vehicle", optionalAuthenticate, assignVehicleAtomic);
apiRouter.get("/rescue/baseline-comparison", getAllocationComparison);
apiRouter.post("/rescue/sync-offline", optionalAuthenticate, syncOfflineMissionUpdates);
apiRouter.patch("/rescue/missions/:id/status", optionalAuthenticate, updateMissionStatus);
apiRouter.patch("/rescue/teams/:id/status", optionalAuthenticate, updateTeamStatus);
apiRouter.post("/rescue/missions/:id/reports", optionalAuthenticate, submitIncidentReport);
apiRouter.post("/rescue/auto-allocate", optionalAuthenticate, autoAllocateMissions);

// --- Hospitals & Facilities ---
apiRouter.get("/hospitals", getAllHospitals);
apiRouter.get("/hospitals/:id", getHospitalDetails);
apiRouter.post("/hospitals/:id/diversion", optionalAuthenticate, declareHospitalDiversion);
apiRouter.patch("/hospitals/:id/capacity", optionalAuthenticate, updateHospitalCapacity);
apiRouter.post("/facilities/find-suitable", findSuitableFacilityEndpoint);
apiRouter.post("/hospitals/:id/triage", optionalAuthenticate, addTriageCase);
apiRouter.patch("/hospitals/:id/triage/:caseId", optionalAuthenticate, updateTriageStatus);
apiRouter.post("/hospitals/:id/ambulances", optionalAuthenticate, registerAmbulanceArrival);
apiRouter.post("/hospitals/:id/ambulances/:ambId/arrive", optionalAuthenticate, confirmAmbulanceArrival);
apiRouter.patch("/hospitals/:id/blood", optionalAuthenticate, updateBloodStock);

// --- Citizen & SOS ---
apiRouter.get("/citizens/me", optionalAuthenticate, getCitizenProfile);
apiRouter.get("/citizens/me/requests", optionalAuthenticate, getMyRequests);
apiRouter.patch("/citizens/me/profile", optionalAuthenticate, updateCitizenProfile);
apiRouter.patch("/citizens/me/checklist", optionalAuthenticate, updateChecklist);
apiRouter.post("/citizens/me/family", optionalAuthenticate, addFamilyMember);
apiRouter.delete("/citizens/me/family/:memberId", optionalAuthenticate, removeFamilyMember);
apiRouter.post("/citizens/me/family/checkin", optionalAuthenticate, updateFamilyCheckin);
apiRouter.post("/sos", optionalAuthenticate, submitSOS);
apiRouter.post("/offline/sync", optionalAuthenticate, syncOfflineQueue);

// --- Analytics & Evaluation ---
apiRouter.get("/analytics/overview", getAnalyticsOverview);
apiRouter.get("/analytics/benchmark", getAlgorithmBenchmark);
apiRouter.post("/analytics/benchmark-run", runBenchmarkEndpoint);
apiRouter.get("/analytics/congestion-clusters", getCongestionClusters);
apiRouter.post("/analytics/congestion-clusters", getCongestionClusters);
apiRouter.get("/analytics/audit-logs", optionalAuthenticate, getAuditLogs);

