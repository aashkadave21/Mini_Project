// Mock operational data for SDREP. Frontend-only demo dataset.

export type Severity = "critical" | "warning" | "info" | "success";

export const CITY_CENTER: [number, number] = [19.076, 72.8777];

export interface Incident {
  id: string;
  title: string;
  type: "flood" | "fire" | "collapse" | "medical" | "landslide" | "chemical";
  severity: Severity;
  sector: string;
  reported: string;
  victims: number;
  status: "unassigned" | "dispatched" | "on-scene" | "resolved";
  pos: [number, number];
}

export const incidents: Incident[] = [
  { id: "INC-4471", title: "Sector 7 embankment breach", type: "flood", severity: "critical", sector: "Sector 7 · Riverside", reported: "00:04", victims: 128, status: "dispatched", pos: [19.092, 72.862] },
  { id: "INC-4468", title: "Warehouse fire, dock road", type: "fire", severity: "critical", sector: "Sector 3 · Port", reported: "00:11", victims: 24, status: "on-scene", pos: [19.062, 72.848] },
  { id: "INC-4465", title: "Residential block partial collapse", type: "collapse", severity: "warning", sector: "Sector 12 · Old Town", reported: "00:26", victims: 41, status: "dispatched", pos: [19.083, 72.895] },
  { id: "INC-4462", title: "Dialysis patients stranded", type: "medical", severity: "warning", sector: "Sector 9 · Civic", reported: "00:38", victims: 12, status: "unassigned", pos: [19.07, 72.905] },
  { id: "INC-4459", title: "Hillside slip near bypass", type: "landslide", severity: "info", sector: "Sector 18 · North Ridge", reported: "01:02", victims: 3, status: "on-scene", pos: [19.105, 72.888] },
  { id: "INC-4455", title: "Ammonia leak, cold storage", type: "chemical", severity: "critical", sector: "Sector 3 · Port", reported: "01:19", victims: 9, status: "dispatched", pos: [19.056, 72.861] },
];

export interface Shelter {
  id: string;
  name: string;
  capacity: number;
  occupancy: number;
  incoming: number;
  medical: boolean;
  status: "open" | "near-full" | "full";
  pos: [number, number];
}

export const shelters: Shelter[] = [
  { id: "SH-01", name: "Municipal Stadium Relief Camp", capacity: 2400, occupancy: 1876, incoming: 220, medical: true, status: "near-full", pos: [19.088, 72.874] },
  { id: "SH-02", name: "Govt. Higher Secondary School", capacity: 900, occupancy: 902, incoming: 60, medical: false, status: "full", pos: [19.068, 72.882] },
  { id: "SH-03", name: "Community Hall, Sector 12", capacity: 640, occupancy: 311, incoming: 45, medical: true, status: "open", pos: [19.079, 72.9] },
  { id: "SH-04", name: "North Ridge Sports Complex", capacity: 1500, occupancy: 402, incoming: 130, medical: false, status: "open", pos: [19.104, 72.87] },
  { id: "SH-05", name: "Dockyard Workers Union Hall", capacity: 520, occupancy: 498, incoming: 18, medical: false, status: "near-full", pos: [19.058, 72.855] },
];

export interface Hospital {
  id: string;
  name: string;
  beds: number;
  bedsFree: number;
  icu: number;
  icuFree: number;
  incoming: number;
  triageLoad: number;
  pos: [number, number];
}

export const hospitals: Hospital[] = [
  { id: "HSP-1", name: "City General Hospital", beds: 640, bedsFree: 72, icu: 48, icuFree: 5, incoming: 14, triageLoad: 88, pos: [19.075, 72.877] },
  { id: "HSP-2", name: "Riverside Trauma Centre", beds: 220, bedsFree: 18, icu: 22, icuFree: 1, incoming: 9, triageLoad: 94, pos: [19.094, 72.868] },
  { id: "HSP-3", name: "North Ridge Multispecialty", beds: 380, bedsFree: 141, icu: 30, icuFree: 11, incoming: 4, triageLoad: 52, pos: [19.101, 72.893] },
];

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
}

export const teams: RescueTeam[] = [
  { id: "T1", callsign: "ALPHA-1", unit: "NDRF Water Rescue", members: 8, status: "on-scene", mission: "INC-4471", fuel: 62, eta: "—", pos: [19.09, 72.864] },
  { id: "T2", callsign: "BRAVO-2", unit: "Fire & Rescue", members: 6, status: "en-route", mission: "INC-4468", fuel: 41, eta: "4 min", pos: [19.066, 72.853] },
  { id: "T3", callsign: "CHARLIE-3", unit: "Urban Search & Rescue", members: 10, status: "en-route", mission: "INC-4465", fuel: 77, eta: "11 min", pos: [19.081, 72.889] },
  { id: "T4", callsign: "DELTA-4", unit: "Medical Response", members: 5, status: "available", mission: null, fuel: 90, eta: "—", pos: [19.072, 72.9] },
  { id: "T5", callsign: "ECHO-5", unit: "Coast Guard Air", members: 4, status: "returning", mission: null, fuel: 28, eta: "9 min", pos: [19.052, 72.874] },
  { id: "T6", callsign: "FOXTROT-6", unit: "Drone Recon", members: 2, status: "on-scene", mission: "INC-4459", fuel: 55, eta: "—", pos: [19.107, 72.885] },
];

export interface RoadSegment {
  id: string;
  name: string;
  state: "blocked" | "flooded" | "congested" | "clear";
  path: [number, number][];
}

export const roads: RoadSegment[] = [
  { id: "R1", name: "Riverside Arterial", state: "flooded", path: [[19.098, 72.856], [19.09, 72.866], [19.083, 72.872]] },
  { id: "R2", name: "Dock Road", state: "blocked", path: [[19.06, 72.844], [19.062, 72.856], [19.066, 72.866]] },
  { id: "R3", name: "Civic Ring Road", state: "congested", path: [[19.07, 72.9], [19.076, 72.889], [19.079, 72.878]] },
  { id: "R4", name: "North Bypass", state: "clear", path: [[19.108, 72.878], [19.096, 72.882], [19.086, 72.892]] },
];

export const evacRoutes: { id: string; label: string; path: [number, number][] }[] = [
  { id: "EVR-A", label: "Route A · Sector 7 → SH-01", path: [[19.092, 72.862], [19.089, 72.868], [19.088, 72.874]] },
  { id: "EVR-B", label: "Route B · Sector 3 → SH-04", path: [[19.062, 72.848], [19.078, 72.858], [19.095, 72.864], [19.104, 72.87]] },
  { id: "EVR-C", label: "Route C · Sector 12 → SH-03", path: [[19.083, 72.895], [19.081, 72.898], [19.079, 72.9]] },
];

export const hazardZones: {
  id: string;
  kind: "flood" | "fire";
  label: string;
  ring: [number, number][];
}[] = [
  {
    id: "HZ-1",
    kind: "flood",
    label: "Flood zone · 2.1 m",
    ring: [[19.1, 72.852], [19.102, 72.872], [19.086, 72.878], [19.08, 72.862]],
  },
  {
    id: "HZ-2",
    kind: "fire",
    label: "Fire perimeter · Port",
    ring: [[19.058, 72.842], [19.066, 72.846], [19.065, 72.858], [19.055, 72.856]],
  },
];

export const congestionTrend = [
  { t: "18:00", congestion: 34, throughput: 78 },
  { t: "19:00", congestion: 41, throughput: 72 },
  { t: "20:00", congestion: 58, throughput: 61 },
  { t: "21:00", congestion: 74, throughput: 48 },
  { t: "22:00", congestion: 82, throughput: 39 },
  { t: "23:00", congestion: 69, throughput: 52 },
  { t: "00:00", congestion: 61, throughput: 58 },
];

export const evacuationProgress = [
  { t: "18:00", evacuated: 1200, pending: 9800 },
  { t: "19:00", evacuated: 2600, pending: 8400 },
  { t: "20:00", evacuated: 4100, pending: 6900 },
  { t: "21:00", evacuated: 5900, pending: 5100 },
  { t: "22:00", evacuated: 7400, pending: 3600 },
  { t: "23:00", evacuated: 8600, pending: 2400 },
  { t: "00:00", evacuated: 9350, pending: 1650 },
];

export const responseTimes = [
  { sector: "S-3", minutes: 7.2 },
  { sector: "S-7", minutes: 11.8 },
  { sector: "S-9", minutes: 6.1 },
  { sector: "S-12", minutes: 9.4 },
  { sector: "S-18", minutes: 14.6 },
];

export const resourceConsumption = [
  { t: "18:00", water: 20, food: 14, fuel: 9, medical: 6 },
  { t: "20:00", water: 38, food: 27, fuel: 18, medical: 12 },
  { t: "22:00", water: 61, food: 44, fuel: 31, medical: 21 },
  { t: "00:00", water: 78, food: 59, fuel: 42, medical: 29 },
];

export const casualtyStats = [
  { name: "Green", value: 812 },
  { name: "Yellow", value: 264 },
  { name: "Red", value: 97 },
  { name: "Black", value: 18 },
];

export const dispatchLog = [
  { time: "00:41:12", actor: "OPS-2", action: "Dispatched CHARLIE-3", target: "INC-4465" },
  { time: "00:38:55", actor: "SYSTEM", action: "Route A recomputed (flood +0.3 m)", target: "EVR-A" },
  { time: "00:35:02", actor: "OPS-1", action: "Shelter SH-02 marked FULL", target: "SH-02" },
  { time: "00:31:47", actor: "OPS-3", action: "Air asset requested", target: "INC-4471" },
  { time: "00:28:19", actor: "SYSTEM", action: "Comms degraded · Sector 18 mesh", target: "NET" },
  { time: "00:22:04", actor: "OPS-2", action: "Ambulance AMB-14 assigned", target: "HSP-2" },
];

export const emergencyContacts = [
  { name: "National Emergency Number", number: "112", desc: "Single-window emergency response" },
  { name: "Disaster Management Cell", number: "1078", desc: "State disaster helpline, 24×7" },
  { name: "Fire & Rescue Services", number: "101", desc: "Fire, chemical and rescue incidents" },
  { name: "Ambulance / Medical", number: "108", desc: "Emergency medical dispatch" },
  { name: "Police Control Room", number: "100", desc: "Law and order, evacuation escort" },
  { name: "Coast Guard", number: "1554", desc: "Maritime search and rescue" },
  { name: "Women Helpline", number: "1091", desc: "Distress support during displacement" },
  { name: "Child Helpline", number: "1098", desc: "Separated and unaccompanied minors" },
];

export const preparednessGuides = [
  {
    title: "Before a disaster",
    points: [
      "Keep a 72-hour go-bag: water, dry food, torch, power bank, medicines.",
      "Photograph identity and property documents; store copies offline.",
      "Agree on one out-of-area contact for the whole family.",
      "Learn your sector code and the two nearest shelters on foot.",
    ],
  },
  {
    title: "During an evacuation",
    points: [
      "Follow the assigned route only — alternate roads may be submerged.",
      "Switch off mains electricity and gas before leaving the building.",
      "Carry a whistle; do not wade water deeper than knee height.",
      "Keep phones on low-power mode and check in at every waypoint.",
    ],
  },
  {
    title: "After reaching a shelter",
    points: [
      "Register at the intake desk so families can be reunited.",
      "Declare chronic conditions and medication needs immediately.",
      "Report missing persons with a recent photograph.",
      "Do not return home until your sector is cleared as SAFE.",
    ],
  },
];
