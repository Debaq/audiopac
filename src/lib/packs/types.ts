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
  | 'ssw'
  | 'custom'

export type TestType = 'DPS' | 'PPS' | 'CUSTOM'

export interface PackTestReference {
  citation: string
  url?: string | null
  doi?: string | null
  year?: number | null
}

export interface PackTestAttachment {
  label: string
  url: string
  kind?: 'pdf' | 'video' | 'link'
}

export interface PackTest {
  code: string
  name: string
  test_type: TestType
  description?: string
  config_json: Record<string, unknown>
  is_standard?: 0 | 1
  /** Familia funcional libre (ej: "pac.temporal", "logoaud"). Default: pack.category. */
  family?: string
  /** Markdown clínico para la ficha rica del test. Todos opcionales. */
  purpose_md?: string
  how_it_works_md?: string
  neural_basis_md?: string
  scoring_md?: string
  protocol_md?: string
  target_population_md?: string
  contraindications_md?: string
  estimated_duration_min?: number
  min_age_years?: number
  max_age_years?: number
  references?: PackTestReference[]
  attachments?: PackTestAttachment[]
  /** Marca el test como investigativo / no diagnóstico certificado. */
  investigative?: boolean
  /** Razón (markdown) del flag investigativo. Se muestra al hover del badge. */
  investigative_reason_md?: string
}

/** Meta por test, guardada dentro de `packs.metadata_json.tests_meta[code]`. */
export interface PackTestMeta {
  family?: string
  purpose_md?: string
  how_it_works_md?: string
  neural_basis_md?: string
  scoring_md?: string
  protocol_md?: string
  target_population_md?: string
  contraindications_md?: string
  estimated_duration_min?: number
  min_age_years?: number
  max_age_years?: number
  references?: PackTestReference[]
  attachments?: PackTestAttachment[]
  investigative?: boolean
  investigative_reason_md?: string
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
  doi?: string | null
  year?: number | null
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
  /** Mapa { familyCode → label legible } para mostrar al usuario. */
  families?: Record<string, string>
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
