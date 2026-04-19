export type Ear = 'left' | 'right' | 'binaural'
export type ResponseMode = 'verbal' | 'hummed' | 'manual'
export type TestType = 'DPS' | 'PPS' | 'CUSTOM' | 'SSW'
export type SessionStatus = 'in_progress' | 'completed' | 'cancelled'
export type Phase = 'practice' | 'test' | 'catch'

export interface Profile {
  id: number
  name: string
  avatar: string | null
  color: string
  pin_hash: string | null
  created_at: string
  updated_at: string
}

export interface Patient {
  id: number
  document_id: string | null
  first_name: string
  last_name: string
  birth_date: string | null
  gender: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_by: number | null
  created_at: string
  updated_at: string
}

export type NoiseType = 'white' | 'pink' | 'narrow' | 'ssn'

export interface NoiseMix {
  noise_type: NoiseType
  level_db: number
  center_hz?: number
  bandwidth_hz?: number
}

export interface ToneDefinition {
  label: string
  duration_ms?: number
  frequency?: number
  level_db?: number
  ear?: Ear
  gain_l?: number
  gain_r?: number
  kind?: 'tone' | 'noise'
  noise_type?: NoiseType
  center_hz?: number
  bandwidth_hz?: number
  gap_at_ms?: number
  gap_width_ms?: number
  noise_mix?: NoiseMix
  phase_invert_right?: boolean
}

export type SRTMethod = 'hughson_westlake_mod' | 'chaiklin_ventry' | 'descending_simple'

export interface SRTCarrierPhrase {
  /** Token de la lista que se reproduce antes del target (ej. "diga"). */
  audio_token: string
  /** Silencio tras la portadora y antes del target, ms. */
  lead_in_ms: number
}

export interface SRTFamiliarization {
  enabled: boolean
  /** Nivel demo, típicamente alto (SRT+30). */
  level_db: number
  /** Mostrar palabras al paciente durante la fase. */
  show_list: boolean
  /** Palabras de demo antes del test. */
  count?: number
}

export interface SRTMasking {
  enabled: boolean
  noise_type: NoiseType
  /** dB bajo el nivel del signal. Positivo = máscara más débil. */
  offset_db: number
  /** Si true, máscara sigue al signal nivel por nivel. */
  follow_level: boolean
}

export type SRTCutoffRule =
  | { kind: 'bracketing' }
  | { kind: 'fixed_trials'; trials: number }
  | { kind: 'plateau'; consecutive_levels: number; delta_db: number }

export interface SRTParams {
  stimulus_list_code: string
  start_level_db: number
  words_per_level: number
  step_down_db: number
  step_up_db: number
  min_level_db: number
  max_level_db: number
  threshold_pass_ratio: number
  max_total_trials?: number
  /** Método adaptativo. Default 'hughson_westlake_mod'. */
  method?: SRTMethod
  carrier_phrase?: SRTCarrierPhrase | null
  familiarization?: SRTFamiliarization | null
  masking?: SRTMasking | null
  cutoff_rule?: SRTCutoffRule
}

export type DichoticMode = 'free' | 'directed'
export type DichoticBlockOrder = 'lrlr' | 'llrr' | 'interleaved'
export type DichoticScoringGranularity = 'per_pair' | 'per_position' | 'per_digit'
export type DichoticCatchPlacement = 'random' | 'every_n' | 'start_end'

export interface DichoticPairDef {
  left: string[]
  right: string[]
}

export interface DichoticCatchTrials {
  enabled: boolean
  count: number
  placement: DichoticCatchPlacement
}

export interface DichoticDigitsParams {
  stimulus_list_code: string
  num_pairs: number
  digits_per_ear: number
  isi_ms: number
  level_db: number
  mode: DichoticMode
  /** Default true. Si false, usa `fixed_pairs` (si existen). */
  randomize?: boolean
  /** Pares fijos definidos por el investigador. Tokens deben existir en la lista. */
  fixed_pairs?: DichoticPairDef[]
  /** Orden de bloques en modo dirigido. Default 'lrlr'. */
  directed_block_order?: DichoticBlockOrder
  /** Catch trials (pares mono) para validar atención. */
  catch_trials?: DichoticCatchTrials | null
  /** Granularidad de scoring. Default 'per_pair'. */
  scoring_granularity?: DichoticScoringGranularity
  /** Markdown de práctica pre-test. */
  practice_instructions_md?: string
}

export interface TestConfig {
  frequency?: number
  tones: Record<string, ToneDefinition>
  duration_ms?: number
  isi_ms: number
  iri_ms: number
  envelope_ms: number
  pattern_length: number
  practice_sequences: string[]
  test_sequences: string[]
  channel: Ear
  level_db: number
  srt?: SRTParams
  dichotic_digits?: DichoticDigitsParams
  hint?: HINTParams
  matrix?: MatrixParams
  ssw?: SSWParams
  family?: string
  /** Consigna al paciente, markdown, mostrada pre-start. */
  patient_instructions_md?: string
  /** Notas libres del examinador. */
  examiner_notes_md?: string
  /** Feedback durante el test. */
  feedback?: {
    practice: 'off' | 'correct_incorrect' | 'with_text'
    test: 'off' | 'correct_incorrect'
    practice_text_md?: string
  }
  /** Timeout de respuesta (ms). 0/null = sin timeout. */
  response_timeout_ms?: number
  /** Escape hatch: overrides arbitrarios que el runner lee. */
  advanced_json?: Record<string, unknown>
}

export interface TestTemplate {
  id: number
  code: string
  name: string
  test_type: TestType
  description: string | null
  config_json: string
  is_standard: number
  is_active: number
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface TestTemplateParsed extends Omit<TestTemplate, 'config_json'> {
  config: TestConfig
}

export interface TestSession {
  id: number
  patient_id: number
  template_id: number
  profile_id: number
  ear: Ear
  response_mode: ResponseMode
  status: SessionStatus
  practice_score: number | null
  test_score: number | null
  total_items: number
  correct_items: number
  notes: string | null
  config_snapshot: string | null
  calibration_id: number | null
  ref_db_snapshot: number | null
  calibration_curve_snapshot: string | null
  started_at: string
  completed_at: string | null
}

export interface CalibrationPoint {
  id: number
  calibration_id: number
  frequency_hz: number
  ear: Ear
  internal_level_dbfs: number
  measured_db_spl: number
  ref_db_spl: number
  created_at: string
}

export type NoiseCalibType = 'white' | 'pink' | 'ssn'

export interface NoiseCalibrationPoint {
  id: number
  calibration_id: number
  noise_type: NoiseCalibType
  internal_level_dbfs: number
  measured_db_spl: number
  ref_db_spl: number
  created_at: string
}

export interface TestResponse {
  id: number
  session_id: number
  item_index: number
  phase: Phase
  expected_pattern: string
  given_pattern: string | null
  is_correct: number | null
  reaction_time_ms: number | null
  presented_at: string
}

export interface SessionWithDetails extends TestSession {
  patient_name: string
  template_name: string
  profile_name: string
}

export type StimulusCategory = 'srt' | 'discrimination' | 'dichotic_digits' | 'sentence' | 'matrix' | 'ssw' | 'custom'

export interface StimulusList {
  id: number
  code: string
  name: string
  category: StimulusCategory
  language: string
  country_code: string | null
  description: string | null
  is_standard: number
  is_active: number
  created_by: number | null
  created_at: string
}

export interface Stimulus {
  id: number
  list_id: number
  position: number
  token: string
  file_path: string | null
  duration_ms: number | null
  rms_dbfs: number | null
  peak_dbfs: number | null
  sample_rate: number | null
  normalized: number
  keywords_json: string | null
  metadata_json: string | null
  created_at: string
  updated_at: string
}

export interface HINTParams {
  stimulus_list_code: string
  /** SNR inicial en dB (voz − ruido). Típico +5 a +10 dB. */
  start_snr_db: number
  /** Nivel ruido fijo en dB SPL. Voz = noise + snr. */
  noise_level_db: number
  /** Tipo de ruido enmascarante. 'pink' por defecto (aproximación habla). */
  noise_type: NoiseType
  /** Frases por nivel de SNR antes de decidir paso. */
  sentences_per_level: number
  /** Ratio de keywords correctos para pasar ≥ threshold. */
  threshold_pass_ratio: number
  /** Pasos SNR. */
  step_down_db: number
  step_up_db: number
  min_snr_db: number
  max_snr_db: number
  max_total_trials?: number
}

export interface MatrixParams {
  /** Lista con las 50 palabras (columns × 10). Cada stimulus lleva metadata.column (0..columns-1). */
  stimulus_list_code: string
  columns: number
  start_snr_db: number
  noise_level_db: number
  noise_type: NoiseType
  /** Gap entre palabras dentro de una frase, en ms. */
  inter_word_gap_ms: number
  sentences_per_level: number
  /** Ratio de palabras correctas para pasar. p.ej. 0.6 = 3/5. */
  threshold_pass_ratio: number
  step_down_db: number
  step_up_db: number
  min_snr_db: number
  max_snr_db: number
  max_total_trials?: number
}

export type SSWEarFirstOrder = 'RLRL' | 'LRLR' | 'RRLL' | 'random' | 'fixed_R' | 'fixed_L'

export interface SSWParams {
  /** Lista SSW con 160 hemispondees marcados en metadata.ssw_item/side/position. */
  stimulus_list_code: string
  /** Nivel presentación por canal, dB HL. Típico SRT+50. */
  level_db: number
  /** Ítems a presentar (default 40). */
  num_items?: number
  /** Cómo alternar ear-first por ítem. */
  ear_first_order?: SSWEarFirstOrder
  /** Mostrar pair_label al paciente (raro — sólo ensayo). */
  show_pair_label?: boolean
  /** ISI entre ítems, ms. */
  iri_ms?: number
  /**
   * Catch trials de atención. Cada `every_n` ítems se interrumpe con una
   * pregunta "¿qué oído escuchaste primero?" sobre el trial recién respondido.
   * No requiere audio extra — valida si el paciente está atento y puede
   * discriminar lateralización.
   */
  catch_trials?: {
    enabled: boolean
    every_n: number
  } | null
}

export interface SSWStimulusMeta {
  ssw_item: number
  side: 'R' | 'L'
  position: 1 | 2
  pair_label?: string
}

export interface SSWConditionScore {
  correct: number
  total: number
  error_pct: number
}

export interface SSWScore {
  total_errors: number
  total_items: number
  raw_score_pct: number
  by_condition: Record<'RNC' | 'RC' | 'LC' | 'LNC', SSWConditionScore>
  by_ear: { R: { errors: number; total: number }; L: { errors: number; total: number } }
  /** (L_err − R_err) / total_per_ear * 100. Positivo = peor L. */
  ear_effect_pct: number
  /** ((RNC+LC) − (RC+LNC)) / total_per_cond. */
  order_effect_pct: number
  reversals: number
  corrected_score_pct?: number
  response_bias: 'none' | 'left' | 'right'
  qualifiers: string[]
  /** Catch trials de atención (si están habilitados). */
  catch_correct?: number
  catch_total?: number
  catch_accuracy_pct?: number
}

export interface Calibration {
  id: number
  label: string
  device_id: string | null
  device_label: string | null
  headphone_model: string | null
  ear: Ear
  frequency_hz: number
  internal_level_dbfs: number
  measured_db_spl: number
  ref_db_spl: number
  is_active: number
  created_by: number | null
  created_at: string
  valid_until: string | null
  notes: string | null
}
