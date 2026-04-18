// Schema canónico de pack (espejo del que usa audiopac-assets/packs/*.json).
// Ver docs/ROADMAP_PAC.md sección Fase 6.

export type PackRequirements = 'ninguno' | 'recording' | 'audio_pack'

export type PackCategory =
  | 'pac.patterns'
  | 'pac.limens'
  | 'pac.temporal'
  | 'pac.binaural'
  | 'pac.noise'
  | 'pac.mld'
  | 'logoaudiometry'
  | 'dichotic'
  | 'hint'
  | 'sentence-corpus'

export type StimulusListCategory =
  | 'srt'
  | 'discrimination'
  | 'dichotic_digits'
  | 'sentence'
  | 'custom'

export type TestType = 'DPS' | 'PPS' | 'CUSTOM'

export interface PackTest {
  code: string
  name: string
  test_type: TestType
  description?: string
  config_json: Record<string, unknown>
  is_standard?: 0 | 1
}

export interface PackStimulusItem {
  pos: number
  token: string
  keywords?: string[] | null
  metadata?: Record<string, unknown> | null
}

export interface PackStimulusList {
  code: string
  name: string
  category: StimulusListCategory
  language?: string
  country_code?: string | null
  description?: string
  items: PackStimulusItem[]
}

export interface PackInterpretationNorm {
  age_min: number
  age_max: number
  normal_min?: number
  normal_max?: number
  mild_min?: number
  mild_max?: number
  severe_min?: number
  severe_max?: number
}

export interface PackInterpretation {
  metric: string
  norms_by_age?: PackInterpretationNorm[]
  description_md?: string
}

export interface PackAuthor {
  name: string
  url?: string
}

export interface PackReference {
  citation: string
  url?: string | null
}

export interface PackManifest {
  id: string
  version: string
  name: string
  category: PackCategory
  description_md: string
  requirements: PackRequirements
  license: string
  author: PackAuthor
  references?: PackReference[]
  tests?: PackTest[]
  lists?: PackStimulusList[]
  /** Para sharvard-es-v1: apunta a un catalogo existente con las listas. */
  lists_ref?: string
  interpretation?: PackInterpretation | null
  /**
   * Markdown con placeholders que se renderiza en `SessionReportPage`.
   * Placeholders soportados: `{{patient_name}}`, `{{patient_age}}`, `{{test_name}}`,
   * `{{test_code}}`, `{{date}}`, `{{ear}}`, `{{examiner}}`, `{{accuracy_pct}}`,
   * `{{correct}}`, `{{total}}`, `{{verdict}}`, `{{rt_mean_ms}}`, `{{rt_median_ms}}`,
   * `{{asymmetry_pct}}`, `{{srt_db}}`, `{{metric_value}}`, `{{norm_band}}`.
   */
  report_template_md?: string
  metadata?: Record<string, unknown>
}

export interface PacksIndexEntry {
  id: string
  version: string
  name: string
  category: PackCategory
  requirements: PackRequirements
  license: string
  url: string
  sha256: string
  bytes: number
}
