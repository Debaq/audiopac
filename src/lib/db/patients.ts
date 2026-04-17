import { getDb } from './client'
import type { Patient } from '@/types'

export async function listPatients(search?: string): Promise<Patient[]> {
  const db = await getDb()
  if (search) {
    const q = `%${search}%`
    return db.select<Patient[]>(
      `SELECT * FROM patients
       WHERE first_name LIKE $1 OR last_name LIKE $1 OR document_id LIKE $1
       ORDER BY last_name, first_name`,
      [q]
    )
  }
  return db.select<Patient[]>('SELECT * FROM patients ORDER BY last_name, first_name')
}

export async function getPatient(id: number): Promise<Patient | null> {
  const db = await getDb()
  const rows = await db.select<Patient[]>('SELECT * FROM patients WHERE id = $1', [id])
  return rows[0] ?? null
}

export type PatientInput = Omit<Patient, 'id' | 'created_at' | 'updated_at'>

export async function createPatient(input: PatientInput): Promise<number> {
  const db = await getDb()
  const res = await db.execute(
    `INSERT INTO patients
     (document_id, first_name, last_name, birth_date, gender, phone, email, address, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      input.document_id, input.first_name, input.last_name, input.birth_date,
      input.gender, input.phone, input.email, input.address, input.notes, input.created_by,
    ]
  )
  return res.lastInsertId ?? 0
}

export async function updatePatient(id: number, input: Partial<PatientInput>): Promise<void> {
  const db = await getDb()
  const keys = Object.keys(input) as (keyof PatientInput)[]
  if (!keys.length) return
  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
  const values = keys.map(k => input[k])
  await db.execute(
    `UPDATE patients SET ${sets}, updated_at = datetime('now') WHERE id = $${keys.length + 1}`,
    [...values, id]
  )
}

export async function deletePatient(id: number): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM patients WHERE id = $1', [id])
}
