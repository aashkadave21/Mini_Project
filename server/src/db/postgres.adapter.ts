import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import type {
  DBState,
  User,
  Incident,
  HazardZone,
  Shelter,
  Evacuee,
  Volunteer,
  SupplyRequest,
  RescueTeam,
  RescueMission,
  Victim,
  Hospital,
  TriageCase,
  AmbulanceArrival,
  BloodStock,
  RoadSegment,
  RoadNode,
  EvacuationRoute,
  CitizenProfile,
  SOSRequest,
  AuditLog,
} from "../types/index.js";

const { Pool } = pg;

export interface ParsedConnection {
  poolConfig: pg.PoolConfig;
  sanitizedUrl: string;
  host: string;
  port: number;
  database: string;
  user: string;
}

/**
 * Safely parses any PostgreSQL connection string, properly accommodating special
 * characters (such as unencoded '@' or '!') in user passphrases without truncating.
 */
export function parseConnectionString(rawUrl: string): ParsedConnection {
  const trimmed = rawUrl.trim();
  const protocolMatch = trimmed.match(/^postgres(ql)?:\/\//i);

  if (!protocolMatch) {
    throw new Error("Invalid PostgreSQL connection string format. Must start with postgresql:// or postgres://");
  }

  const withoutProtocol = trimmed.slice(protocolMatch[0].length);
  const lastAtIndex = withoutProtocol.lastIndexOf("@");

  if (lastAtIndex === -1) {
    throw new Error("Invalid connection string: missing '@' host separator");
  }

  const credentialsPart = withoutProtocol.slice(0, lastAtIndex);
  const hostAndDbPart = withoutProtocol.slice(lastAtIndex + 1);

  const firstColonIndex = credentialsPart.indexOf(":");
  let user = credentialsPart;
  let password = "";

  if (firstColonIndex !== -1) {
    user = credentialsPart.slice(0, firstColonIndex);
    const rawPass = credentialsPart.slice(firstColonIndex + 1);
    try {
      password = decodeURIComponent(rawPass);
    } catch {
      password = rawPass;
    }
  }

  const slashIndex = hostAndDbPart.indexOf("/");
  let hostPort = hostAndDbPart;
  let database = "postgres";

  if (slashIndex !== -1) {
    hostPort = hostAndDbPart.slice(0, slashIndex);
    const dbAndQuery = hostAndDbPart.slice(slashIndex + 1);
    database = dbAndQuery.split("?")[0] || "postgres";
  }

  let host = hostPort;
  let port = 5432;
  const hostColonIndex = hostPort.lastIndexOf(":");

  if (hostColonIndex !== -1) {
    host = hostPort.slice(0, hostColonIndex);
    const portStr = hostPort.slice(hostColonIndex + 1);
    const parsedPort = parseInt(portStr, 10);
    if (!isNaN(parsedPort)) {
      port = parsedPort;
    }
  }

  const poolConfig: pg.PoolConfig = {
    user,
    password,
    host,
    port,
    database,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  const sanitizedUrl = `postgresql://${user}@${host}:${port}/${database}`;

  return {
    poolConfig,
    sanitizedUrl,
    host,
    port,
    database,
    user,
  };
}

export class PostgresAdapter {
  private pool: pg.Pool | null = null;
  private connectionDetails: ParsedConnection | null = null;

  public async connect(rawUrl: string): Promise<{ connected: boolean; sanitizedUrl: string; serverTime: string }> {
    this.connectionDetails = parseConnectionString(rawUrl);
    this.pool = new Pool(this.connectionDetails.poolConfig);

    // Validate connection with an active handshake query
    const client = await this.pool.connect();
    try {
      const res = await client.query("SELECT NOW() as current_time, current_database() as db_name, version() as version");
      const serverTime = res.rows[0]?.current_time?.toISOString?.() || new Date().toISOString();
      return {
        connected: true,
        sanitizedUrl: this.connectionDetails.sanitizedUrl,
        serverTime,
      };
    } finally {
      client.release();
    }
  }

  public get isConnected(): boolean {
    return this.pool !== null;
  }

  public get sanitizedUrl(): string {
    return this.connectionDetails?.sanitizedUrl || "postgresql://[redacted]";
  }

  public async executeMigrations(): Promise<{ appliedTables: string[] }> {
    if (!this.pool) throw new Error("PostgreSQL pool not connected");

    const schemaPath = path.resolve(process.cwd(), "server", "src", "db", "schema.sql");
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema definition file not found at: ${schemaPath}`);
    }

    const schemaSql = fs.readFileSync(schemaPath, "utf-8");

    // Execute the schema statements inside a transaction to guarantee atomicity
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(schemaSql);
      await client.query("COMMIT");

      // Verify created tables
      const tableCheck = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name ASC
      `);
      const appliedTables = tableCheck.rows.map((r) => r.table_name);
      return { appliedTables };
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  public async checkHasData(): Promise<boolean> {
    if (!this.pool) return false;
    const client = await this.pool.connect();
    try {
      const res = await client.query("SELECT COUNT(*)::int as count FROM users");
      return (res.rows[0]?.count || 0) > 0;
    } catch {
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Hydrates in-memory cache directly from Supabase PostgreSQL tables using parameterized SELECTs.
   */
  public async loadState(): Promise<DBState | null> {
    if (!this.pool) return null;
    const pool = this.pool;
    try {
      const [
        usersRes,
        hazardsRes,
        incidentsRes,
        nodesRes,
        edgesRes,
        routesRes,
        sheltersRes,
        evacueesRes,
        volunteersRes,
        supplyRequestsRes,
        rescueTeamsRes,
        rescueMissionsRes,
        victimsRes,
        hospitalsRes,
        triageRes,
        ambulancesRes,
        bloodRes,
        profilesRes,
        familyRes,
        checklistsRes,
        sosRes,
        auditRes,
      ] = await Promise.all([
        pool.query("SELECT * FROM users ORDER BY created_at ASC"),
        pool.query("SELECT * FROM hazards"),
        pool.query("SELECT * FROM incidents ORDER BY created_at ASC"),
        pool.query("SELECT * FROM road_nodes"),
        pool.query("SELECT * FROM road_edges"),
        pool.query("SELECT * FROM evacuation_routes"),
        pool.query("SELECT * FROM shelters ORDER BY id ASC"),
        pool.query("SELECT * FROM evacuees ORDER BY registered_at DESC"),
        pool.query("SELECT * FROM volunteers"),
        pool.query("SELECT * FROM supply_requests ORDER BY created_at DESC"),
        pool.query("SELECT * FROM rescue_teams ORDER BY id ASC"),
        pool.query("SELECT * FROM rescue_missions ORDER BY created_at DESC"),
        pool.query("SELECT * FROM victims"),
        pool.query("SELECT * FROM hospitals ORDER BY id ASC"),
        pool.query("SELECT * FROM triage_cases ORDER BY arrival_time DESC"),
        pool.query("SELECT * FROM ambulances"),
        pool.query("SELECT * FROM blood_inventory"),
        pool.query("SELECT * FROM citizen_profiles"),
        pool.query("SELECT * FROM family_members"),
        pool.query("SELECT * FROM go_bag_checklists"),
        pool.query("SELECT * FROM sos_requests ORDER BY created_at DESC"),
        pool.query("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 500"),
      ]);

      if (usersRes.rows.length === 0) {
        return null; // DB is empty, signals need for initial migration
      }

      const users: User[] = usersRes.rows.map((r) => ({
        id: r.id,
        username: r.username,
        fullName: r.full_name,
        email: r.email,
        role: r.role,
        passwordHash: r.password_hash,
        associatedEntityId: r.associated_entity_id || undefined,
        createdAt: r.created_at?.toISOString?.() || r.created_at,
      }));

      const hazards: HazardZone[] = hazardsRes.rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        label: r.label,
        severity: r.severity,
        ring: r.ring_coordinates,
        penaltyWeight: Number(r.penalty_weight) || 5.0,
      }));

      const incidents: Incident[] = incidentsRes.rows.map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        severity: r.severity,
        sector: r.sector,
        reported: r.reported_time,
        victims: Number(r.victims) || 0,
        status: r.status,
        pos: [Number(r.latitude), Number(r.longitude)],
        description: r.description || undefined,
        createdBy: r.created_by || undefined,
        createdAt: r.created_at?.toISOString?.() || r.created_at,
        updatedAt: r.updated_at?.toISOString?.() || r.updated_at,
      }));

      const roadNodes: RoadNode[] = nodesRes.rows.map((r) => ({
        id: r.id,
        label: r.label,
        pos: [Number(r.latitude), Number(r.longitude)],
      }));

      const roadEdges: RoadSegment[] = edgesRes.rows.map((r) => ({
        id: r.id,
        name: r.name,
        startNode: r.start_node,
        endNode: r.end_node,
        state: r.state,
        distanceKm: Number(r.distance_km),
        baseTimeMin: Number(r.base_time_min),
        path: r.path_coordinates,
      }));

      const evacuationRoutes: EvacuationRoute[] = routesRes.rows.map((r) => ({
        id: r.id,
        label: r.label,
        originSector: r.origin_sector,
        destinationShelterId: r.destination_shelter_id,
        distanceKm: Number(r.distance_km),
        travelTimeMin: Number(r.travel_time_min),
        hazardExposureScore: Number(r.hazard_exposure_score),
        path: r.path_coordinates,
        diversions: Number(r.diversions_count) || 0,
        algorithm: r.algorithm,
        segments: r.segments || [],
        updatedAt: r.updated_at?.toISOString?.() || r.updated_at,
      }));

      const shelters: Shelter[] = sheltersRes.rows.map((r) => ({
        id: r.id,
        name: r.name,
        capacity: Number(r.capacity),
        occupancy: Number(r.occupancy),
        incoming: Number(r.incoming),
        medical: Boolean(r.medical),
        status: r.status,
        pos: [Number(r.latitude), Number(r.longitude)],
        waterStock: Number(r.water_stock),
        foodStock: Number(r.food_stock),
        blanketsStock: Number(r.blankets_stock),
        medicalKitsStock: Number(r.medical_kits_stock),
        sanitationStock: Number(r.sanitation_stock),
        lastUpdated: r.last_updated?.toISOString?.() || r.last_updated,
      }));

      const evacuees: Evacuee[] = evacueesRes.rows.map((r) => ({
        id: r.id,
        shelterId: r.shelter_id,
        batchId: r.batch_id || undefined,
        fullName: r.full_name,
        familyCount: Number(r.family_count) || 1,
        originSector: r.origin_sector,
        mobilityNeeds: r.mobility_needs || "On foot",
        specialNeeds: r.special_needs || undefined,
        registeredAt: r.registered_at?.toISOString?.() || r.registered_at,
      }));

      const volunteers: Volunteer[] = volunteersRes.rows.map((r) => ({
        id: r.id,
        shelterId: r.shelter_id,
        name: r.name,
        role: r.role,
        shift: r.shift,
        tone: r.tone,
        available: Boolean(r.available),
      }));

      const supplyRequests: SupplyRequest[] = supplyRequestsRes.rows.map((r) => ({
        id: r.id,
        shelterId: r.shelter_id,
        resource: r.resource,
        quantity: Number(r.quantity),
        urgency: r.urgency,
        status: r.status,
        submittedBy: r.submitted_by,
        approvedBy: r.approved_by || undefined,
        notes: r.notes || undefined,
        createdAt: r.created_at?.toISOString?.() || r.created_at,
        updatedAt: r.updated_at?.toISOString?.() || r.updated_at,
      }));

      const rescueTeams: RescueTeam[] = rescueTeamsRes.rows.map((r) => ({
        id: r.id,
        callsign: r.callsign,
        unit: r.unit,
        members: Number(r.members),
        status: r.status,
        mission: r.mission || null,
        fuel: Number(r.fuel),
        eta: r.eta || "—",
        pos: [Number(r.latitude), Number(r.longitude)],
        updatedAt: r.updated_at?.toISOString?.() || r.updated_at,
      }));

      const rescueMissions: RescueMission[] = rescueMissionsRes.rows.map((r) => ({
        id: r.id,
        incidentId: r.incident_id,
        assignedTeamId: r.assigned_team_id || undefined,
        status: r.status,
        victimsCount: Number(r.victims_count) || 0,
        triageSummary: r.triage_summary || { red: 0, yellow: 0, green: 0 },
        notes: r.notes || undefined,
        outcomeReport: r.outcome_report || undefined,
        createdAt: r.created_at?.toISOString?.() || r.created_at,
        completedAt: r.completed_at ? r.completed_at?.toISOString?.() || r.completed_at : undefined,
      }));

      const victims: Victim[] = victimsRes.rows.map((r) => ({
        id: r.id,
        missionId: r.mission_id,
        name: r.name,
        triage: r.triage,
        note: r.note || "",
        status: r.status,
        tone: r.tone,
      }));

      const hospitals: Hospital[] = hospitalsRes.rows.map((r) => ({
        id: r.id,
        name: r.name,
        beds: Number(r.beds),
        bedsFree: Number(r.beds_free),
        icu: Number(r.icu),
        icuFree: Number(r.icu_free),
        incoming: Number(r.incoming),
        triageLoad: Number(r.triage_load),
        diversion: Boolean(r.diversion),
        diversionReason: r.diversion_reason || undefined,
        pos: [Number(r.latitude), Number(r.longitude)],
        updatedAt: r.updated_at?.toISOString?.() || r.updated_at,
      }));

      const triageCases: TriageCase[] = triageRes.rows.map((r) => ({
        id: r.id,
        hospitalId: r.hospital_id,
        tag: r.tag,
        desc: r.presentation,
        wait: r.wait_time,
        arrivalTime: r.arrival_time?.toISOString?.() || r.arrival_time,
        status: r.status,
      }));

      const ambulances: AmbulanceArrival[] = ambulancesRes.rows.map((r) => ({
        id: r.id,
        hospitalId: r.hospital_id,
        unit: r.unit,
        eta: r.eta,
        triage: r.triage,
        cases: Number(r.cases),
        tone: r.tone,
        arrived: Boolean(r.arrived),
      }));

      const bloodInventory: BloodStock[] = bloodRes.rows.map((r) => ({
        group: r.blood_group,
        units: Number(r.units),
        min: Number(r.min_threshold),
      }));

      const citizenProfiles: CitizenProfile[] = profilesRes.rows.map((r) => {
        const family = familyRes.rows
          .filter((f) => f.citizen_id === r.id)
          .map((f) => ({
            id: f.id,
            name: f.name,
            status: f.status,
            tone: f.tone,
            lastReported: f.last_reported?.toISOString?.() || f.last_reported,
          }));

        const checklist = checklistsRes.rows
          .filter((c) => c.citizen_id === r.id)
          .map((c) => ({
            item: c.item,
            checked: Boolean(c.checked),
          }));

        return {
          id: r.id,
          userId: r.user_id,
          fullName: r.full_name,
          sector: r.sector,
          evacuationOrder: r.evacuation_order,
          assignedShelterId: r.assigned_shelter_id,
          distanceKm: Number(r.distance_km),
          etaMinutes: Number(r.eta_minutes),
          bloodGroup: r.blood_group,
          conditions: r.conditions,
          medication: r.medication,
          emergencyContact: r.emergency_contact,
          checklist,
          family,
          connectivityStatus: r.connectivity_status,
        };
      });

      const sosRequests: SOSRequest[] = sosRes.rows.map((r) => ({
        id: r.id,
        citizenId: r.citizen_id || undefined,
        senderName: r.sender_name,
        sector: r.sector,
        pos: r.latitude && r.longitude ? [Number(r.latitude), Number(r.longitude)] : undefined,
        headcount: Number(r.headcount) || 1,
        medicalUrgency: Boolean(r.medical_urgency),
        notes: r.notes || undefined,
        status: r.status,
        assignedTeamId: r.assigned_team_id || undefined,
        createdAt: r.created_at?.toISOString?.() || r.created_at,
      }));

      const auditLogs: AuditLog[] = auditRes.rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp?.toISOString?.() || r.timestamp,
        actor: r.actor,
        role: r.role,
        action: r.action,
        target: r.target,
        details: r.details,
      }));

      return {
        users,
        incidents,
        hazards,
        shelters,
        evacuees,
        volunteers,
        supplyRequests,
        rescueTeams,
        rescueMissions,
        victims,
        hospitals,
        triageCases,
        ambulances,
        bloodInventory,
        roadNodes,
        roadEdges,
        evacuationRoutes,
        citizenProfiles,
        sosRequests,
        auditLogs,
      };
    } catch (err) {
      console.error("[PostgreSQL] Error in loadState:", err);
      throw err;
    }
  }

  /**
   * Performs an idempotent, non-destructive migration of all local records into Supabase PostgreSQL
   * using parameterized INSERT ... ON CONFLICT DO UPDATE/NOTHING queries.
   */
  public async migrateLocalState(state: DBState): Promise<{ insertedCounts: Record<string, number> }> {
    if (!this.pool) throw new Error("PostgreSQL pool not connected");
    const client = await this.pool.connect();
    const counts: Record<string, number> = {};

    try {
      await client.query("BEGIN");

      // 1. Users
      for (const u of state.users) {
        await client.query(
          `INSERT INTO users (id, username, full_name, email, role, password_hash, associated_entity_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
           ON CONFLICT (id) DO UPDATE SET 
             full_name = EXCLUDED.full_name,
             password_hash = EXCLUDED.password_hash,
             associated_entity_id = EXCLUDED.associated_entity_id,
             updated_at = NOW()`,
          [u.id, u.username, u.fullName, u.email, u.role, u.passwordHash, u.associatedEntityId || null, u.createdAt]
        );
      }
      counts.users = state.users.length;

      // 2. Hazards
      for (const h of state.hazards) {
        await client.query(
          `INSERT INTO hazards (id, kind, label, severity, ring_coordinates, penalty_weight)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             kind = EXCLUDED.kind,
             label = EXCLUDED.label,
             severity = EXCLUDED.severity,
             ring_coordinates = EXCLUDED.ring_coordinates,
             penalty_weight = EXCLUDED.penalty_weight`,
          [h.id, h.kind, h.label, h.severity, JSON.stringify(h.ring), h.penaltyWeight]
        );
      }
      counts.hazards = state.hazards.length;

      // 3. Incidents
      for (const inc of state.incidents) {
        await client.query(
          `INSERT INTO incidents (id, title, type, severity, sector, reported_time, victims, status, latitude, longitude, description, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             severity = EXCLUDED.severity,
             victims = EXCLUDED.victims,
             status = EXCLUDED.status,
             description = EXCLUDED.description,
             updated_at = NOW()`,
          [
            inc.id,
            inc.title,
            inc.type,
            inc.severity,
            inc.sector,
            inc.reported,
            inc.victims,
            inc.status,
            inc.pos[0],
            inc.pos[1],
            inc.description || null,
            inc.createdBy || null,
            inc.createdAt,
            inc.updatedAt,
          ]
        );
      }
      counts.incidents = state.incidents.length;

      // 4. Road Nodes
      for (const node of state.roadNodes) {
        await client.query(
          `INSERT INTO road_nodes (id, label, latitude, longitude)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO NOTHING`,
          [node.id, node.label, node.pos[0], node.pos[1]]
        );
      }
      counts.roadNodes = state.roadNodes.length;

      // 5. Road Edges
      for (const edge of state.roadEdges) {
        await client.query(
          `INSERT INTO road_edges (id, name, start_node, end_node, state, distance_km, base_time_min, path_coordinates)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             state = EXCLUDED.state,
             last_condition_observed = NOW()`,
          [
            edge.id,
            edge.name,
            edge.startNode,
            edge.endNode,
            edge.state,
            edge.distanceKm,
            edge.baseTimeMin,
            JSON.stringify(edge.path),
          ]
        );
      }
      counts.roadEdges = state.roadEdges.length;

      // 6. Shelters
      for (const s of state.shelters) {
        await client.query(
          `INSERT INTO shelters (id, name, capacity, occupancy, incoming, medical, status, latitude, longitude, water_stock, food_stock, blankets_stock, medical_kits_stock, sanitation_stock, last_updated)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO UPDATE SET
             occupancy = EXCLUDED.occupancy,
             incoming = EXCLUDED.incoming,
             status = EXCLUDED.status,
             water_stock = EXCLUDED.water_stock,
             food_stock = EXCLUDED.food_stock,
             blankets_stock = EXCLUDED.blankets_stock,
             medical_kits_stock = EXCLUDED.medical_kits_stock,
             sanitation_stock = EXCLUDED.sanitation_stock,
             last_updated = NOW()`,
          [
            s.id,
            s.name,
            s.capacity,
            s.occupancy,
            s.incoming,
            s.medical,
            s.status,
            s.pos[0],
            s.pos[1],
            s.waterStock,
            s.foodStock,
            s.blanketsStock,
            s.medicalKitsStock,
            s.sanitationStock,
            s.lastUpdated,
          ]
        );
      }
      counts.shelters = state.shelters.length;

      // 7. Evacuation Routes
      for (const r of state.evacuationRoutes) {
        await client.query(
          `INSERT INTO evacuation_routes (id, label, origin_sector, destination_shelter_id, distance_km, travel_time_min, hazard_exposure_score, path_coordinates, diversions_count, algorithm, segments, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (id) DO NOTHING`,
          [
            r.id,
            r.label,
            r.originSector,
            r.destinationShelterId,
            r.distanceKm,
            r.travelTimeMin,
            r.hazardExposureScore,
            JSON.stringify(r.path),
            r.diversions,
            r.algorithm,
            JSON.stringify(r.segments),
            r.updatedAt,
          ]
        );
      }
      counts.evacuationRoutes = state.evacuationRoutes.length;

      // 8. Evacuees
      for (const e of state.evacuees) {
        await client.query(
          `INSERT INTO evacuees (id, shelter_id, batch_id, full_name, family_count, origin_sector, mobility_needs, special_needs, registered_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [
            e.id,
            e.shelterId,
            e.batchId || null,
            e.fullName,
            e.familyCount,
            e.originSector,
            e.mobilityNeeds,
            e.specialNeeds || null,
            e.registeredAt,
          ]
        );
      }
      counts.evacuees = state.evacuees.length;

      // 9. Volunteers
      for (const v of state.volunteers) {
        await client.query(
          `INSERT INTO volunteers (id, shelter_id, name, role, shift, tone, available)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [v.id, v.shelterId, v.name, v.role, v.shift, v.tone, v.available]
        );
      }
      counts.volunteers = state.volunteers.length;

      // 10. Supply Requests
      for (const req of state.supplyRequests) {
        await client.query(
          `INSERT INTO supply_requests (id, shelter_id, resource, quantity, urgency, status, submitted_by, approved_by, notes, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO NOTHING`,
          [
            req.id,
            req.shelterId,
            req.resource,
            req.quantity,
            req.urgency,
            req.status,
            req.submittedBy,
            req.approvedBy || null,
            req.notes || null,
            req.createdAt,
            req.updatedAt,
          ]
        );
      }
      counts.supplyRequests = state.supplyRequests.length;

      // 11. Rescue Teams
      for (const team of state.rescueTeams) {
        await client.query(
          `INSERT INTO rescue_teams (id, callsign, unit, members, status, mission, fuel, eta, latitude, longitude, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO UPDATE SET
             status = EXCLUDED.status,
             mission = EXCLUDED.mission,
             fuel = EXCLUDED.fuel,
             updated_at = NOW()`,
          [
            team.id,
            team.callsign,
            team.unit,
            team.members,
            team.status,
            team.mission,
            team.fuel,
            team.eta,
            team.pos[0],
            team.pos[1],
            team.updatedAt,
          ]
        );
      }
      counts.rescueTeams = state.rescueTeams.length;

      // 12. Rescue Missions
      const validTeamIdsForMissions = new Set(state.rescueTeams.map((t) => t.id));
      for (const m of state.rescueMissions) {
        const assignedTeam = m.assignedTeamId && validTeamIdsForMissions.has(m.assignedTeamId) ? m.assignedTeamId : null;
        await client.query(
          `INSERT INTO rescue_missions (id, incident_id, assigned_team_id, status, victims_count, triage_summary, notes, outcome_report, created_at, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO UPDATE SET
             status = EXCLUDED.status,
             outcome_report = EXCLUDED.outcome_report,
             completed_at = EXCLUDED.completed_at`,
          [
            m.id,
            m.incidentId,
            assignedTeam,
            m.status,
            m.victimsCount,
            JSON.stringify(m.triageSummary),
            m.notes || null,
            m.outcomeReport || null,
            m.createdAt,
            m.completedAt || null,
          ]
        );
      }
      counts.rescueMissions = state.rescueMissions.length;

      // 13. Victims
      for (const vic of state.victims) {
        await client.query(
          `INSERT INTO victims (id, mission_id, name, triage, note, status, tone)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [vic.id, vic.missionId, vic.name, vic.triage, vic.note, vic.status, vic.tone]
        );
      }
      counts.victims = state.victims.length;

      // 14. Hospitals
      for (const h of state.hospitals) {
        await client.query(
          `INSERT INTO hospitals (id, name, beds, beds_free, icu, icu_free, incoming, triage_load, diversion, diversion_reason, latitude, longitude, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO UPDATE SET
             beds_free = EXCLUDED.beds_free,
             icu_free = EXCLUDED.icu_free,
             triage_load = EXCLUDED.triage_load,
             diversion = EXCLUDED.diversion,
             diversion_reason = EXCLUDED.diversion_reason,
             updated_at = NOW()`,
          [
            h.id,
            h.name,
            h.beds,
            h.bedsFree,
            h.icu,
            h.icuFree,
            h.incoming,
            h.triageLoad,
            h.diversion,
            h.diversionReason || null,
            h.pos[0],
            h.pos[1],
            h.updatedAt,
          ]
        );
      }
      counts.hospitals = state.hospitals.length;

      // 15. Triage Cases
      for (const tc of state.triageCases) {
        await client.query(
          `INSERT INTO triage_cases (id, hospital_id, tag, presentation, wait_time, arrival_time, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [tc.id, tc.hospitalId, tc.tag, tc.desc, tc.wait, tc.arrivalTime, tc.status]
        );
      }
      counts.triageCases = state.triageCases.length;

      // 16. Ambulances
      for (const amb of state.ambulances) {
        await client.query(
          `INSERT INTO ambulances (id, hospital_id, unit, eta, triage, cases, tone, arrived)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET arrived = EXCLUDED.arrived`,
          [amb.id, amb.hospitalId, amb.unit, amb.eta, amb.triage, amb.cases, amb.tone, amb.arrived]
        );
      }
      counts.ambulances = state.ambulances.length;

      // 17. Blood Inventory (Seed under HSP-1 if multiple hospitals)
      for (const b of state.bloodInventory) {
        await client.query(
          `INSERT INTO blood_inventory (hospital_id, blood_group, units, min_threshold)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (hospital_id, blood_group) DO UPDATE SET units = EXCLUDED.units`,
          ["HSP-1", b.group, b.units, b.min]
        );
      }
      counts.bloodInventory = state.bloodInventory.length;

      // 18. Citizen Profiles
      for (const cp of state.citizenProfiles) {
        await client.query(
          `INSERT INTO citizen_profiles (id, user_id, full_name, sector, evacuation_order, assigned_shelter_id, distance_km, eta_minutes, blood_group, conditions, medication, emergency_contact, connectivity_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO UPDATE SET
             conditions = EXCLUDED.conditions,
             medication = EXCLUDED.medication,
             emergency_contact = EXCLUDED.emergency_contact,
             connectivity_status = EXCLUDED.connectivity_status`,
          [
            cp.id,
            cp.userId,
            cp.fullName,
            cp.sector,
            cp.evacuationOrder,
            cp.assignedShelterId,
            cp.distanceKm,
            cp.etaMinutes,
            cp.bloodGroup,
            cp.conditions,
            cp.medication,
            cp.emergencyContact,
            cp.connectivityStatus,
          ]
        );

        // Checklist
        for (const item of cp.checklist) {
          const chkId = `CHK-${cp.id}-${item.item.slice(0, 10).replace(/\\s+/g, "")}`;
          await client.query(
            `INSERT INTO go_bag_checklists (id, citizen_id, item, checked)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET checked = EXCLUDED.checked`,
            [chkId, cp.id, item.item, item.checked]
          );
        }

        // Family
        for (const fam of cp.family) {
          await client.query(
            `INSERT INTO family_members (id, citizen_id, name, status, tone, last_reported)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               status = EXCLUDED.status,
               tone = EXCLUDED.tone,
               last_reported = EXCLUDED.last_reported`,
            [fam.id, cp.id, fam.name, fam.status, fam.tone, fam.lastReported]
          );
        }
      }
      counts.citizenProfiles = state.citizenProfiles.length;

      // 19. SOS Requests
      const validCitizenIds = new Set(state.citizenProfiles.map((c) => c.id));
      const validTeamIds = new Set(state.rescueTeams.map((t) => t.id));

      for (const sos of state.sosRequests) {
        const citizenId = sos.citizenId && validCitizenIds.has(sos.citizenId) ? sos.citizenId : null;
        const assignedTeamId = sos.assignedTeamId && validTeamIds.has(sos.assignedTeamId) ? sos.assignedTeamId : null;

        await client.query(
          `INSERT INTO sos_requests (id, citizen_id, sender_name, sector, latitude, longitude, headcount, medical_urgency, notes, status, assigned_team_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (id) DO NOTHING`,
          [
            sos.id,
            citizenId,
            sos.senderName,
            sos.sector,
            sos.pos ? sos.pos[0] : null,
            sos.pos ? sos.pos[1] : null,
            sos.headcount,
            sos.medicalUrgency,
            sos.notes || null,
            sos.status,
            assignedTeamId,
            sos.createdAt,
          ]
        );
      }
      counts.sosRequests = state.sosRequests.length;

      // 20. Audit Logs (Recent 100)
      for (const log of state.auditLogs.slice(0, 100)) {
        await client.query(
          `INSERT INTO audit_logs (id, timestamp, actor, role, action, target, details)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [log.id, log.timestamp, log.actor, log.role, log.action, log.target, JSON.stringify(log.details || {})]
        );
      }
      counts.auditLogs = Math.min(100, state.auditLogs.length);

      await client.query("COMMIT");
      return { insertedCounts: counts };
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Persists an audit log entry in real time to the audit_logs table.
   */
  public async logAuditEntry(entry: AuditLog): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO audit_logs (id, timestamp, actor, role, action, target, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [entry.id, entry.timestamp, entry.actor, entry.role, entry.action, entry.target, JSON.stringify(entry.details || {})]
      );
    } catch (err) {
      console.warn("[PostgreSQL] Could not persist audit log to remote DB:", err);
    }
  }
}

export const postgresAdapter = new PostgresAdapter();
