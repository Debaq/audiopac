-- Fase 2: detección cambio device/volumen
-- Captura label del device de salida (el id expira entre sesiones) y
-- fija expiración default de 6 meses para bloquear uso con calibración vieja.

ALTER TABLE calibrations ADD COLUMN device_label TEXT;

-- Backfill: 6 meses desde created_at para calibraciones sin valid_until
UPDATE calibrations
SET valid_until = datetime(created_at, '+6 months')
WHERE valid_until IS NULL;
