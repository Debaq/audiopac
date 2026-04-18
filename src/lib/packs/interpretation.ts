import { getDb } from '@/lib/db/client'
import type { PackInterpretation, PackInterpretationNorm, PackReference, PackTestMeta } from './types'

export interface TemplatePackInfo {
  pack_id: number
  code: string
  name: string
  version: string
  interpretation: PackInterpretation | null
  references: PackReference[] | null
  description_md: string | null
  report_template_md: string | null
}

interface PackRow {
  id: number
  code: string
  name: string
  version: string
  interpretation_json: string | null
  references_json: string | null
  description_md: string | null
  metadata_json: string | null
}

export async function getPackForTemplate(templateId: number): Promise<TemplatePackInfo | null> {
  const db = await getDb()
  const rows = await db.select<PackRow[]>(
    `SELECT p.id, p.code, p.name, p.version, p.interpretation_json, p.references_json, p.description_md, p.metadata_json
     FROM test_templates t
     JOIN packs p ON t.pack_id = p.id
     WHERE t.id = $1`,
    [templateId],
  )
  if (rows.length === 0) return null
  const r = rows[0]
  let reportTemplate: string | null = null
  if (r.metadata_json) {
    try {
      const m = JSON.parse(r.metadata_json) as Record<string, unknown>
      if (typeof m.report_template_md === 'string') reportTemplate = m.report_template_md
    } catch { /* ignore */ }
  }
  return {
    pack_id: r.id,
    code: r.code,
    name: r.name,
    version: r.version,
    interpretation: r.interpretation_json ? JSON.parse(r.interpretation_json) as PackInterpretation : null,
    references: r.references_json ? JSON.parse(r.references_json) as PackReference[] : null,
    description_md: r.description_md,
    report_template_md: reportTemplate,
  }
}

/**
 * Reemplaza `{{key}}` en template markdown con valores del contexto.
 * Placeholders faltantes → se dejan como `—`.
 */
export function fillReportTemplate(
  template: string,
  ctx: Record<string, string | number | null | undefined>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = ctx[key]
    if (v === null || v === undefined || v === '') return '—'
    return String(v)
  })
}

export function pickNormBand(
  norms: PackInterpretationNorm[] | undefined,
  age: number | null,
): PackInterpretationNorm | null {
  if (!norms || norms.length === 0) return null
  if (age === null) return norms[0]
  return norms.find(n => age >= n.age_min && age <= n.age_max) ?? null
}

export type Verdict = 'normal' | 'borderline' | 'abnormal'

/**
 * Metrica direccion:
 * - accuracy_pct, asymmetry_pct → mayor = mejor (normal_min es piso)
 * - srt_db, gap_ms → menor = mejor (normal_min es techo, pese al nombre del campo)
 */
export function evaluateNorm(
  metric: string,
  value: number,
  band: PackInterpretationNorm,
): Verdict {
  const higherBetter = metric === 'accuracy_pct' || metric === 'asymmetry_pct'
  if (higherBetter) {
    if (band.normal_min !== undefined && value >= band.normal_min) return 'normal'
    if (band.mild_min !== undefined && value >= band.mild_min) return 'borderline'
    return 'abnormal'
  }
  // lower-is-better
  if (band.normal_min !== undefined && value <= band.normal_min) return 'normal'
  if (band.mild_min !== undefined && value <= band.mild_min) return 'borderline'
  return 'abnormal'
}

export function bandLabel(metric: string, band: PackInterpretationNorm): string {
  const higherBetter = metric === 'accuracy_pct' || metric === 'asymmetry_pct'
  const unit = metric === 'accuracy_pct' || metric === 'asymmetry_pct' ? '%'
    : metric === 'srt_db' ? ' dB'
    : metric === 'gap_ms' ? ' ms'
    : ''
  const parts: string[] = []
  if (band.normal_min !== undefined) {
    parts.push(`Normal ${higherBetter ? '≥' : '≤'}${band.normal_min}${unit}`)
  }
  if (band.mild_min !== undefined) {
    parts.push(`Limítrofe ${higherBetter ? '≥' : '≤'}${band.mild_min}${unit}`)
  }
  if (band.severe_max !== undefined) {
    parts.push(`Bajo ${higherBetter ? '≤' : '≥'}${band.severe_max}${unit}`)
  }
  return parts.join(' · ')
}

export interface TemplateRichMeta {
  pack_id: number
  pack_code: string
  pack_name: string
  pack_category: string | null
  test_meta: PackTestMeta | null
}

/**
 * Devuelve la ficha clínica rica (purpose/protocol/referencias/etc) para
 * un template, leída desde `packs.metadata_json.tests_meta[code]`.
 */
export async function getTemplateRichMeta(templateId: number): Promise<TemplateRichMeta | null> {
  const db = await getDb()
  const rows = await db.select<{
    pack_id: number
    pack_code: string
    pack_name: string
    pack_category: string | null
    template_code: string
    metadata_json: string | null
  }[]>(
    `SELECT p.id AS pack_id, p.code AS pack_code, p.name AS pack_name,
            p.category AS pack_category, t.code AS template_code, p.metadata_json
     FROM test_templates t JOIN packs p ON t.pack_id = p.id
     WHERE t.id = $1`,
    [templateId],
  )
  if (rows.length === 0) return null
  const r = rows[0]
  let test_meta: PackTestMeta | null = null
  if (r.metadata_json) {
    try {
      const parsed = JSON.parse(r.metadata_json) as { tests_meta?: Record<string, PackTestMeta> }
      test_meta = parsed.tests_meta?.[r.template_code] ?? null
    } catch { /* ignore */ }
  }
  return {
    pack_id: r.pack_id,
    pack_code: r.pack_code,
    pack_name: r.pack_name,
    pack_category: r.pack_category,
    test_meta,
  }
}

/** Pack info ligero + family opcional por test, para armar el árbol de /tests. */
export interface TemplateTreeInfo {
  template_id: number
  pack_id: number | null
  pack_name: string | null
  pack_category: string | null
  family: string | null
  family_label: string | null
}

export async function listTemplateTreeInfo(): Promise<Map<number, TemplateTreeInfo>> {
  const db = await getDb()
  const rows = await db.select<{
    template_id: number
    template_code: string
    pack_id: number | null
    pack_name: string | null
    pack_category: string | null
    metadata_json: string | null
  }[]>(
    `SELECT t.id AS template_id, t.code AS template_code, t.pack_id,
            p.name AS pack_name, p.category AS pack_category, p.metadata_json
     FROM test_templates t
     LEFT JOIN packs p ON t.pack_id = p.id
     WHERE t.is_active = 1`,
  )
  const map = new Map<number, TemplateTreeInfo>()
  for (const r of rows) {
    let family: string | null = null
    let family_label: string | null = null
    if (r.metadata_json) {
      try {
        const parsed = JSON.parse(r.metadata_json) as {
          tests_meta?: Record<string, PackTestMeta>
          families?: Record<string, string>
        }
        family = parsed.tests_meta?.[r.template_code]?.family ?? null
        if (family && parsed.families?.[family]) family_label = parsed.families[family]
      } catch { /* ignore */ }
    }
    map.set(r.template_id, {
      template_id: r.template_id,
      pack_id: r.pack_id,
      pack_name: r.pack_name,
      pack_category: r.pack_category,
      family,
      family_label,
    })
  }
  return map
}

/** Si el metric es auto-calculable desde test_score, devuelve el valor. Sino null. */
export function deriveMetricValue(metric: string, testScore: number | null): number | null {
  if (testScore === null) return null
  if (metric === 'accuracy_pct' || metric === 'asymmetry_pct') return testScore * 100
  return null
}
