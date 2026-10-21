import type { Response } from "express";

export interface SSEClient {
  id: string;
  role?: string;
  entityId?: string;
  res: Response;
}

export interface SystemEvent {
  id: string;
  type:
    | "INCIDENT_UPDATED"
    | "MISSION_UPDATED"
    | "SHELTER_OCCUPANCY_CHANGED"
    | "HOSPITAL_DIVERSION_CHANGED"
    | "SUPPLY_REQUEST_UPDATED"
    | "SOS_ALERT"
    | "ROAD_CLOSURE_CHANGED"
    | "NOTIFICATION";
  timestamp: string;
  payload: unknown;
  targetRole?: string;
}

class EventBus {
  private clients: Map<string, SSEClient> = new Map();
  private eventHistory: SystemEvent[] = [];
  private maxHistory = 100;

  public addClient(client: SSEClient): void {
    this.clients.set(client.id, client);

    // Send initial connection ACK
    client.res.write(
      `event: connected\ndata: ${JSON.stringify({ clientId: client.id, status: "Connected to SDREP Real-time SSE Stream" })}\n\n`
    );

    // Heartbeat every 25 seconds to keep connection alive through proxies
    const heartbeatTimer = setInterval(() => {
      if (!this.clients.has(client.id)) {
        clearInterval(heartbeatTimer);
        return;
      }
      try {
        client.res.write(": heartbeat\n\n");
      } catch {
        this.removeClient(client.id);
        clearInterval(heartbeatTimer);
      }
    }, 25000);
  }

  public removeClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  public broadcast(type: SystemEvent["type"], payload: unknown, targetRole?: string): void {
    const event: SystemEvent = {
      id: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      timestamp: new Date().toISOString(),
      payload,
      targetRole,
    };

    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    const sseFormatted = `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

    for (const [clientId, client] of this.clients.entries()) {
      if (targetRole && client.role && client.role !== "CONTROL_CENTRE_ADMIN" && client.role !== targetRole) {
        continue;
      }

      try {
        client.res.write(sseFormatted);
      } catch {
        this.clients.delete(clientId);
      }
    }
  }

  public getHistory(): SystemEvent[] {
    return this.eventHistory;
  }
}

export const eventBus = new EventBus();
