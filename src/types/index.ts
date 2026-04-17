export type Ear = 'left' | 'right' | 'binaural'
export type ResponseMode = 'verbal' | 'hummed' | 'manual'
export type TestType = 'DPS' | 'PPS' | 'CUSTOM'
export type SessionStatus = 'in_progress' | 'completed' | 'cancelled'
export type Phase = 'practice' | 'test'

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

export interface ToneDefinition {
  label: string
  duration_ms?: number
  frequency?: number
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
  started_at: string
  completed_at: string | null
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
