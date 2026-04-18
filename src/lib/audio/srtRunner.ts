import type { SRTParams, Stimulus, Ear } from '@/types'
import { loadStimulusBuffer, playStimulusBuffer, type CalibCurvePoint, resolveRefDb } from './engine'
import { loadStimulusWav } from '@/lib/fs/stimuli'

export interface SRTTrial {
  index: number
  level_db: number
  stimulus_id: number
  token: string
  correct?: boolean
  presented_at?: number
  answered_at?: number
}

export interface SRTLevelStat {
  level_db: number
  presented: number
  correct: number
  completed: boolean
  pass?: boolean
}

export interface SRTState {
  currentLevel: number
  trials: SRTTrial[]
  levelStats: SRTLevelStat[]
  isPlaying: boolean
  finished: boolean
  srtDb: number | null
  ended_reason: 'bracketed' | 'floor' | 'ceiling' | 'max_trials' | 'manual' | null
}

type BufferCache = Map<number, AudioBuffer>

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

export class SRTController {
  private params: SRTParams
  private stimuli: Stimulus[]
  private ear: Ear
  private curve?: CalibCurvePoint[]
  private refDb?: number
  private bufferCache: BufferCache = new Map()
  private stopHandle: (() => void) | null = null

  /** Cola de stimulus_id por nivel (para rotar sin repetir). Se rellena on-demand. */
  private queue: Map<number, number[]> = new Map()
  private usedIdsGlobal = new Set<number>()

  state: SRTState
  private listeners = new Set<(s: SRTState) => void>()

  constructor(
    params: SRTParams,
    stimuli: Stimulus[],
    ear: Ear,
    refDb?: number,
    curve?: CalibCurvePoint[]
  ) {
    this.params = params
    this.stimuli = stimuli.filter(s => s.file_path)
    this.ear = ear
    this.refDb = refDb
    this.curve = curve
    this.state = {
      currentLevel: params.start_level_db,
      trials: [],
      levelStats: [],
      isPlaying: false,
      finished: false,
      srtDb: null,
      ended_reason: null,
    }
  }

  subscribe(fn: (s: SRTState) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    for (const l of this.listeners) l({ ...this.state, trials: [...this.state.trials], levelStats: [...this.state.levelStats] })
  }

  /** Rehidratar desde responses persistidas (token en expected_pattern, level en given_pattern "L42|token"). */
  hydrate(prev: PrevResponse[]) {
    const byIdx = [...prev].sort((a, b) => a.item_index - b.item_index)
    this.state.trials = []
    this.state.levelStats = []
    this.state.srtDb = null
    this.state.finished = false
    this.state.ended_reason = null
    let curLevel = this.params.start_level_db
    for (const r of byIdx) {
      const match = /^L(-?\d+(?:\.\d+)?)\|(.*)$/.exec(r.expected_pattern)
      if (!match) continue
      const level = parseFloat(match[1])
      const token = match[2]
      const stim = this.stimuli.find(s => s.token === token)
      this.state.trials.push({
        index: this.state.trials.length,
        level_db: level,
        stimulus_id: stim?.id ?? -1,
        token,
        correct: r.is_correct === null ? undefined : !!r.is_correct,
      })
      if (stim) this.usedIdsGlobal.add(stim.id)
      curLevel = level
    }
    this.rebuildLevelStats()
    this.advanceIfLevelComplete(true)
    if (!this.state.finished) this.state.currentLevel = curLevel
    this.emit()
  }

  private rebuildLevelStats() {
    const stats = new Map<number, SRTLevelStat>()
    for (const t of this.state.trials) {
      let s = stats.get(t.level_db)
      if (!s) {
        s = { level_db: t.level_db, presented: 0, correct: 0, completed: false }
        stats.set(t.level_db, s)
      }
      if (t.correct !== undefined) {
        s.presented++
        if (t.correct) s.correct++
      }
    }
    for (const s of stats.values()) {
      if (s.presented >= this.params.words_per_level) {
        s.completed = true
        s.pass = s.correct / s.presented >= this.params.threshold_pass_ratio
      }
    }
    this.state.levelStats = Array.from(stats.values()).sort((a, b) => b.level_db - a.level_db)
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
    // Preferir no repetir globalmente; si se acabaron, reutilizar.
    const pool = this.stimuli.filter(s => !this.usedIdsGlobal.has(s.id))
    const source = pool.length > 0 ? pool : this.stimuli
    if (source.length === 0) return null
    const shuffled = shuffle(source)
    return shuffled[0] ?? null
  }

  currentLevelStat(): SRTLevelStat {
    const lvl = this.state.currentLevel
    const stats = this.state.levelStats.find(s => s.level_db === lvl)
    return stats ?? { level_db: lvl, presented: 0, correct: 0, completed: false }
  }

  /** ¿Cuántos estímulos presentados en el nivel actual ya tienen marca? */
  private trialsScoredAtCurrent(): number {
    return this.state.trials.filter(t => t.level_db === this.state.currentLevel && t.correct !== undefined).length
  }

  /** ¿Hay un trial pendiente de marcar en el nivel actual? */
  pendingTrial(): SRTTrial | null {
    const t = this.state.trials.find(t => t.correct === undefined && t.level_db === this.state.currentLevel)
    return t ?? null
  }

  /**
   * Prepara el siguiente trial (asigna estímulo + lo añade al array). No reproduce aún.
   */
  prepareNext(): SRTTrial | null {
    if (this.state.finished) return null
    const pending = this.pendingTrial()
    if (pending) return pending
    const scored = this.trialsScoredAtCurrent()
    if (scored >= this.params.words_per_level) return null // nivel completo; call advance
    const stim = this.pickNextStimulus()
    if (!stim) return null
    this.usedIdsGlobal.add(stim.id)
    const trial: SRTTrial = {
      index: this.state.trials.length,
      level_db: this.state.currentLevel,
      stimulus_id: stim.id,
      token: stim.token,
    }
    this.state.trials.push(trial)
    this.emit()
    return trial
  }

  async play(trial: SRTTrial): Promise<void> {
    if (this.state.isPlaying) return
    const stim = this.stimuli.find(s => s.id === trial.stimulus_id)
    if (!stim) return
    const buf = await this.getBuffer(stim)
    this.state.isPlaying = true
    trial.presented_at = Date.now()
    this.emit()
    await new Promise<void>((resolve) => {
      const ref = this.refDb ?? resolveRefDb(1000, this.ear, this.curve)
      playStimulusBuffer(buf, trial.level_db, {
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

  /**
   * Marca el trial actual pendiente como correcto/incorrecto. Si el nivel queda
   * completo (words_per_level presentaciones marcadas), avanza (decide próximo nivel).
   */
  answer(correct: boolean): SRTTrial | null {
    const t = this.pendingTrial() ?? this.state.trials[this.state.trials.length - 1]
    if (!t || t.correct !== undefined) return null
    t.correct = correct
    t.answered_at = Date.now()
    this.rebuildLevelStats()
    this.advanceIfLevelComplete(false)
    this.emit()
    return t
  }

  private advanceIfLevelComplete(fromHydrate: boolean) {
    const lvlStat = this.state.levelStats.find(s => s.level_db === this.state.currentLevel)
    if (!lvlStat || !lvlStat.completed) return
    // Chequeo bracketing: hay al menos un pass y un fail estrictamente debajo de algún pass
    const passes = this.state.levelStats.filter(s => s.completed && s.pass).map(s => s.level_db)
    const fails = this.state.levelStats.filter(s => s.completed && !s.pass).map(s => s.level_db)
    if (passes.length > 0 && fails.some(f => passes.some(p => f < p))) {
      this.state.srtDb = Math.min(...passes)
      this.state.finished = true
      this.state.ended_reason = 'bracketed'
      return
    }
    // Decidir próximo nivel
    let next: number
    if (lvlStat.pass) next = this.state.currentLevel - this.params.step_down_db
    else {
      if (passes.length > 0) {
        this.state.srtDb = Math.min(...passes)
        this.state.finished = true
        this.state.ended_reason = 'bracketed'
        return
      }
      next = this.state.currentLevel + this.params.step_up_db
    }
    if (next < this.params.min_level_db) {
      this.state.finished = true
      this.state.ended_reason = 'floor'
      if (passes.length > 0) this.state.srtDb = Math.min(...passes)
      return
    }
    if (next > this.params.max_level_db) {
      this.state.finished = true
      this.state.ended_reason = 'ceiling'
      return
    }
    if (this.params.max_total_trials && this.state.trials.length >= this.params.max_total_trials) {
      this.state.finished = true
      this.state.ended_reason = 'max_trials'
      if (passes.length > 0) this.state.srtDb = Math.min(...passes)
      return
    }
    this.state.currentLevel = next
    if (!fromHydrate) this.emit()
  }

  /** Cierra manualmente y calcula SRT con datos actuales (último pass si existe). */
  finishManual() {
    const passes = this.state.levelStats.filter(s => s.completed && s.pass).map(s => s.level_db)
    if (passes.length > 0) this.state.srtDb = Math.min(...passes)
    this.state.finished = true
    this.state.ended_reason = 'manual'
    this.emit()
  }

  reset() {
    this.state.trials = []
    this.state.levelStats = []
    this.state.currentLevel = this.params.start_level_db
    this.state.finished = false
    this.state.srtDb = null
    this.state.ended_reason = null
    this.usedIdsGlobal.clear()
    this.emit()
  }
}
