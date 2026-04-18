import type { HINTParams, Stimulus, Ear } from '@/types'
import { loadStimulusBuffer, playStimulusWithNoise, type CalibCurvePoint, resolveRefDb } from './engine'
import { loadStimulusWav } from '@/lib/fs/stimuli'
import { parseKeywords } from '@/lib/db/stimuli'

export interface HINTTrial {
  index: number
  snr_db: number
  stimulus_id: number
  token: string
  keywords: string[]
  /** Palabras clave marcadas correctas (subset de keywords). */
  correctKeys?: string[]
  /** Pasa el trial (correctKeys / keywords ≥ pass_ratio). */
  pass?: boolean
  presented_at?: number
  answered_at?: number
}

export interface HINTLevelStat {
  snr_db: number
  presented: number
  passed: number
  completed: boolean
  pass?: boolean
}

export interface HINTState {
  currentSnr: number
  trials: HINTTrial[]
  levelStats: HINTLevelStat[]
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

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export class HINTController {
  private params: HINTParams
  private stimuli: Stimulus[]
  private ear: Ear
  private curve?: CalibCurvePoint[]
  private refDb?: number
  private bufferCache = new Map<number, AudioBuffer>()
  private stopHandle: (() => void) | null = null
  private usedIdsGlobal = new Set<number>()

  state: HINTState
  private listeners = new Set<(s: HINTState) => void>()

  constructor(
    params: HINTParams,
    stimuli: Stimulus[],
    ear: Ear,
    refDb?: number,
    curve?: CalibCurvePoint[]
  ) {
    this.params = params
    this.stimuli = stimuli.filter(s => s.file_path && parseKeywords(s).length > 0)
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

  subscribe(fn: (s: HINTState) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    for (const l of this.listeners) l({ ...this.state, trials: [...this.state.trials], levelStats: [...this.state.levelStats] })
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
      // expected_pattern formato: "S{snr}|{token}" — keywords persisted on stimulus
      const match = /^S(-?\d+(?:\.\d+)?)\|(.*)$/.exec(r.expected_pattern)
      if (!match) continue
      const snr = parseFloat(match[1])
      const token = match[2]
      const stim = this.stimuli.find(s => s.token === token)
      if (!stim) continue
      const keywords = parseKeywords(stim)
      // given_pattern: CSV de keys correctas (o vacío)
      const correctKeys = r.given_pattern ? r.given_pattern.split('|').filter(Boolean) : []
      const pass = r.is_correct === null ? undefined : !!r.is_correct
      this.state.trials.push({
        index: this.state.trials.length,
        snr_db: snr,
        stimulus_id: stim.id,
        token,
        keywords,
        correctKeys: r.is_correct === null ? undefined : correctKeys,
        pass,
      })
      this.usedIdsGlobal.add(stim.id)
      curSnr = snr
    }
    this.rebuildLevelStats()
    this.advanceIfLevelComplete(true)
    if (!this.state.finished) this.state.currentSnr = curSnr
    this.emit()
  }

  private rebuildLevelStats() {
    const stats = new Map<number, HINTLevelStat>()
    for (const t of this.state.trials) {
      let s = stats.get(t.snr_db)
      if (!s) {
        s = { snr_db: t.snr_db, presented: 0, passed: 0, completed: false }
        stats.set(t.snr_db, s)
      }
      if (t.pass !== undefined) {
        s.presented++
        if (t.pass) s.passed++
      }
    }
    for (const s of stats.values()) {
      if (s.presented >= this.params.sentences_per_level) {
        s.completed = true
        s.pass = s.passed / s.presented >= this.params.threshold_pass_ratio
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

  private pickNextStimulus(): Stimulus | null {
    const pool = this.stimuli.filter(s => !this.usedIdsGlobal.has(s.id))
    const source = pool.length > 0 ? pool : this.stimuli
    if (source.length === 0) return null
    return shuffle(source)[0] ?? null
  }

  currentLevelStat(): HINTLevelStat {
    const snr = this.state.currentSnr
    return this.state.levelStats.find(s => s.snr_db === snr) ?? { snr_db: snr, presented: 0, passed: 0, completed: false }
  }

  private trialsScoredAtCurrent(): number {
    return this.state.trials.filter(t => t.snr_db === this.state.currentSnr && t.pass !== undefined).length
  }

  pendingTrial(): HINTTrial | null {
    return this.state.trials.find(t => t.pass === undefined && t.snr_db === this.state.currentSnr) ?? null
  }

  prepareNext(): HINTTrial | null {
    if (this.state.finished) return null
    const pending = this.pendingTrial()
    if (pending) return pending
    const scored = this.trialsScoredAtCurrent()
    if (scored >= this.params.sentences_per_level) return null
    const stim = this.pickNextStimulus()
    if (!stim) return null
    this.usedIdsGlobal.add(stim.id)
    const trial: HINTTrial = {
      index: this.state.trials.length,
      snr_db: this.state.currentSnr,
      stimulus_id: stim.id,
      token: stim.token,
      keywords: parseKeywords(stim),
    }
    this.state.trials.push(trial)
    this.emit()
    return trial
  }

  async play(trial: HINTTrial): Promise<void> {
    if (this.state.isPlaying) return
    const stim = this.stimuli.find(s => s.id === trial.stimulus_id)
    if (!stim) return
    const buf = await this.getBuffer(stim)
    const noiseLevel = this.params.noise_level_db
    const voiceLevel = noiseLevel + trial.snr_db
    this.state.isPlaying = true
    trial.presented_at = Date.now()
    this.emit()
    await new Promise<void>((resolve) => {
      const ref = this.refDb ?? resolveRefDb(1000, this.ear, this.curve)
      playStimulusWithNoise(buf, voiceLevel, noiseLevel, this.params.noise_type, {
        ear: this.ear,
        rms_dbfs: stim.rms_dbfs,
        refDb: ref,
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

  /** Marca el trial con las palabras clave correctas seleccionadas. */
  answer(correctKeys: string[]): HINTTrial | null {
    const t = this.pendingTrial() ?? this.state.trials[this.state.trials.length - 1]
    if (!t || t.pass !== undefined) return null
    t.correctKeys = correctKeys
    t.answered_at = Date.now()
    const ratio = t.keywords.length === 0 ? 0 : correctKeys.length / t.keywords.length
    t.pass = ratio >= this.params.threshold_pass_ratio
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
    // bracketing: hay pass y fail estrictamente por debajo (SNR menor = más difícil)
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

  reset() {
    this.state.trials = []
    this.state.levelStats = []
    this.state.currentSnr = this.params.start_snr_db
    this.state.finished = false
    this.state.srtSnrDb = null
    this.state.ended_reason = null
    this.usedIdsGlobal.clear()
    this.emit()
  }
}
