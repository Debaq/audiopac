import { getDb } from './client'
import type { Stimulus, StimulusList, StimulusCategory } from '@/types'

export async function listStimulusLists(countryCode?: string): Promise<StimulusList[]> {
  const db = await getDb()
  if (countryCode) {
    return db.select<StimulusList[]>(
      `SELECT * FROM stimulus_lists
       WHERE is_active = 1 AND (country_code IS NULL OR country_code = $1 OR country_code = 'LATAM')
       ORDER BY is_standard DESC, name`,
      [countryCode]
    )
  }
  return db.select<StimulusList[]>(
    'SELECT * FROM stimulus_lists WHERE is_active = 1 ORDER BY is_standard DESC, name'
  )
}

export async function getStimulusList(id: number): Promise<StimulusList | null> {
  const db = await getDb()
  const rows = await db.select<StimulusList[]>('SELECT * FROM stimulus_lists WHERE id = $1', [id])
  return rows[0] ?? null
}

export async function getStimulusListByCode(code: string): Promise<StimulusList | null> {
  const db = await getDb()
  const rows = await db.select<StimulusList[]>('SELECT * FROM stimulus_lists WHERE code = $1', [code])
  return rows[0] ?? null
}

export async function createStimulusList(input: {
  code: string
  name: string
  category: StimulusCategory
  language?: string
  country_code?: string | null
  description?: string | null
  created_by?: number | null
}): Promise<number> {
  const db = await getDb()
  const res = await db.execute(
    `INSERT INTO stimulus_lists (code, name, category, language, country_code, description, is_standard, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,0,$7)`,
    [
      input.code, input.name, input.category,
      input.language ?? 'es', input.country_code ?? null,
      input.description ?? null, input.created_by ?? null,
    ]
  )
  return res.lastInsertId ?? 0
}

export async function deleteStimulusList(id: number): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM stimulus_lists WHERE id = $1', [id])
}

export async function listStimuli(listId: number): Promise<Stimulus[]> {
  const db = await getDb()
  return db.select<Stimulus[]>(
    'SELECT * FROM stimuli WHERE list_id = $1 ORDER BY position',
    [listId]
  )
}

export async function addStimulusToken(listId: number, token: string): Promise<number> {
  const db = await getDb()
  const rows = await db.select<{ next: number | null }[]>(
    'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM stimuli WHERE list_id = $1',
    [listId]
  )
  const position = rows[0]?.next ?? 1
  const res = await db.execute(
    'INSERT INTO stimuli (list_id, position, token) VALUES ($1,$2,$3)',
    [listId, position, token]
  )
  return res.lastInsertId ?? 0
}

export async function updateStimulusRecording(
  id: number,
  data: {
    file_path: string
    duration_ms: number
    rms_dbfs: number
    peak_dbfs: number
    sample_rate: number
    normalized: boolean
  }
): Promise<void> {
  const db = await getDb()
  await db.execute(
    `UPDATE stimuli
     SET file_path=$1, duration_ms=$2, rms_dbfs=$3, peak_dbfs=$4,
         sample_rate=$5, normalized=$6, updated_at=datetime('now')
     WHERE id=$7`,
    [data.file_path, data.duration_ms, data.rms_dbfs, data.peak_dbfs,
     data.sample_rate, data.normalized ? 1 : 0, id]
  )
}

export async function clearStimulusRecording(id: number): Promise<void> {
  const db = await getDb()
  await db.execute(
    `UPDATE stimuli SET file_path=NULL, duration_ms=NULL, rms_dbfs=NULL, peak_dbfs=NULL,
     sample_rate=NULL, normalized=0, updated_at=datetime('now') WHERE id=$1`,
    [id]
  )
}

export async function updateStimulusKeywords(id: number, keywords: string[] | null): Promise<void> {
  const db = await getDb()
  const json = keywords && keywords.length > 0 ? JSON.stringify(keywords) : null
  await db.execute(
    `UPDATE stimuli SET keywords_json=$1, updated_at=datetime('now') WHERE id=$2`,
    [json, id]
  )
}

export function parseKeywords(s: Stimulus): string[] {
  if (!s.keywords_json) return []
  try {
    const v = JSON.parse(s.keywords_json)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export async function deleteStimulus(id: number): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM stimuli WHERE id = $1', [id])
}

export async function getStimulus(id: number): Promise<Stimulus | null> {
  const db = await getDb()
  const rows = await db.select<Stimulus[]>('SELECT * FROM stimuli WHERE id = $1', [id])
  return rows[0] ?? null
}
