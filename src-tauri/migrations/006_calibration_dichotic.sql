-- Calibración con sonómetro + extensiones para test dichotic

CREATE TABLE IF NOT EXISTS calibrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    device_id TEXT,
    headphone_model TEXT,
    ear TEXT NOT NULL DEFAULT 'binaural' CHECK(ear IN ('left', 'right', 'binaural')),
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

-- Snapshot de calibración en sesión (inmutable para informes)
ALTER TABLE test_sessions ADD COLUMN calibration_id INTEGER REFERENCES calibrations(id) ON DELETE SET NULL;
ALTER TABLE test_sessions ADD COLUMN ref_db_snapshot REAL;

-- Plantilla demo dichotic (patrones con "|")
INSERT OR IGNORE INTO test_templates (code, name, test_type, description, is_standard, config_json) VALUES
('DICHOTIC_NV', 'Dichotic no verbal (tonos L≠R)', 'CUSTOM',
 'Escucha dicótica no verbal - Secuencias distintas L y R simultáneas. Paciente reporta lo oído en cada oído. Formato patrón: "IZQ|DER" (ej. "LHL|HLH").',
 1,
 '{"tones":{"L":{"label":"Grave","frequency":880},"H":{"label":"Agudo","frequency":1430}},"duration_ms":250,"isi_ms":350,"iri_ms":7000,"envelope_ms":10,"pattern_length":3,"practice_sequences":["LHL|HLH","HLH|LHL","LLH|HHL","HHL|LLH"],"test_sequences":["LHL|HLH","HLH|LHL","LLH|HHL","HHL|LLH","LHH|HLL","HLL|LHH","LHL|HHL","HLH|LLH","LLH|HLH","HHL|LHL","LHL|LHH","HLH|HLL","LLH|LHL","HHL|HLH","LHH|HHL","HLL|LLH"],"channel":"binaural","level_db":60}'),

('FUSION_BIN', 'Fusión binaural tonal', 'CUSTOM',
 'Fusión binaural - Tono partido: mitad temporal al oído L, otra mitad al R. Se presenta como patrón alternado. "A|B" con ambos el mismo token fusiona perceptualmente.',
 1,
 '{"frequency":1000,"tones":{"A":{"label":"Tono","frequency":1000,"duration_ms":200}},"isi_ms":100,"iri_ms":3000,"envelope_ms":10,"pattern_length":2,"practice_sequences":["AA|AA","A|A"],"test_sequences":["A|A","AA|AA","A|A","AA|AA","A|A","AA|AA","A|A","AA|AA","A|A","AA|AA","A|A","AA|AA"],"channel":"binaural","level_db":60}');
