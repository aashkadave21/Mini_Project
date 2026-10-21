import { Router } from "express";
import { login, getCurrentUser, logout } from "../controllers/auth.controller.js";
import { getPublicStatus, getPublicIncidents, getPublicAlerts, getPublicStatistics } from "../controllers/public.controller.js";
import { getAllIncidents, getIncidentById, createIncident, updateIncident, closeIncident } from "../controllers/incident.controller.js";
import { getCorridors, computeRoute, recalculateAllRoutes, toggleRoadState, getSectorsClearance } from "../controllers/evacuation.controller.js";
import { getAllShelters, getShelterById, registerEvacueeIntake, createSupplyRequest, updateVolunteerRoster } from "../controllers/shelter.controller.js";
import { getAllTeams, getAllMissions, getActiveMissionDetails, updateMissionStatus, submitIncidentReport, autoAllocateMissions } from "../controllers/rescue.controller.js";
import { getAllHospitals, getHospitalDetails, declareHospitalDiversion, addTriageCase, registerAmbulanceArrival } from "../controllers/hospital.controller.js";
import { getCitizenProfile, updateChecklist, updateFamilyCheckin, submitSOS, syncOfflineQueue } from "../controllers/citizen.controller.js";
import { getAnalyticsOverview, getAlgorithmBenchmark, getAuditLogs } from "../controllers/analytics.controller.js";
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

// --- Public Endpoints ---
apiRouter.get("/public/status", getPublicStatus);
apiRouter.get("/public/incidents", getPublicIncidents);
apiRouter.get("/public/alerts", getPublicAlerts);
apiRouter.get("/public/statistics", getPublicStatistics);

// --- Incidents & Hazards ---
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

// --- Shelters & Intake ---
apiRouter.get("/shelters", getAllShelters);
apiRouter.get("/shelters/:id", getShelterById);
apiRouter.post("/shelters/:id/intake", optionalAuthenticate, registerEvacueeIntake);
apiRouter.post("/shelters/:id/supply-requests", optionalAuthenticate, createSupplyRequest);
apiRouter.post("/shelters/:id/volunteers", optionalAuthenticate, updateVolunteerRoster);

// --- Rescue & Missions ---
apiRouter.get("/rescue/teams", getAllTeams);
apiRouter.get("/rescue/missions", getAllMissions);
apiRouter.get("/rescue/active", getActiveMissionDetails);
apiRouter.patch("/rescue/missions/:id/status", optionalAuthenticate, updateMissionStatus);
apiRouter.post("/rescue/missions/:id/reports", optionalAuthenticate, submitIncidentReport);
apiRouter.post("/rescue/auto-allocate", optionalAuthenticate, autoAllocateMissions);

// --- Hospitals & Triage ---
apiRouter.get("/hospitals", getAllHospitals);
apiRouter.get("/hospitals/:id", getHospitalDetails);
apiRouter.post("/hospitals/:id/diversion", optionalAuthenticate, declareHospitalDiversion);
apiRouter.post("/hospitals/:id/triage", optionalAuthenticate, addTriageCase);
apiRouter.post("/hospitals/:id/ambulances", optionalAuthenticate, registerAmbulanceArrival);

// --- Citizen & SOS ---
apiRouter.get("/citizens/me", optionalAuthenticate, getCitizenProfile);
apiRouter.patch("/citizens/me/checklist", optionalAuthenticate, updateChecklist);
apiRouter.post("/citizens/me/family/checkin", optionalAuthenticate, updateFamilyCheckin);
apiRouter.post("/sos", optionalAuthenticate, submitSOS);
apiRouter.post("/offline/sync", optionalAuthenticate, syncOfflineQueue);

// --- Analytics & Evaluation ---
apiRouter.get("/analytics/overview", getAnalyticsOverview);
apiRouter.get("/analytics/benchmark", getAlgorithmBenchmark);
apiRouter.get("/analytics/audit-logs", optionalAuthenticate, getAuditLogs);
