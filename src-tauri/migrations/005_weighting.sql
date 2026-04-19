-- Ponderación del sonómetro (A/C/Z) por punto de calibración.
-- Los sonómetros baratos suelen medir en dBA. Almacenamos la lectura original
-- + la ponderación usada, y convertimos a dB SPL (Z/flat) antes de guardar
-- ref_db_spl (que sigue siendo la referencia canónica para el motor de audio).

ALTER TABLE calibration_points ADD COLUMN weighting TEXT NOT NULL DEFAULT 'Z'
    CHECK(weighting IN ('A','C','Z'));

ALTER TABLE noise_calibration_points ADD COLUMN weighting TEXT NOT NULL DEFAULT 'Z'
    CHECK(weighting IN ('A','C','Z'));
