import { useEffect, useRef } from "react";
import L from "leaflet";
import {
  CITY_CENTER,
  evacRoutes as fallbackRoutes,
  hazardZones as fallbackHazards,
  hospitals as fallbackHospitals,
  incidents as fallbackIncidents,
  roads as fallbackRoads,
  shelters as fallbackShelters,
  teams as fallbackTeams,
} from "@/lib/sdrep-data";

const cssVar = (name: string, fallback = "#38bdf8") => {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
};

function markerIcon(color: string, glyph: string, pulse = false) {
  return L.divIcon({
    className: "",
    html: `<div style="
      display:grid;place-items:center;width:28px;height:28px;border-radius:50%;
      background:color-mix(in oklab, ${color} 30%, transparent);
      border:1.5px solid ${color};color:${color};
      font:700 11px/1 'JetBrains Mono',monospace;
      box-shadow:0 0 12px color-mix(in oklab, ${color} 50%, transparent);
      cursor:pointer;
      ${pulse ? "animation:pulse-ring 2s infinite;" : ""}
    ">${glyph}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function pinIcon(color = "#f59e0b") {
  return L.divIcon({
    className: "",
    html: `<div style="
      display:grid;place-items:center;width:34px;height:34px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      background:${color};
      border:2px solid #ffffff;
      box-shadow:0 2px 10px rgba(0,0,0,0.5);
      cursor:pointer;
    "><div style="width:10px;height:10px;border-radius:50%;background:#ffffff;transform:rotate(45deg);"></div></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
}

export interface TacticalMapProps {
  height?: string;
  layers?: {
    hazards?: boolean;
    roads?: boolean;
    routes?: boolean;
    shelters?: boolean;
    hospitals?: boolean;
    teams?: boolean;
    incidents?: boolean;
    clusters?: boolean;
    reachability?: boolean;
  };
  zoom?: number;
  center?: [number, number];
  incidents?: any[];
  roads?: any[];
  routes?: any[];
  shelters?: any[];
  hospitals?: any[];
  teams?: any[];
  hazardZones?: any[];
  highlightRoute?: [number, number][];
  highlightRouteLabel?: string;
  comparisonRoute?: [number, number][];
  comparisonRouteLabel?: string;
  clusters?: { center: [number, number]; radiusKm: number; label: string; risk: string }[];
  isolatedNodes?: { id: string; label: string; pos: [number, number]; isolated: boolean }[];
  interactivePin?: [number, number] | null;
  onMapClick?: (latlng: [number, number]) => void;
  onRoadClick?: (road: any) => void;
  onIncidentClick?: (incident: any) => void;
}

export default function TacticalMap({
  height = "100%",
  layers,
  zoom = 13,
  center = CITY_CENTER,
  incidents,
  roads,
  routes,
  shelters,
  hospitals,
  teams,
  hazardZones,
  highlightRoute,
  highlightRouteLabel,
  comparisonRoute,
  comparisonRouteLabel,
  clusters,
  isolatedNodes,
  interactivePin,
  onMapClick,
  onRoadClick,
  onIncidentClick,
}: TacticalMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Layer groups for dynamic lifecycle
  const groupsRef = useRef<{
    hazards: L.LayerGroup;
    roads: L.LayerGroup;
    routes: L.LayerGroup;
    shelters: L.LayerGroup;
    hospitals: L.LayerGroup;
    teams: L.LayerGroup;
    incidents: L.LayerGroup;
    clusters: L.LayerGroup;
    reachability: L.LayerGroup;
    highlight: L.LayerGroup;
    pin: L.LayerGroup;
  } | null>(null);

  // Initialize Map Once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    const hazardsGroup = L.layerGroup().addTo(map);
    const roadsGroup = L.layerGroup().addTo(map);
    const routesGroup = L.layerGroup().addTo(map);
    const sheltersGroup = L.layerGroup().addTo(map);
    const hospitalsGroup = L.layerGroup().addTo(map);
    const teamsGroup = L.layerGroup().addTo(map);
    const incidentsGroup = L.layerGroup().addTo(map);
    const clustersGroup = L.layerGroup().addTo(map);
    const reachabilityGroup = L.layerGroup().addTo(map);
    const highlightGroup = L.layerGroup().addTo(map);
    const pinGroup = L.layerGroup().addTo(map);

    groupsRef.current = {
      hazards: hazardsGroup,
      roads: roadsGroup,
      routes: routesGroup,
      shelters: sheltersGroup,
      hospitals: hospitalsGroup,
      teams: teamsGroup,
      incidents: incidentsGroup,
      clusters: clustersGroup,
      reachability: reachabilityGroup,
      highlight: highlightGroup,
      pin: pinGroup,
    };

    map.on("click", (e) => {
      onMapClick?.([Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5))]);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      groupsRef.current = null;
    };
  }, []);

  // Update center/zoom if requested
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.setView(center, zoom, { animate: true });
    }
  }, [center, zoom]);

  // Update Dynamic Layers when props change
  useEffect(() => {
    if (!mapRef.current || !groupsRef.current) return;

    const g = groupsRef.current;
    const on = {
      hazards: true,
      roads: true,
      routes: true,
      shelters: true,
      hospitals: true,
      teams: true,
      incidents: true,
      clusters: true,
      reachability: true,
      ...layers,
    };

    const c = {
      critical: cssVar("--critical", "#ef4444"),
      warning: cssVar("--warning", "#f59e0b"),
      success: cssVar("--success", "#22c55e"),
      info: cssVar("--info", "#38bdf8"),
      flood: cssVar("--flood", "#3b82f6"),
      fire: cssVar("--fire", "#f97316"),
      accent: cssVar("--accent", "#22d3ee"),
    };

    // 1. Hazards
    g.hazards.clearLayers();
    if (on.hazards) {
      const activeHazards = hazardZones && hazardZones.length > 0 ? hazardZones : fallbackHazards;
      activeHazards.forEach((z) => {
        const color = z.kind === "flood" ? c.flood : c.fire;
        L.polygon(z.ring, {
          color,
          weight: 1.5,
          fillColor: color,
          fillOpacity: 0.18,
          dashArray: "6 4",
        })
          .bindTooltip(`${z.label} (${z.severity?.toUpperCase() || "ALERT"})`, { sticky: true })
          .addTo(g.hazards);
      });
    }

    // 2. Road Network
    g.roads.clearLayers();
    if (on.roads) {
      const activeRoads = roads && roads.length > 0 ? roads : fallbackRoads;
      const roadColor: Record<string, string> = {
        blocked: c.critical,
        flooded: c.flood,
        congested: c.warning,
        clear: c.success,
      };
      activeRoads.forEach((r) => {
        const poly = L.polyline(r.path, {
          color: roadColor[r.state] || c.success,
          weight: r.state === "blocked" ? 6 : 5,
          opacity: 0.88,
          dashArray: r.state === "clear" ? undefined : "8 5",
        });

        poly.bindTooltip(
          `<strong>${r.name}</strong><br/>Status: <span style="font-weight:700;text-transform:uppercase;">${r.state}</span> · ${r.distanceKm} km`,
          { sticky: true }
        );

        poly.on("click", () => {
          onRoadClick?.(r);
        });

        poly.addTo(g.roads);
      });
    }

    // 3. Evacuation Corridors
    g.routes.clearLayers();
    if (on.routes) {
      const activeRoutes = routes && routes.length > 0 ? routes : fallbackRoutes;
      activeRoutes.forEach((r) => {
        L.polyline(r.path, { color: c.accent, weight: 3, opacity: 0.9 })
          .bindTooltip(`${r.label || r.id} · ${r.distanceKm?.toFixed(1)} km (${r.travelTimeMin} min)`, { sticky: true })
          .addTo(g.routes);
      });
    }

    // 4. Shelters
    g.shelters.clearLayers();
    if (on.shelters) {
      const activeShelters = shelters && shelters.length > 0 ? shelters : fallbackShelters;
      activeShelters.forEach((s) => {
        const color = s.status === "full" ? c.critical : s.status === "near-full" ? c.warning : c.success;
        L.marker(s.pos, { icon: markerIcon(color, "S") })
          .bindPopup(
            `<div style="font-family:sans-serif;font-size:12px;min-width:180px;">
              <strong style="font-size:13px;color:#0f172a;">${s.name}</strong><br/>
              <span style="color:#64748b;">ID: ${s.id} · Status: <strong>${s.status.toUpperCase()}</strong></span><hr style="margin:4px 0;border:0;border-top:1px solid #e2e8f0;"/>
              <div>Capacity: <strong>${s.occupancy}/${s.capacity}</strong> (${Math.round((s.occupancy / s.capacity) * 100)}%)</div>
              <div>Incoming evacuees: <strong>${s.incoming || 0}</strong></div>
              <div>Medical Clinic: <strong>${s.medical ? "Equipped" : "None"}</strong></div>
            </div>`
          )
          .addTo(g.shelters);
      });
    }

    // 5. Hospitals
    g.hospitals.clearLayers();
    if (on.hospitals) {
      const activeHospitals = hospitals && hospitals.length > 0 ? hospitals : fallbackHospitals;
      activeHospitals.forEach((h) => {
        const isDiverting = Boolean(h.diversion || h.bedsFree === 0);
        const color = isDiverting ? c.critical : c.info;
        L.marker(h.pos, { icon: markerIcon(color, "H", isDiverting) })
          .bindPopup(
            `<div style="font-family:sans-serif;font-size:12px;min-width:190px;">
              <strong style="font-size:13px;color:#0f172a;">${h.name}</strong><br/>
              <span style="color:${isDiverting ? "#ef4444" : "#0284c7"};font-weight:700;">
                ${isDiverting ? "DIVERSION / CRITICAL SURGE" : "ACCEPTING CASUALTIES"}
              </span><hr style="margin:4px 0;border:0;border-top:1px solid #e2e8f0;"/>
              <div>Available Free Beds: <strong style="color:${h.bedsFree === 0 ? "#ef4444" : "inherit"};">${h.bedsFree}</strong> / ${h.beds || 640}</div>
              <div>ICU Beds Free: <strong>${h.icuFree}</strong> / ${h.icu || 48}</div>
              <div>Inbound Ambulances: <strong>${h.incoming || 0}</strong></div>
            </div>`
          )
          .addTo(g.hospitals);
      });
    }

    // 6. Rescue Teams & Vehicles
    g.teams.clearLayers();
    if (on.teams) {
      const activeTeams = teams && teams.length > 0 ? teams : fallbackTeams;
      activeTeams.forEach((t) => {
        const isDeployed = t.status !== "available";
        const color = t.status === "available" ? c.success : t.status === "on-scene" ? c.warning : c.accent;
        L.marker(t.pos, { icon: markerIcon(color, t.callsign.slice(0, 1), t.status === "on-scene") })
          .bindPopup(
            `<div style="font-family:sans-serif;font-size:12px;min-width:180px;">
              <strong style="font-size:13px;color:#0f172a;">${t.callsign} (${t.unit})</strong><br/>
              <span style="color:#64748b;">Status: <strong>${t.status.toUpperCase()}</strong> · Fuel: ${t.fuel}%</span><hr style="margin:4px 0;border:0;border-top:1px solid #e2e8f0;"/>
              <div>Responders: <strong>${t.members}</strong></div>
              <div>Active Mission: <strong>${t.mission || "None (Awaiting Tasking)"}</strong></div>
            </div>`
          )
          .addTo(g.teams);
      });
    }

    // 7. Active Incidents & Citizen SOS (ACCURATE & PERSISTENT)
    g.incidents.clearLayers();
    if (on.incidents) {
      const activeIncidents = incidents !== undefined ? incidents : fallbackIncidents;
      activeIncidents.forEach((i) => {
        if (!i.pos || !Array.isArray(i.pos) || i.pos.length !== 2) return;
        const color = i.severity === "critical" ? c.critical : i.severity === "warning" ? c.warning : c.info;
        const isSOS = i.id.startsWith("SOS-") || (i.title && i.title.includes("SOS"));

        // Outer casualty perimeter circle
        L.circle(i.pos, {
          radius: isSOS ? 320 : 250,
          color,
          weight: isSOS ? 2 : 1,
          fillColor: color,
          fillOpacity: isSOS ? 0.22 : 0.12,
          dashArray: isSOS ? "4 3" : undefined,
        }).addTo(g.incidents);

        const marker = L.marker(i.pos, {
          icon: markerIcon(color, isSOS ? "SOS" : "!", i.severity === "critical" || isSOS),
        });

        marker.bindPopup(
          `<div style="font-family:sans-serif;font-size:12px;min-width:210px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <strong style="font-size:13px;color:#0f172a;">${i.id}</strong>
              <span style="background:${color}22;color:${color};font-weight:700;font-size:10px;padding:2px 6px;border-radius:4px;text-transform:uppercase;">${i.severity}</span>
            </div>
            <p style="margin:4px 0 2px 0;font-weight:600;color:#1e293b;">${i.title}</p>
            <div style="color:#64748b;font-size:11px;">Sector: <strong>${i.sector}</strong> · Reported: ${i.reported}</div>
            <div style="color:#64748b;font-size:11px;">Coordinates: <code style="background:#f1f5f9;padding:1px 4px;border-radius:2px;">[${i.pos[0].toFixed(4)}, ${i.pos[1].toFixed(4)}]</code></div>
            <div style="color:#64748b;font-size:11px;">Victims affected: <strong style="color:#0f172a;">${i.victims || 1}</strong></div>
            <div style="color:#64748b;font-size:11px;">Status: <strong style="color:${i.status === "unassigned" ? "#ef4444" : "#059669"};text-transform:uppercase;">${i.status}</strong></div>
            ${i.description ? `<p style="margin:4px 0 0 0;font-size:11px;color:#475569;border-top:1px dashed #cbd5e1;padding-top:4px;">${i.description}</p>` : ""}
          </div>`
        );

        marker.on("click", () => {
          onIncidentClick?.(i);
        });

        marker.addTo(g.incidents);
      });
    }

    // 8. Congestion Clusters (Scenario D)
    g.clusters.clearLayers();
    if (on.clusters && clusters && clusters.length > 0) {
      clusters.forEach((cl) => {
        L.circle(cl.center, {
          radius: cl.radiusKm * 1000,
          color: c.warning,
          weight: 2,
          fillColor: c.warning,
          fillOpacity: 0.25,
          dashArray: "6 4",
        })
          .bindTooltip(`<strong>Congestion Zone</strong><br/>${cl.label} · Risk: ${cl.risk}`, { sticky: true })
          .addTo(g.clusters);

        L.marker(cl.center, {
          icon: markerIcon(c.warning, "CZ"),
        })
          .bindPopup(`<strong>Congestion Cluster: ${cl.label}</strong><br/>Staging Buffer: ${(cl.radiusKm * 1000).toFixed(0)}m`)
          .addTo(g.clusters);
      });
    }

    // 9. Reachability & Isolated Nodes (Scenario H)
    g.reachability.clearLayers();
    if (on.reachability && isolatedNodes && isolatedNodes.length > 0) {
      isolatedNodes.forEach((node) => {
        const isIso = node.isolated;
        const color = isIso ? c.critical : c.success;
        L.circleMarker(node.pos, {
          radius: isIso ? 8 : 5,
          color,
          fillColor: color,
          fillOpacity: isIso ? 0.9 : 0.6,
          weight: isIso ? 2 : 1,
        })
          .bindTooltip(`<strong>${node.label}</strong><br/>Reachability: ${isIso ? "ISOLATED / DISCONNECTED" : "CONNECTED"}`, {
            sticky: true,
          })
          .addTo(g.reachability);
      });
    }

    // 10. Selected & Comparison Route Polylines (Scenario A & D)
    g.highlight.clearLayers();
    if (highlightRoute && highlightRoute.length > 0) {
      L.polyline(highlightRoute, {
        color: "#06b6d4",
        weight: 6,
        opacity: 0.95,
      })
        .bindTooltip(highlightRouteLabel || "Recalculated Alternative Path", { sticky: true })
        .addTo(g.highlight);
    }
    if (comparisonRoute && comparisonRoute.length > 0) {
      L.polyline(comparisonRoute, {
        color: "#a855f7",
        weight: 4,
        opacity: 0.8,
        dashArray: "8 6",
      })
        .bindTooltip(comparisonRouteLabel || "Original Path (Pre-Blockage)", { sticky: true })
        .addTo(g.highlight);
    }

    // 11. Interactive Pin for Location Pinning (Citizen SOS / Landmark Finder)
    g.pin.clearLayers();
    if (interactivePin) {
      L.marker(interactivePin, { icon: pinIcon("#f59e0b") })
        .bindPopup(
          `<div style="font-family:sans-serif;font-size:12px;">
            <strong>Pinned Location</strong><br/>
            <code>[${interactivePin[0].toFixed(5)}, ${interactivePin[1].toFixed(5)}]</code><br/>
            <span style="color:#64748b;font-size:11px;">Coordinates resolved for SOS transmission.</span>
          </div>`
        )
        .addTo(g.pin);
    }
  }, [
    layers,
    incidents,
    roads,
    routes,
    shelters,
    hospitals,
    teams,
    hazardZones,
    highlightRoute,
    highlightRouteLabel,
    comparisonRoute,
    comparisonRouteLabel,
    clusters,
    isolatedNodes,
    interactivePin,
    onMapClick,
    onRoadClick,
    onIncidentClick,
  ]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%", maxHeight: "100%" }}
      className="tactical-map-container relative isolate z-[1] w-full overflow-hidden rounded-lg border border-border"
    />
  );
}
