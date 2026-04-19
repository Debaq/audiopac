import type { Ear, Patient, TestSession } from '@/types'

/** id sintético para sessions/patients de preview (ningún registro real tiene id < 0). */
export const PREVIEW_SESSION_ID = -1
export const PREVIEW_PATIENT_ID = -1

export function isPreviewSession(s: { id: number } | null | undefined): boolean {
  return !!s && s.id < 0
}

export function buildPreviewPatient(): Patient {
  const now = new Date().toISOString()
  return {
    id: PREVIEW_PATIENT_ID,
    document_id: null,
    first_name: 'Paciente',
    last_name: 'Demo',
    birth_date: null,
    gender: null,
    phone: null,
    email: null,
    address: null,
    notes: null,
    created_by: null,
    created_at: now,
    updated_at: now,
  }
}

export function buildPreviewSession(template_id: number, ear: Ear = 'binaural'): TestSession {
  const now = new Date().toISOString()
  return {
    id: PREVIEW_SESSION_ID,
    patient_id: PREVIEW_PATIENT_ID,
    template_id,
    profile_id: PREVIEW_PATIENT_ID,
    ear,
    response_mode: 'manual',
    status: 'in_progress',
    practice_score: null,
    test_score: null,
    total_items: 0,
    correct_items: 0,
    notes: null,
    config_snapshot: null,
    calibration_id: null,
    ref_db_snapshot: null,
    calibration_curve_snapshot: null,
    started_at: now,
    completed_at: null,
  }
}

/** Duración nominal a esperar en preview cuando no hay audio (ms). */
export const PREVIEW_PLAY_MS = 1200
