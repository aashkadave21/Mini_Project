import { useEffect, useRef } from "react";
import L from "leaflet";
import {
  CITY_CENTER,
  evacRoutes,
  hazardZones,
  hospitals,
  incidents,
  roads,
  shelters,
  teams,
} from "@/lib/sdrep-data";

const cssVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function markerIcon(color: string, glyph: string, pulse = false) {
  return L.divIcon({
    className: "",
    html: `<div style="
      display:grid;place-items:center;width:26px;height:26px;border-radius:50%;
      background:color-mix(in oklab, ${color} 28%, transparent);
      border:1.5px solid ${color};color:${color};
      font:600 11px/1 'JetBrains Mono',monospace;
      box-shadow:0 0 12px color-mix(in oklab, ${color} 45%, transparent);
      ${pulse ? "animation:pulse-ring 2s infinite;" : ""}
    ">${glyph}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
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
  };
  zoom?: number;
}

export default function TacticalMap({ height = "100%", layers, zoom = 13 }: TacticalMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const on = {
    hazards: true,
    roads: true,
    routes: true,
    shelters: true,
    hospitals: true,
    teams: true,
    incidents: true,
    ...layers,
  };

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, {
      center: CITY_CENTER,
      zoom,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    const c = {
      critical: cssVar("--critical") || "#ef4444",
      warning: cssVar("--warning") || "#f59e0b",
      success: cssVar("--success") || "#22c55e",
      info: cssVar("--info") || "#38bdf8",
      flood: cssVar("--flood") || "#3b82f6",
      fire: cssVar("--fire") || "#f97316",
      accent: cssVar("--accent") || "#22d3ee",
    };

    if (on.hazards) {
      hazardZones.forEach((z) => {
        const color = z.kind === "flood" ? c.flood : c.fire;
        L.polygon(z.ring, {
          color,
          weight: 1.5,
          fillColor: color,
          fillOpacity: 0.18,
          dashArray: "6 4",
        })
          .bindTooltip(z.label, { sticky: true })
          .addTo(map);
      });
    }

    if (on.roads) {
      const roadColor = { blocked: c.critical, flooded: c.flood, congested: c.warning, clear: c.success };
      roads.forEach((r) => {
        L.polyline(r.path, {
          color: roadColor[r.state],
          weight: 5,
          opacity: 0.85,
          dashArray: r.state === "clear" ? undefined : "10 6",
        })
          .bindTooltip(`${r.name} · ${r.state.toUpperCase()}`, { sticky: true })
          .addTo(map);
      });
    }

    if (on.routes) {
      evacRoutes.forEach((r) => {
        L.polyline(r.path, { color: c.accent, weight: 3, opacity: 0.95 })
          .bindTooltip(r.label, { sticky: true })
          .addTo(map);
      });
    }

    if (on.shelters) {
      shelters.forEach((s) => {
        const color = s.status === "full" ? c.critical : s.status === "near-full" ? c.warning : c.success;
        L.marker(s.pos, { icon: markerIcon(color, "S") })
          .bindPopup(
            `<strong>${s.name}</strong><br/>${s.occupancy}/${s.capacity} occupied · ${s.incoming} incoming`,
          )
          .addTo(map);
      });
    }

    if (on.hospitals) {
      hospitals.forEach((h) => {
        L.marker(h.pos, { icon: markerIcon(c.info, "H") })
          .bindPopup(`<strong>${h.name}</strong><br/>${h.bedsFree} beds · ${h.icuFree} ICU free`)
          .addTo(map);
      });
    }

    if (on.teams) {
      teams.forEach((t) => {
        L.marker(t.pos, { icon: markerIcon(c.accent, t.callsign.slice(0, 1)) })
          .bindPopup(`<strong>${t.callsign}</strong><br/>${t.unit} · ${t.status}`)
          .addTo(map);
      });
    }

    if (on.incidents) {
      incidents.forEach((i) => {
        const color = i.severity === "critical" ? c.critical : i.severity === "warning" ? c.warning : c.info;
        L.circle(i.pos, { radius: 260, color, weight: 1, fillColor: color, fillOpacity: 0.12 }).addTo(map);
        L.marker(i.pos, { icon: markerIcon(color, "!", i.severity === "critical") })
          .bindPopup(`<strong>${i.id}</strong><br/>${i.title}<br/>${i.victims} affected`)
          .addTo(map);
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} style={{ height, width: "100%" }} className="rounded-lg" />;
}
