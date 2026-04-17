-- Perfiles de usuario (Netflix-style)
CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'fonoaudiologo',
    avatar TEXT,
    color TEXT DEFAULT '#6B1F2E',
    pin_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pacientes
CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date TEXT,
    gender TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_patients_document ON patients(document_id);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name);

-- Plantillas de tests (configurables para investigación)
CREATE TABLE IF NOT EXISTS test_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    test_type TEXT NOT NULL CHECK(test_type IN ('DPS', 'PPS', 'CUSTOM')),
    description TEXT,
    config_json TEXT NOT NULL,
    is_standard INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
);

-- Sesiones de test (una evaluación concreta a un paciente)
CREATE TABLE IF NOT EXISTS test_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    template_id INTEGER NOT NULL,
    profile_id INTEGER NOT NULL,
    ear TEXT NOT NULL DEFAULT 'binaural' CHECK(ear IN ('left', 'right', 'binaural')),
    response_mode TEXT NOT NULL DEFAULT 'verbal' CHECK(response_mode IN ('verbal', 'hummed', 'manual')),
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'completed', 'cancelled')),
    practice_score REAL,
    test_score REAL,
    total_items INTEGER DEFAULT 0,
    correct_items INTEGER DEFAULT 0,
    notes TEXT,
    config_snapshot TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES test_templates(id),
    FOREIGN KEY (profile_id) REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_patient ON test_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON test_sessions(started_at);

-- Respuestas individuales por ítem
CREATE TABLE IF NOT EXISTS test_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    item_index INTEGER NOT NULL,
    phase TEXT NOT NULL CHECK(phase IN ('practice', 'test')),
    expected_pattern TEXT NOT NULL,
    given_pattern TEXT,
    is_correct INTEGER,
    reaction_time_ms INTEGER,
    presented_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES test_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_responses_session ON test_responses(session_id);

-- Configuración global
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
