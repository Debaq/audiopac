import { getDb } from '@/lib/db/client'

export interface ListReadiness {
  list_code: string
  list_id: number | null
  total: number
  recorded: number
  missing: number
}

export async function getListReadiness(code: string): Promise<ListReadiness> {
  const db = await getDb()
  const rows = await db.select<Array<{ id: number; total: number; recorded: number }>>(
    `SELECT sl.id AS id,
            COUNT(s.id) AS total,
            SUM(CASE WHEN s.file_path IS NOT NULL AND s.file_path != '' THEN 1 ELSE 0 END) AS recorded
       FROM stimulus_lists sl
       LEFT JOIN stimuli s ON s.list_id = sl.id
      WHERE sl.code = $1
      GROUP BY sl.id`,
    [code],
  )
  if (rows.length === 0) {
    return { list_code: code, list_id: null, total: 0, recorded: 0, missing: 0 }
  }
  const r = rows[0]
  const total = Number(r.total ?? 0)
  const recorded = Number(r.recorded ?? 0)
  return {
    list_code: code,
    list_id: r.id,
    total,
    recorded,
    missing: Math.max(0, total - recorded),
  }
}

export function readinessFromConfig(cfg: {
  srt?: { stimulus_list_code: string }
  dichotic_digits?: { stimulus_list_code: string }
  hint?: { stimulus_list_code: string }
  matrix?: { stimulus_list_code: string }
}): string | null {
  return cfg.srt?.stimulus_list_code
    ?? cfg.dichotic_digits?.stimulus_list_code
    ?? cfg.hint?.stimulus_list_code
    ?? cfg.matrix?.stimulus_list_code
    ?? null
}
