import type { MatrixParams, Stimulus, Ear } from '@/types'
import { loadStimulusBuffer, playStimulusSequenceWithNoise, type CalibCurvePoint, resolveRefDb } from './engine'
import { loadStimulusWav } from '@/lib/fs/stimuli'
import { parseStimMetadata } from '@/lib/db/stimuli'

export interface MatrixTrial {
  index: number
  snr_db: number
  /** Stimulus id elegido por columna (0..columns-1). */
  stim_ids: number[]
  /** Tokens correspondientes (palabra correcta por columna). */
  expected: string[]
  /** Token seleccionado por el usuario en cada columna. null si sin marcar. */
  given?: (string | null)[]
  correct_count?: number
  pass?: boolean
  presented_at?: number
  answered_at?: number
}

export interface MatrixLevelStat {
  snr_db: number
  presented: number
  passed: number
  completed: boolean
  pass?: boolean
}

export interface MatrixState {
  currentSnr: number
  trials: MatrixTrial[]
  levelStats: MatrixLevelStat[]
  isPlaying: boolean
  finished: boolean
  srtSnrDb: number | null
  ended_reason: 'bracketed' | 'floor' | 'ceiling' | 'max_trials' | 'manual' | null
}

interface PrevResponse {
  item_index: number
  expected_pattern: string
  given_pattern: string | null
  is_correct: number | null
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Agrupa estímulos grabados por columna (metadata.column 0..columns-1). */
export function groupByColumn(stimuli: Stimulus[], columns: number): Stimulus[][] {
  const cols: Stimulus[][] = Array.from({ length: columns }, () => [])
  for (const s of stimuli) {
    if (!s.file_path) continue
    const meta = parseStimMetadata(s)
    const c = typeof meta.column === 'number' ? meta.column : -1
    if (c >= 0 && c < columns) cols[c].push(s)
  }
  return cols
}

export class MatrixController {
  private params: MatrixParams
  private columns: Stimulus[][]
  private ear: Ear
  private curve?: CalibCurvePoint[]
  private refDb?: number
  private bufferCache = new Map<number, AudioBuffer>()
  private stopHandle: (() => void) | null = null

  state: MatrixState
  private listeners = new Set<(s: MatrixState) => void>()

  constructor(
    params: MatrixParams,
    stimuli: Stimulus[],
    ear: Ear,
    refDb?: number,
    curve?: CalibCurvePoint[],
  ) {
    this.params = params
    this.columns = groupByColumn(stimuli, params.columns)
    this.ear = ear
    this.refDb = refDb
    this.curve = curve
    this.state = {
      currentSnr: params.start_snr_db,
      trials: [],
      levelStats: [],
      isPlaying: false,
      finished: false,
      srtSnrDb: null,
      ended_reason: null,
    }
  }

  columnsReady(): boolean {
    return this.columns.every(c => c.length > 0)
  }

  missingColumns(): number[] {
    return this.columns.map((c, i) => c.length === 0 ? i : -1).filter(i => i >= 0)
  }

  subscribe(fn: (s: MatrixState) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    for (const l of this.listeners) {
      l({ ...this.state, trials: [...this.state.trials], levelStats: [...this.state.levelStats] })
    }
  }

  columnTokens(col: number): string[] {
    return this.columns[col]?.map(s => s.token) ?? []
  }

  hydrate(prev: PrevResponse[]) {
    const byIdx = [...prev].sort((a, b) => a.item_index - b.item_index)
    this.state.trials = []
    this.state.levelStats = []
    this.state.srtSnrDb = null
    this.state.finished = false
    this.state.ended_reason = null
    let curSnr = this.params.start_snr_db
    for (const r of byIdx) {
      const m = /^S(-?\d+(?:\.\d+)?)\|(.*)$/.exec(r.expected_pattern)
      if (!m) continue
      const snr = parseFloat(m[1])
      const expected = m[2].split('|')
      const given = r.given_pattern ? r.given_pattern.split('|').map(x => x === '' ? null : x) : expected.map(() => null)
      const correct_count = expected.reduce((acc, w, i) => acc + (given[i] === w ? 1 : 0), 0)
      const pass = r.is_correct === null ? undefined : !!r.is_correct
      // stim_ids: inferimos desde tokens (puede no matchear exacto tras edición; OK best effort)
      const stim_ids = expected.map((tok, i) => this.columns[i]?.find(s => s.token === tok)?.id ?? -1)
      this.state.trials.push({
        index: this.state.trials.length,
        snr_db: snr,
        stim_ids,
        expected,
        given,
        correct_count,
        pass,
      })
      curSnr = snr
    }
    this.rebuildLevelStats()
    this.advanceIfLevelComplete(true)
    if (!this.state.finished) this.state.currentSnr = curSnr
    this.emit()
  }

  private rebuildLevelStats() {
    const stats = new Map<number, MatrixLevelStat>()
    for (const t of this.state.trials) {
      let s = stats.get(t.snr_db)
      if (!s) { s = { snr_db: t.snr_db, presented: 0, passed: 0, completed: false }; stats.set(t.snr_db, s) }
      if (t.pass !== undefined) {
        s.presented++
        if (t.pass) s.passed++
      }
    }
    for (const s of stats.values()) {
      if (s.presented >= this.params.sentences_per_level) {
        s.completed = true
        s.pass = s.passed / s.presented >= 0.5
      }
    }
    this.state.levelStats = Array.from(stats.values()).sort((a, b) => b.snr_db - a.snr_db)
  }

  private async getBuffer(s: Stimulus): Promise<AudioBuffer> {
    const cached = this.bufferCache.get(s.id)
    if (cached) return cached
    if (!s.file_path) throw new Error(`Estímulo "${s.token}" sin audio`)
    const bytes = await loadStimulusWav(s.file_path)
    const buf = await loadStimulusBuffer(s.file_path, bytes)
    this.bufferCache.set(s.id, buf)
    return buf
  }

  pendingTrial(): MatrixTrial | null {
    return this.state.trials.find(t => t.pass === undefined && t.snr_db === this.state.currentSnr) ?? null
  }

  private trialsScoredAtCurrent(): number {
    return this.state.trials.filter(t => t.snr_db === this.state.currentSnr && t.pass !== undefined).length
  }

  prepareNext(): MatrixTrial | null {
    if (this.state.finished) return null
    const pending = this.pendingTrial()
    if (pending) return pending
    const scored = this.trialsScoredAtCurrent()
    if (scored >= this.params.sentences_per_level) return null
    const picks = this.columns.map(col => pickRandom(col))
    const trial: MatrixTrial = {
      index: this.state.trials.length,
      snr_db: this.state.currentSnr,
      stim_ids: picks.map(s => s.id),
      expected: picks.map(s => s.token),
    }
    this.state.trials.push(trial)
    this.emit()
    return trial
  }

  async play(trial: MatrixTrial): Promise<void> {
    if (this.state.isPlaying) return
    const stims: Stimulus[] = []
    for (let i = 0; i < trial.stim_ids.length; i++) {
      const s = this.columns[i]?.find(x => x.id === trial.stim_ids[i])
      if (!s) return
      stims.push(s)
    }
    const buffers = await Promise.all(stims.map(s => this.getBuffer(s)))
    const noiseLevel = this.params.noise_level_db
    const voiceLevel = noiseLevel + trial.snr_db
    // Promedio rms por palabra para el mapeo SPL (aproximación razonable).
    const rms = stims.reduce((a, s) => a + (s.rms_dbfs ?? -20), 0) / stims.length
    const ref = this.refDb ?? resolveRefDb(1000, this.ear, this.curve)
    this.state.isPlaying = true
    trial.presented_at = Date.now()
    this.emit()
    await new Promise<void>(resolve => {
      playStimulusSequenceWithNoise(buffers, voiceLevel, {
        ear: this.ear,
        rms_dbfs: rms,
        refDb: ref,
        gap_ms: this.params.inter_word_gap_ms,
        noise: { level_db: noiseLevel, type: this.params.noise_type },
        onEnd: () => {
          this.state.isPlaying = false
          this.emit()
          resolve()
        },
      }).then(stop => { this.stopHandle = stop })
    })
    this.stopHandle = null
  }

  stop() {
    this.stopHandle?.()
    this.stopHandle = null
    this.state.isPlaying = false
    this.emit()
  }

  answer(selected: (string | null)[]): MatrixTrial | null {
    const t = this.pendingTrial() ?? this.state.trials[this.state.trials.length - 1]
    if (!t || t.pass !== undefined) return null
    t.given = selected.slice(0, t.expected.length)
    t.answered_at = Date.now()
    const correct = t.expected.reduce((acc, w, i) => acc + (t.given![i] === w ? 1 : 0), 0)
    t.correct_count = correct
    t.pass = correct / t.expected.length >= this.params.threshold_pass_ratio
    this.rebuildLevelStats()
    this.advanceIfLevelComplete(false)
    this.emit()
    return t
  }

  private advanceIfLevelComplete(fromHydrate: boolean) {
    const lvlStat = this.state.levelStats.find(s => s.snr_db === this.state.currentSnr)
    if (!lvlStat || !lvlStat.completed) return
    const passes = this.state.levelStats.filter(s => s.completed && s.pass).map(s => s.snr_db)
    const fails = this.state.levelStats.filter(s => s.completed && !s.pass).map(s => s.snr_db)
    if (passes.length > 0 && fails.some(f => passes.some(p => f < p))) {
      this.state.srtSnrDb = Math.min(...passes)
      this.state.finished = true
      this.state.ended_reason = 'bracketed'
      return
    }
    let next: number
    if (lvlStat.pass) next = this.state.currentSnr - this.params.step_down_db
    else {
      if (passes.length > 0) {
        this.state.srtSnrDb = Math.min(...passes)
        this.state.finished = true
        this.state.ended_reason = 'bracketed'
        return
      }
      next = this.state.currentSnr + this.params.step_up_db
    }
    if (next < this.params.min_snr_db) {
      this.state.finished = true
      this.state.ended_reason = 'floor'
      if (passes.length > 0) this.state.srtSnrDb = Math.min(...passes)
      return
    }
    if (next > this.params.max_snr_db) {
      this.state.finished = true
      this.state.ended_reason = 'ceiling'
      return
    }
    if (this.params.max_total_trials && this.state.trials.length >= this.params.max_total_trials) {
      this.state.finished = true
      this.state.ended_reason = 'max_trials'
      if (passes.length > 0) this.state.srtSnrDb = Math.min(...passes)
      return
    }
    this.state.currentSnr = next
    if (!fromHydrate) this.emit()
  }

  finishManual() {
    const passes = this.state.levelStats.filter(s => s.completed && s.pass).map(s => s.snr_db)
    if (passes.length > 0) this.state.srtSnrDb = Math.min(...passes)
    this.state.finished = true
    this.state.ended_reason = 'manual'
    this.emit()
  }
}
