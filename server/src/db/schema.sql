-- =============================================================================
-- SDREP (Smart Disaster Rescue and Evacuation Planner) - Relational Schema DDL
-- Target DBMS: PostgreSQL 14+ (Compliant with ANSI SQL standard)
-- SPIT Computer Engineering - Semester V Mini Project
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('CITIZEN', 'RESCUE_TEAM', 'SHELTER_ADMIN', 'HOSPITAL_STAFF', 'CONTROL_CENTRE_ADMIN')),
    password_hash VARCHAR(255) NOT NULL,
    associated_entity_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actor VARCHAR(100) NOT NULL,
    role VARCHAR(32) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target VARCHAR(100) NOT NULL,
    details JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor);

-- -----------------------------------------------------------------------------
-- B. Disaster and Incident Management
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS incidents (
    id VARCHAR(32) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('flood', 'fire', 'collapse', 'medical', 'landslide', 'chemical')),
    severity VARCHAR(16) NOT NULL CHECK (severity IN ('critical', 'warning', 'info', 'success')),
    sector VARCHAR(100) NOT NULL,
    reported_time VARCHAR(16) NOT NULL,
    victims INT DEFAULT 0 CHECK (victims >= 0),
    status VARCHAR(32) NOT NULL CHECK (status IN ('unassigned', 'dispatched', 'on-scene', 'resolved', 'cancelled')),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    description TEXT,
    created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_coords ON incidents(latitude, longitude);

CREATE TABLE IF NOT EXISTS hazards (
    id VARCHAR(32) PRIMARY KEY,
    kind VARCHAR(32) NOT NULL CHECK (kind IN ('flood', 'fire', 'chemical', 'landslide')),
    label VARCHAR(150) NOT NULL,
    severity VARCHAR(16) NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
    ring_coordinates JSONB NOT NULL,
    penalty_weight DOUBLE PRECISION DEFAULT 5.0 CHECK (penalty_weight >= 0)
);

CREATE TABLE IF NOT EXISTS incident_status_history (
    id VARCHAR(64) PRIMARY KEY,
    incident_id VARCHAR(32) NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    previous_status VARCHAR(32),
    new_status VARCHAR(32) NOT NULL,
    changed_by VARCHAR(64),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- -----------------------------------------------------------------------------
-- C. Road Network and Evacuation Routing
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS road_nodes (
    id VARCHAR(32) PRIMARY KEY,
    label VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS road_edges (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    start_node VARCHAR(32) NOT NULL REFERENCES road_nodes(id) ON DELETE CASCADE,
    end_node VARCHAR(32) NOT NULL REFERENCES road_nodes(id) ON DELETE CASCADE,
    state VARCHAR(16) NOT NULL CHECK (state IN ('blocked', 'flooded', 'congested', 'clear')),
    distance_km DOUBLE PRECISION NOT NULL CHECK (distance_km > 0),
    base_time_min DOUBLE PRECISION NOT NULL CHECK (base_time_min > 0),
    path_coordinates JSONB NOT NULL,
    last_condition_observed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_road_edges_state ON road_edges(state);

CREATE TABLE IF NOT EXISTS evacuation_routes (
    id VARCHAR(32) PRIMARY KEY,
    label VARCHAR(150) NOT NULL,
    origin_sector VARCHAR(100) NOT NULL,
    destination_shelter_id VARCHAR(32) NOT NULL,
    distance_km DOUBLE PRECISION NOT NULL,
    travel_time_min DOUBLE PRECISION NOT NULL,
    hazard_exposure_score DOUBLE PRECISION NOT NULL,
    path_coordinates JSONB NOT NULL,
    diversions_count INT DEFAULT 0,
    algorithm VARCHAR(32) NOT NULL,
    segments JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- -----------------------------------------------------------------------------
-- D. Shelters and Intake
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shelters (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0),
    occupancy INT DEFAULT 0 CHECK (occupancy >= 0),
    incoming INT DEFAULT 0 CHECK (incoming >= 0),
    medical BOOLEAN DEFAULT FALSE NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('open', 'near-full', 'full')),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    water_stock INT DEFAULT 1000 CHECK (water_stock >= 0),
    food_stock INT DEFAULT 1000 CHECK (food_stock >= 0),
    blankets_stock INT DEFAULT 500 CHECK (blankets_stock >= 0),
    medical_kits_stock INT DEFAULT 50 CHECK (medical_kits_stock >= 0),
    sanitation_stock INT DEFAULT 200 CHECK (sanitation_stock >= 0),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shelters_status ON shelters(status);
ALTER TABLE shelters DROP CONSTRAINT IF EXISTS shelters_check;

CREATE TABLE IF NOT EXISTS evacuees (
    id VARCHAR(64) PRIMARY KEY,
    shelter_id VARCHAR(32) NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    batch_id VARCHAR(32),
    full_name VARCHAR(150) NOT NULL,
    family_count INT DEFAULT 1 CHECK (family_count >= 1),
    origin_sector VARCHAR(100) NOT NULL,
    mobility_needs VARCHAR(100) DEFAULT 'On foot',
    special_needs TEXT,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evacuees_shelter ON evacuees(shelter_id);

CREATE TABLE IF NOT EXISTS shelter_capacity_history (
    id VARCHAR(64) PRIMARY KEY,
    shelter_id VARCHAR(32) NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    occupancy INT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- -----------------------------------------------------------------------------
-- E. Rescue Teams and Missions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rescue_teams (
    id VARCHAR(32) PRIMARY KEY,
    callsign VARCHAR(64) NOT NULL UNIQUE,
    unit VARCHAR(100) NOT NULL,
    members INT NOT NULL CHECK (members > 0),
    status VARCHAR(16) NOT NULL CHECK (status IN ('available', 'en-route', 'on-scene', 'returning', 'offline')),
    mission VARCHAR(32),
    fuel INT DEFAULT 100 CHECK (fuel >= 0 AND fuel <= 100),
    eta VARCHAR(32) DEFAULT '—',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS rescue_missions (
    id VARCHAR(32) PRIMARY KEY,
    incident_id VARCHAR(32) NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    assigned_team_id VARCHAR(32) REFERENCES rescue_teams(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('PENDING', 'ASSIGNED', 'EN_ROUTE', 'ON_SCENE', 'COMPLETED', 'CANCELLED')),
    victims_count INT DEFAULT 0 CHECK (victims_count >= 0),
    triage_summary JSONB,
    notes TEXT,
    outcome_report TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS victims (
    id VARCHAR(32) PRIMARY KEY,
    mission_id VARCHAR(32) NOT NULL REFERENCES rescue_missions(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    triage VARCHAR(16) NOT NULL CHECK (triage IN ('Red', 'Yellow', 'Green')),
    note TEXT,
    status VARCHAR(32) DEFAULT 'trapped' CHECK (status IN ('trapped', 'triage', 'evacuated', 'hospitalized')),
    tone VARCHAR(16) NOT NULL CHECK (tone IN ('critical', 'warning', 'success'))
);

-- -----------------------------------------------------------------------------
-- F. Hospitals and Casualties
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospitals (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    beds INT NOT NULL CHECK (beds > 0),
    beds_free INT NOT NULL CHECK (beds_free >= 0 AND beds_free <= beds),
    icu INT NOT NULL CHECK (icu > 0),
    icu_free INT NOT NULL CHECK (icu_free >= 0 AND icu_free <= icu),
    incoming INT DEFAULT 0 CHECK (incoming >= 0),
    triage_load INT DEFAULT 0 CHECK (triage_load >= 0 AND triage_load <= 100),
    diversion BOOLEAN DEFAULT FALSE NOT NULL,
    diversion_reason TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS triage_cases (
    id VARCHAR(32) PRIMARY KEY,
    hospital_id VARCHAR(32) NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    tag VARCHAR(16) NOT NULL CHECK (tag IN ('Red', 'Yellow', 'Green')),
    presentation TEXT NOT NULL,
    wait_time VARCHAR(32) NOT NULL,
    arrival_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status VARCHAR(32) DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'IN_TREATMENT', 'DISCHARGED', 'TRANSFERRED'))
);

CREATE TABLE IF NOT EXISTS ambulances (
    id VARCHAR(32) PRIMARY KEY,
    hospital_id VARCHAR(32) NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    unit VARCHAR(64) NOT NULL,
    eta VARCHAR(32) NOT NULL,
    triage VARCHAR(16) NOT NULL CHECK (triage IN ('Red', 'Yellow', 'Green')),
    cases INT NOT NULL CHECK (cases >= 1),
    tone VARCHAR(16) NOT NULL CHECK (tone IN ('critical', 'warning', 'success')),
    arrived BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE IF NOT EXISTS blood_inventory (
    hospital_id VARCHAR(32) NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    blood_group VARCHAR(8) NOT NULL,
    units INT NOT NULL CHECK (units >= 0),
    min_threshold INT NOT NULL CHECK (min_threshold > 0),
    PRIMARY KEY (hospital_id, blood_group)
);

-- -----------------------------------------------------------------------------
-- G. Volunteers and Supplies
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS volunteers (
    id VARCHAR(32) PRIMARY KEY,
    shelter_id VARCHAR(32) NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(100) NOT NULL,
    shift VARCHAR(100) NOT NULL,
    tone VARCHAR(16) NOT NULL CHECK (tone IN ('success', 'warning', 'info')),
    available BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE IF NOT EXISTS supply_requests (
    id VARCHAR(32) PRIMARY KEY,
    shelter_id VARCHAR(32) NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    resource VARCHAR(100) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    urgency VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'FULFILLING', 'FULFILLED', 'REJECTED', 'CANCELLED')),
    submitted_by VARCHAR(100) NOT NULL,
    approved_by VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- -----------------------------------------------------------------------------
-- H. Citizens and SOS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS citizen_profiles (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    sector VARCHAR(100) NOT NULL,
    evacuation_order VARCHAR(16) NOT NULL CHECK (evacuation_order IN ('MANDATORY', 'ADVISORY', 'STANDBY', 'NONE')),
    assigned_shelter_id VARCHAR(32) REFERENCES shelters(id) ON DELETE SET NULL,
    distance_km DOUBLE PRECISION DEFAULT 2.4,
    eta_minutes INT DEFAULT 26,
    blood_group VARCHAR(8) DEFAULT 'O+',
    conditions TEXT DEFAULT 'Asthma',
    medication TEXT DEFAULT 'Salbutamol inhaler',
    emergency_contact VARCHAR(32) DEFAULT '+91 98200 12420',
    connectivity_status VARCHAR(32) DEFAULT 'ONLINE' CHECK (connectivity_status IN ('ONLINE', 'OFFLINE_SYNCED', 'OFFLINE_LOCAL'))
);

CREATE TABLE IF NOT EXISTS family_members (
    id VARCHAR(64) PRIMARY KEY,
    citizen_id VARCHAR(32) NOT NULL REFERENCES citizen_profiles(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    status VARCHAR(150) NOT NULL,
    tone VARCHAR(16) NOT NULL CHECK (tone IN ('success', 'warning', 'critical')),
    last_reported TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS go_bag_checklists (
    id VARCHAR(64) PRIMARY KEY,
    citizen_id VARCHAR(32) NOT NULL REFERENCES citizen_profiles(id) ON DELETE CASCADE,
    item VARCHAR(200) NOT NULL,
    checked BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE IF NOT EXISTS sos_requests (
    id VARCHAR(32) PRIMARY KEY,
    citizen_id VARCHAR(32) REFERENCES citizen_profiles(id) ON DELETE SET NULL,
    sender_name VARCHAR(150) NOT NULL,
    sector VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    headcount INT DEFAULT 1 CHECK (headcount >= 1),
    medical_urgency BOOLEAN DEFAULT FALSE NOT NULL,
    notes TEXT,
    status VARCHAR(32) DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'TRIAGED', 'DISPATCHED', 'RESOLVED')),
    assigned_team_id VARCHAR(32) REFERENCES rescue_teams(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sos_status ON sos_requests(status);
