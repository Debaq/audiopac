-- Fase 3: calibración multi-frecuencia separada por oído
-- Tabla de puntos: una calibración = varios puntos (freq × ear). Interpolación log-freq en runtime.

CREATE TABLE IF NOT EXISTS calibration_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calibration_id INTEGER NOT NULL,
    frequency_hz INTEGER NOT NULL,
    ear TEXT NOT NULL CHECK(ear IN ('left', 'right', 'binaural')),
    internal_level_dbfs REAL NOT NULL,
    measured_db_spl REAL NOT NULL,
    ref_db_spl REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(calibration_id, frequency_hz, ear),
    FOREIGN KEY (calibration_id) REFERENCES calibrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cal_points_cal ON calibration_points(calibration_id);

-- Backfill: migrar filas de calibrations a un punto cada una (el header queda como resumen).
INSERT OR IGNORE INTO calibration_points
  (calibration_id, frequency_hz, ear, internal_level_dbfs, measured_db_spl, ref_db_spl)
SELECT id, frequency_hz, ear, internal_level_dbfs, measured_db_spl, ref_db_spl
FROM calibrations;

-- Snapshot inmutable de la curva en la sesión (JSON array de puntos).
ALTER TABLE test_sessions ADD COLUMN calibration_curve_snapshot TEXT;
