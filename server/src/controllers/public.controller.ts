import type { Request, Response } from "express";
import { db } from "../db/db.js";

export async function getPublicStatus(_req: Request, res: Response): Promise<void> {
  const activeIncidents = db.state.incidents.filter((i) => i.status !== "resolved" && i.status !== "cancelled");
  const criticalIncidents = activeIncidents.filter((i) => i.severity === "critical");
  const openShelters = db.state.shelters.filter((s) => s.status !== "full");
  const freeBeds = db.state.hospitals.reduce((acc, h) => acc + h.bedsFree, 0);

  // Determine alert level from real data
  let alertLevel = "GREEN";
  if (criticalIncidents.length >= 3 || activeIncidents.length > 8) {
    alertLevel = "RED ALERT";
  } else if (criticalIncidents.length >= 1 || activeIncidents.length > 4) {
    alertLevel = "ORANGE ALERT";
  } else if (activeIncidents.length > 0) {
    alertLevel = "YELLOW ALERT";
  }

  res.json({
    success: true,
    data: {
      alertLevel,
      cycloneName: "Cyclone Marut",
      summary: {
        activeIncidentsCount: activeIncidents.length,
        criticalZonesCount: criticalIncidents.length,
        openSheltersCount: openShelters.length,
        availableBedsCount: freeBeds,
        rainfall: "88 mm/h",
        windSpeed: "46 km/h",
        meshConnectivity: "92%",
        systemsNominal: true,
      },
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function getPublicIncidents(_req: Request, res: Response): Promise<void> {
  const publicData = db.state.incidents.map((i) => ({
    id: i.id,
    title: i.title,
    type: i.type,
    severity: i.severity,
    sector: i.sector,
    reported: i.reported,
    victims: i.victims,
    status: i.status,
    pos: i.pos,
  }));

  res.json({ success: true, data: publicData });
}

export async function getPublicAlerts(_req: Request, res: Response): Promise<void> {
  // Derive alerts from real active incidents — no hardcoded strings
  const activeIncidents = db.state.incidents.filter((i) => i.status !== "resolved" && i.status !== "cancelled");
  const activeHazards = db.state.hazards;

  const alerts: {
    id: string;
    tone: "critical" | "warning" | "info";
    tag: string;
    title: string;
    message: string;
    timestamp: string;
  }[] = [];

  // Critical incidents become mandatory alerts
  activeIncidents
    .filter((i) => i.severity === "critical")
    .slice(0, 3)
    .forEach((inc) => {
      alerts.push({
        id: `ALT-INC-${inc.id}`,
        tone: "critical",
        tag: "Mandatory",
        title: `Critical Incident: ${inc.title}`,
        message: `${inc.title} — ${inc.sector}. ${inc.victims > 0 ? `${inc.victims} persons affected.` : ""} Follow evacuation orders immediately.`,
        timestamp: inc.createdAt || new Date().toISOString(),
      });
    });

  // Warning incidents become advisory alerts
  activeIncidents
    .filter((i) => i.severity === "warning")
    .slice(0, 2)
    .forEach((inc) => {
      alerts.push({
        id: `ALT-WARN-${inc.id}`,
        tone: "warning",
        tag: "Advisory",
        title: `Warning: ${inc.title}`,
        message: `${inc.title} in ${inc.sector}. ${inc.description || "Avoid the area and follow instructions from officials."}`,
        timestamp: inc.createdAt || new Date().toISOString(),
      });
    });

  // Hazard zone alerts
  activeHazards.slice(0, 2).forEach((hz) => {
    alerts.push({
      id: `ALT-HZ-${hz.id}`,
      tone: hz.severity === "critical" ? "critical" : hz.severity === "warning" ? "warning" : "info",
      tag: "Hazard",
      title: `Hazard Zone Active: ${hz.label}`,
      message: `${hz.label}. Keep clear of the marked hazard zone and follow official guidance.`,
      timestamp: new Date().toISOString(),
    });
  });

  // Shelter availability info alert (always useful)
  const openShelters = db.state.shelters.filter((s) => s.status === "open");
  const nearFullShelters = db.state.shelters.filter((s) => s.status === "near-full");
  const fullShelters = db.state.shelters.filter((s) => s.status === "full");

  if (openShelters.length > 0) {
    alerts.push({
      id: "ALT-SHELTER-STATUS",
      tone: "info",
      tag: "Information",
      title: "Shelter Availability Update",
      message: `${openShelters.length} shelter(s) accepting arrivals: ${openShelters.map((s) => s.name).join(", ")}.${nearFullShelters.length > 0 ? ` ${nearFullShelters.length} near capacity.` : ""}${fullShelters.length > 0 ? ` ${fullShelters.length} at full capacity.` : ""}`,
      timestamp: new Date().toISOString(),
    });
  }

  res.json({ success: true, data: alerts });
}

export async function getPublicStatistics(_req: Request, res: Response): Promise<void> {
  const totalShelterCapacity = db.state.shelters.reduce((acc, s) => acc + s.capacity, 0);
  const totalShelterOccupancy = db.state.shelters.reduce((acc, s) => acc + s.occupancy, 0);
  const totalIncoming = db.state.shelters.reduce((acc, s) => acc + s.incoming, 0);

  const totalBeds = db.state.hospitals.reduce((acc, h) => acc + h.beds, 0);
  const freeBeds = db.state.hospitals.reduce((acc, h) => acc + h.bedsFree, 0);
  const totalICU = db.state.hospitals.reduce((acc, h) => acc + h.icu, 0);
  const freeICU = db.state.hospitals.reduce((acc, h) => acc + h.icuFree, 0);

  const deployedTeams = db.state.rescueTeams.filter((t) => t.status !== "available").length;

  // People evacuated = total occupancy across all shelters (real registered count)
  const peopleEvacuated = totalShelterOccupancy;

  // Pending evacuation = sum of incoming across all active evacuation corridors (approximate)
  const pendingEvacuation = totalIncoming + db.state.sosRequests.filter((s) => s.status === "RECEIVED" || s.status === "DISPATCHED").length;

  // Average response time — calculated from completed missions where timestamps are available
  const completedMissions = db.state.rescueMissions.filter((m) => m.status === "COMPLETED" && m.completedAt && m.createdAt);
  const avgResponseMinutes =
    completedMissions.length > 0
      ? Math.round(
          (completedMissions.reduce((acc, m) => {
            const created = new Date(m.createdAt).getTime();
            const completed = new Date(m.completedAt!).getTime();
            return acc + (completed - created) / 60000;
          }, 0) /
            completedMissions.length) *
            10
        ) / 10
      : null;

  res.json({
    success: true,
    data: {
      activeIncidents: db.state.incidents.filter((i) => i.status !== "resolved" && i.status !== "cancelled").length,
      peopleEvacuated,
      pendingEvacuation,
      teamsDeployed: `${deployedTeams}/${db.state.rescueTeams.length}`,
      avgResponseMinutes,
      shelterLoadPercent: totalShelterCapacity > 0 ? Math.round((totalShelterOccupancy / totalShelterCapacity) * 100) : 0,
      totalShelterCapacity,
      totalShelterOccupancy,
      totalIncoming,
      hospitalCapacity: {
        totalBeds,
        freeBeds,
        totalICU,
        freeICU,
      },
    },
  });
}
