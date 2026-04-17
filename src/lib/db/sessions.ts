import { getDb } from './client'
import type { TestSession, TestResponse, SessionWithDetails, Ear, ResponseMode, Phase } from '@/types'

export interface CreateSessionInput {
  patient_id: number
  template_id: number
  profile_id: number
  ear?: Ear
  response_mode?: ResponseMode
  config_snapshot?: string
  calibration_id?: number | null
  ref_db_snapshot?: number | null
  calibration_curve_snapshot?: string | null
}

export async function createSession(input: CreateSessionInput): Promise<number> {
  const db = await getDb()
  const res = await db.execute(
    `INSERT INTO test_sessions (patient_id, template_id, profile_id, ear, response_mode, config_snapshot, calibration_id, ref_db_snapshot, calibration_curve_snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      input.patient_id, input.template_id, input.profile_id,
      input.ear ?? 'binaural', input.response_mode ?? 'verbal', input.config_snapshot ?? null,
      input.calibration_id ?? null, input.ref_db_snapshot ?? null,
      input.calibration_curve_snapshot ?? null,
    ]
  )
  return res.lastInsertId ?? 0
}

export async function getSession(id: number): Promise<TestSession | null> {
  const db = await getDb()
  const rows = await db.select<TestSession[]>('SELECT * FROM test_sessions WHERE id = $1', [id])
  return rows[0] ?? null
}

export async function listSessionsByPatient(patientId: number): Promise<SessionWithDetails[]> {
  const db = await getDb()
  return db.select<SessionWithDetails[]>(
    `SELECT s.*,
            (p.first_name || ' ' || p.last_name) AS patient_name,
            t.name AS template_name,
            pr.name AS profile_name
     FROM test_sessions s
     JOIN patients p ON p.id = s.patient_id
     JOIN test_templates t ON t.id = s.template_id
     JOIN profiles pr ON pr.id = s.profile_id
     WHERE s.patient_id = $1
     ORDER BY s.started_at DESC`,
    [patientId]
  )
}

export async function listInProgressSessions(): Promise<SessionWithDetails[]> {
  const db = await getDb()
  return db.select<SessionWithDetails[]>(
    `SELECT s.*,
            (p.first_name || ' ' || p.last_name) AS patient_name,
            t.name AS template_name,
            pr.name AS profile_name
     FROM test_sessions s
     JOIN patients p ON p.id = s.patient_id
     JOIN test_templates t ON t.id = s.template_id
     JOIN profiles pr ON pr.id = s.profile_id
     WHERE s.status = 'in_progress'
     ORDER BY s.started_at DESC`
  )
}

export async function listAllSessions(limit = 100): Promise<SessionWithDetails[]> {
  const db = await getDb()
  return db.select<SessionWithDetails[]>(
    `SELECT s.*,
            (p.first_name || ' ' || p.last_name) AS patient_name,
            t.name AS template_name,
            pr.name AS profile_name
     FROM test_sessions s
     JOIN patients p ON p.id = s.patient_id
     JOIN test_templates t ON t.id = s.template_id
     JOIN profiles pr ON pr.id = s.profile_id
     ORDER BY s.started_at DESC
     LIMIT $1`,
    [limit]
  )
}

export async function finishSession(id: number, scores: {
  practice_score: number
  test_score: number
  total_items: number
  correct_items: number
  notes?: string | null
}): Promise<void> {
  const db = await getDb()
  await db.execute(
    `UPDATE test_sessions
     SET status = 'completed', practice_score = $1, test_score = $2,
         total_items = $3, correct_items = $4, notes = $5,
         completed_at = datetime('now')
     WHERE id = $6`,
    [scores.practice_score, scores.test_score, scores.total_items, scores.correct_items, scores.notes ?? null, id]
  )
}

export async function cancelSession(id: number): Promise<void> {
  const db = await getDb()
  await db.execute(
    `UPDATE test_sessions SET status = 'cancelled', completed_at = datetime('now') WHERE id = $1`,
    [id]
  )
}

export async function deleteSession(id: number): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM test_sessions WHERE id = $1', [id])
}

export interface SaveResponseInput {
  session_id: number
  item_index: number
  phase: Phase
  expected_pattern: string
  given_pattern: string | null
  is_correct: boolean | null
  reaction_time_ms?: number | null
}

export async function saveResponse(input: SaveResponseInput): Promise<number> {
  const db = await getDb()
  const res = await db.execute(
    `INSERT INTO test_responses
     (session_id, item_index, phase, expected_pattern, given_pattern, is_correct, reaction_time_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      input.session_id, input.item_index, input.phase,
      input.expected_pattern, input.given_pattern,
      input.is_correct === null ? null : (input.is_correct ? 1 : 0),
      input.reaction_time_ms ?? null,
    ]
  )
  return res.lastInsertId ?? 0
}

export async function listResponses(sessionId: number): Promise<TestResponse[]> {
  const db = await getDb()
  return db.select<TestResponse[]>(
    'SELECT * FROM test_responses WHERE session_id = $1 ORDER BY item_index',
    [sessionId]
  )
}
