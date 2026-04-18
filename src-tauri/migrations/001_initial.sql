-- AudioPAC — schema colapsado v1 (Fase 6: sistema de paquetes).
--
-- Filosofía: app arranca VACÍA. Sin tests, sin listas, sin estímulos.
-- Todo el contenido clínico se instala como packs desde audiopac-assets
-- (ver `packs` + FK `pack_id` en test_templates y stimulus_lists).
--
-- Tests y listas con pack_id=NULL = creados por el usuario. Intocables al
-- desinstalar packs. Tests y listas con pack_id=N = gestionados por el pack.

-- ────────────────────────────────────────────────────────────────────
-- Perfiles y pacientes
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatar TEXT,
    color TEXT DEFAULT '#6B1F2E',
    pin_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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

-- ────────────────────────────────────────────────────────────────────
-- Paquetes (instalados desde audiopac-assets)
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS packs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    version TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    description_md TEXT,
    requirements TEXT CHECK(requirements IN ('ninguno','recording','audio_pack')),
    license TEXT,
    author_json TEXT,
    references_json TEXT,
    interpretation_json TEXT,
    metadata_json TEXT,
    source_url TEXT,
    manifest_sha256 TEXT,
    installed_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_packs_code ON packs(code);

-- ────────────────────────────────────────────────────────────────────
-- Tests (plantillas)
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS test_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    test_type TEXT NOT NULL CHECK(test_type IN ('DPS', 'PPS', 'CUSTOM')),
    description TEXT,
    config_json TEXT NOT NULL,
    is_standard INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    pack_id INTEGER REFERENCES packs(id) ON DELETE SET NULL,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_templates_pack ON test_templates(pack_id);

-- ────────────────────────────────────────────────────────────────────
-- Calibración (global + puntos por freq×oído)
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calibrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    device_id TEXT,
    device_label TEXT,
    headphone_model TEXT,
    ear TEXT NOT NULL DEFAULT 'binaural' CHECK(ear IN ('left','right','binaural')),
    frequency_hz INTEGER NOT NULL DEFAULT 1000,
    internal_level_dbfs REAL NOT NULL DEFAULT -20,
    measured_db_spl REAL NOT NULL,
    ref_db_spl REAL NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    valid_until TEXT,
    notes TEXT,
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_calibrations_active ON calibrations(is_active);

CREATE TABLE IF NOT EXISTS calibration_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calibration_id INTEGER NOT NULL,
    frequency_hz INTEGER NOT NULL,
    ear TEXT NOT NULL CHECK(ear IN ('left','right','binaural')),
    internal_level_dbfs REAL NOT NULL,
    measured_db_spl REAL NOT NULL,
    ref_db_spl REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(calibration_id, frequency_hz, ear),
    FOREIGN KEY (calibration_id) REFERENCES calibrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cal_points_cal ON calibration_points(calibration_id);

-- ────────────────────────────────────────────────────────────────────
-- Sesiones y respuestas
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS test_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    template_id INTEGER NOT NULL,
    profile_id INTEGER NOT NULL,
    ear TEXT NOT NULL DEFAULT 'binaural' CHECK(ear IN ('left','right','binaural')),
    response_mode TEXT NOT NULL DEFAULT 'verbal' CHECK(response_mode IN ('verbal','hummed','manual')),
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','completed','cancelled')),
    practice_score REAL,
    test_score REAL,
    total_items INTEGER DEFAULT 0,
    correct_items INTEGER DEFAULT 0,
    notes TEXT,
    config_snapshot TEXT,
    calibration_id INTEGER REFERENCES calibrations(id) ON DELETE SET NULL,
    ref_db_snapshot REAL,
    calibration_curve_snapshot TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES test_templates(id),
    FOREIGN KEY (profile_id) REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_patient ON test_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON test_sessions(started_at);

CREATE TABLE IF NOT EXISTS test_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    item_index INTEGER NOT NULL,
    phase TEXT NOT NULL CHECK(phase IN ('practice','test')),
    expected_pattern TEXT NOT NULL,
    given_pattern TEXT,
    is_correct INTEGER,
    reaction_time_ms INTEGER,
    presented_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES test_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_responses_session ON test_responses(session_id);

-- ────────────────────────────────────────────────────────────────────
-- Listas y estímulos (grabados por el user o instalados por pack)
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stimulus_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('srt','discrimination','dichotic_digits','sentence','custom')),
    language TEXT NOT NULL DEFAULT 'es',
    country_code TEXT,
    description TEXT,
    is_standard INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    pack_id INTEGER REFERENCES packs(id) ON DELETE SET NULL,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_lists_country ON stimulus_lists(country_code);
CREATE INDEX IF NOT EXISTS idx_lists_pack ON stimulus_lists(pack_id);

CREATE TABLE IF NOT EXISTS stimuli (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    token TEXT NOT NULL,
    file_path TEXT,
    duration_ms INTEGER,
    rms_dbfs REAL,
    peak_dbfs REAL,
    sample_rate INTEGER,
    normalized INTEGER NOT NULL DEFAULT 0,
    keywords_json TEXT,
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(list_id, position),
    FOREIGN KEY (list_id) REFERENCES stimulus_lists(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stimuli_list ON stimuli(list_id);

-- ────────────────────────────────────────────────────────────────────
-- Settings globales
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('country_code', 'LATAM');
INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_era', 'v2-packs');
