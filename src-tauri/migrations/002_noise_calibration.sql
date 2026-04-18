-- Calibración de ruido (Fase 5 — strict noise SPL).
-- Mide SPL real del buffer de ruido (white/pink/ssn) por calibración activa.
-- Reemplaza estimaciones hardcoded en engine (-5/-15/-20 dBFS RMS).

CREATE TABLE IF NOT EXISTS noise_calibration_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calibration_id INTEGER NOT NULL,
    noise_type TEXT NOT NULL CHECK(noise_type IN ('white','pink','ssn')),
    internal_level_dbfs REAL NOT NULL,
    measured_db_spl REAL NOT NULL,
    ref_db_spl REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(calibration_id, noise_type),
    FOREIGN KEY (calibration_id) REFERENCES calibrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_noise_cal_points_cal ON noise_calibration_points(calibration_id);
