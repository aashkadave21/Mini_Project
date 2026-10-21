export type UserRole =
  | "CITIZEN"
  | "RESCUE_TEAM"
  | "SHELTER_ADMIN"
  | "HOSPITAL_STAFF"
  | "CONTROL_CENTRE_ADMIN";

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  associatedEntityId?: string; // e.g. Shelter ID 'SH-01', Team 'T1', Hospital 'HSP-1', Citizen 'CIT-1'
  createdAt: string;
}

export interface Incident {
  id: string;
  title: string;
  type: "flood" | "fire" | "collapse" | "medical" | "landslide" | "chemical";
  severity: "critical" | "warning" | "info" | "success";
  sector: string;
  reported: string;
  victims: number;
  status: "unassigned" | "dispatched" | "on-scene" | "resolved" | "cancelled";
  pos: [number, number];
  description?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HazardZone {
  id: string;
  kind: "flood" | "fire" | "chemical" | "landslide";
  label: string;
  severity: "critical" | "warning" | "info";
  ring: [number, number][];
  penaltyWeight: number;
}

export interface Shelter {
  id: string;
  name: string;
  capacity: number;
  occupancy: number;
  incoming: number;
  medical: boolean;
  status: "open" | "near-full" | "full";
  pos: [number, number];
  waterStock: number;
  foodStock: number;
  blanketsStock: number;
  medicalKitsStock: number;
  sanitationStock: number;
  lastUpdated: string;
}

export interface Evacuee {
  id: string;
  shelterId: string;
  batchId?: string;
  fullName: string;
  familyCount: number;
  originSector: string;
  mobilityNeeds: string;
  specialNeeds?: string;
  registeredAt: string;
}

export interface Volunteer {
  id: string;
  shelterId: string;
  name: string;
  role: string;
  shift: string;
  tone: "success" | "warning" | "info";
  available: boolean;
}

export interface SupplyRequest {
  id: string;
  shelterId: string;
  resource: string;
  quantity: number;
  urgency: "Critical (< 2 h)" | "High (< 6 h)" | "Routine";
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "FULFILLING" | "FULFILLED" | "REJECTED" | "CANCELLED";
  submittedBy: string;
  approvedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RescueTeam {
  id: string;
  callsign: string;
  unit: string;
  members: number;
  status: "available" | "en-route" | "on-scene" | "returning" | "offline";
  mission: string | null;
  fuel: number;
  eta: string;
  pos: [number, number];
  updatedAt: string;
}

export interface RescueMission {
  id: string;
  incidentId: string;
  assignedTeamId?: string;
  status: "PENDING" | "ASSIGNED" | "EN_ROUTE" | "ON_SCENE" | "COMPLETED" | "CANCELLED";
  victimsCount: number;
  triageSummary: { red: number; yellow: number; green: number };
  notes?: string;
  outcomeReport?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Victim {
  id: string;
  missionId: string;
  name: string;
  triage: "Red" | "Yellow" | "Green";
  note: string;
  status: "trapped" | "triage" | "evacuated" | "hospitalized";
  tone: "critical" | "warning" | "success";
}

export interface Hospital {
  id: string;
  name: string;
  beds: number;
  bedsFree: number;
  icu: number;
  icuFree: number;
  incoming: number;
  triageLoad: number;
  diversion: boolean;
  diversionReason?: string;
  pos: [number, number];
  updatedAt: string;
}

export interface TriageCase {
  id: string;
  hospitalId: string;
  tag: "Red" | "Yellow" | "Green";
  desc: string;
  wait: string;
  arrivalTime: string;
  status: "WAITING" | "IN_TREATMENT" | "DISCHARGED" | "TRANSFERRED";
}

export interface AmbulanceArrival {
  id: string;
  hospitalId: string;
  unit: string;
  eta: string;
  triage: "Red" | "Yellow" | "Green";
  cases: number;
  tone: "critical" | "warning" | "success";
  arrived: boolean;
}

export interface BloodStock {
  group: string;
  units: number;
  min: number;
}

export interface RoadSegment {
  id: string;
  name: string;
  state: "blocked" | "flooded" | "congested" | "clear";
  startNode: string;
  endNode: string;
  distanceKm: number;
  baseTimeMin: number;
  path: [number, number][];
}

export interface RoadNode {
  id: string;
  label: string;
  pos: [number, number];
}

export interface EvacuationRoute {
  id: string;
  label: string;
  originSector: string;
  destinationShelterId: string;
  distanceKm: number;
  travelTimeMin: number;
  hazardExposureScore: number;
  path: [number, number][];
  diversions: number;
  algorithm: "Dijkstra" | "A*";
  segments: string[];
  updatedAt: string;
}

export interface CitizenProfile {
  id: string;
  userId: string;
  fullName: string;
  sector: string;
  evacuationOrder: "MANDATORY" | "ADVISORY" | "STANDBY" | "NONE";
  assignedShelterId: string;
  distanceKm: number;
  etaMinutes: number;
  bloodGroup: string;
  conditions: string;
  medication: string;
  emergencyContact: string;
  checklist: { item: string; checked: boolean }[];
  family: { id: string; name: string; status: string; tone: "success" | "warning" | "critical"; lastReported: string }[];
  connectivityStatus: "ONLINE" | "OFFLINE_SYNCED" | "OFFLINE_LOCAL";
}

export interface SOSRequest {
  id: string;
  citizenId?: string;
  senderName: string;
  sector: string;
  pos?: [number, number];
  headcount: number;
  medicalUrgency: boolean;
  notes?: string;
  status: "RECEIVED" | "TRIAGED" | "DISPATCHED" | "RESOLVED";
  assignedTeamId?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  details?: Record<string, unknown>;
}
