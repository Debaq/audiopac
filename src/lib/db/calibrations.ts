import { getDb } from './client'
import type { CalibWeighting, Calibration, CalibrationPoint, Ear, NoiseCalibrationPoint, NoiseCalibType } from '@/types'

export interface CreateCalibrationInput {
  label: string
  device_id?: string | null
  device_label?: string | null
  headphone_model?: string | null
  ear?: Ear
  frequency_hz?: number
  internal_level_dbfs: number
  measured_db_spl: number
  ref_db_spl: number
  valid_until?: string | null
  notes?: string | null
  created_by?: number | null
  activate?: boolean
}

function defaultValidUntil(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 6)
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

export async function createCalibration(input: CreateCalibrationInput): Promise<number> {
  const db = await getDb()
  if (input.activate) {
    await db.execute('UPDATE calibrations SET is_active = 0')
  }
  const res = await db.execute(
    `INSERT INTO calibrations
     (label, device_id, device_label, headphone_model, ear, frequency_hz, internal_level_dbfs,
      measured_db_spl, ref_db_spl, is_active, created_by, valid_until, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      input.label, input.device_id ?? null, input.device_label ?? null,
      input.headphone_model ?? null,
      input.ear ?? 'binaural', input.frequency_hz ?? 1000, input.internal_level_dbfs,
      input.measured_db_spl, input.ref_db_spl, input.activate ? 1 : 0,
      input.created_by ?? null, input.valid_until ?? defaultValidUntil(), input.notes ?? null,
    ]
  )
  return res.lastInsertId ?? 0
}

export function isCalibrationExpired(c: Calibration): boolean {
  if (!c.valid_until) return false
  return new Date(c.valid_until) < new Date()
}

export interface UpsertPointInput {
  calibration_id: number
  frequency_hz: number
  ear: Ear
  internal_level_dbfs: number
  measured_db_spl: number
  ref_db_spl: number
  weighting?: CalibWeighting
}

export async function upsertPoint(input: UpsertPointInput): Promise<void> {
  const db = await getDb()
  await db.execute(
    `INSERT INTO calibration_points
       (calibration_id, frequency_hz, ear, internal_level_dbfs, measured_db_spl, ref_db_spl, weighting)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT(calibration_id, frequency_hz, ear)
     DO UPDATE SET internal_level_dbfs=excluded.internal_level_dbfs,
                   measured_db_spl=excluded.measured_db_spl,
                   ref_db_spl=excluded.ref_db_spl,
                   weighting=excluded.weighting,
                   created_at=datetime('now')`,
    [input.calibration_id, input.frequency_hz, input.ear, input.internal_level_dbfs, input.measured_db_spl, input.ref_db_spl, input.weighting ?? 'Z']
  )
}

export async function listPoints(calibrationId: number): Promise<CalibrationPoint[]> {
  const db = await getDb()
  return db.select<CalibrationPoint[]>(
    'SELECT * FROM calibration_points WHERE calibration_id = $1 ORDER BY ear, frequency_hz',
    [calibrationId]
  )
}

export async function deletePoint(id: number): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM calibration_points WHERE id = $1', [id])
}

export async function getActiveCurve(): Promise<CalibrationPoint[]> {
  const cal = await getActiveCalibration()
  if (!cal) return []
  return listPoints(cal.id)
}

export async function listCalibrations(): Promise<Calibration[]> {
  const db = await getDb()
  return db.select<Calibration[]>(
    'SELECT * FROM calibrations ORDER BY is_active DESC, created_at DESC'
  )
}

export async function getActiveCalibration(): Promise<Calibration | null> {
  const db = await getDb()
  const rows = await db.select<Calibration[]>(
    'SELECT * FROM calibrations WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1'
  )
  return rows[0] ?? null
}

export async function setActiveCalibration(id: number): Promise<void> {
  const db = await getDb()
  await db.execute('UPDATE calibrations SET is_active = 0')
  await db.execute('UPDATE calibrations SET is_active = 1 WHERE id = $1', [id])
}

export async function deleteCalibration(id: number): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM calibrations WHERE id = $1', [id])
}

export interface UpsertNoisePointInput {
  calibration_id: number
  noise_type: NoiseCalibType
  internal_level_dbfs: number
  measured_db_spl: number
  ref_db_spl: number
  weighting?: CalibWeighting
}

export async function upsertNoisePoint(input: UpsertNoisePointInput): Promise<void> {
  const db = await getDb()
  await db.execute(
    `INSERT INTO noise_calibration_points
       (calibration_id, noise_type, internal_level_dbfs, measured_db_spl, ref_db_spl, weighting)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT(calibration_id, noise_type)
     DO UPDATE SET internal_level_dbfs=excluded.internal_level_dbfs,
                   measured_db_spl=excluded.measured_db_spl,
                   ref_db_spl=excluded.ref_db_spl,
                   weighting=excluded.weighting,
                   created_at=datetime('now')`,
    [input.calibration_id, input.noise_type, input.internal_level_dbfs, input.measured_db_spl, input.ref_db_spl, input.weighting ?? 'Z']
  )
}

export async function listNoisePoints(calibrationId: number): Promise<NoiseCalibrationPoint[]> {
  const db = await getDb()
  return db.select<NoiseCalibrationPoint[]>(
    'SELECT * FROM noise_calibration_points WHERE calibration_id = $1 ORDER BY noise_type',
    [calibrationId]
  )
}

export async function deleteNoisePoint(id: number): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM noise_calibration_points WHERE id = $1', [id])
}

export async function getActiveNoisePoints(): Promise<NoiseCalibrationPoint[]> {
  const cal = await getActiveCalibration()
  if (!cal) return []
  return listNoisePoints(cal.id)
}
