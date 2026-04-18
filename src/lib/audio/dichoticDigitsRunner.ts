import type { DichoticDigitsParams, Stimulus } from '@/types'
import { loadStimulusBuffer, playStimulusPair, playStimulusBuffer, type CalibCurvePoint, resolveRefDb } from './engine'
import { loadStimulusWav } from '@/lib/fs/stimuli'

/**
 * Un par dicótico. Si `digits_per_ear > 1`, `left_tokens`/`right_tokens` tienen
 * esa cantidad (se presenta uno tras otro, simultáneos L↔R índice a índice).
 * El scoring actual usa marca correcto/incorrecto por oído (global al par).
 */
export interface DichoticPair {
  index: number
  left_tokens: string[]
  right_tokens: string[]
  left_ids: number[]
  right_ids: number[]
  left_correct?: boolean
  right_correct?: boolean
  /** Marcas por dígito (scoring_granularity = 'per_digit' | 'per_position'). */
  left_digit_correct?: boolean[]
  right_digit_correct?: boolean[]
  /** Catch trial: solo un oído activo para validar atención. */
  is_catch?: boolean
  catch_ear?: 'left' | 'right'
  presented_at?: number
  answered_at?: number
}

export interface DichoticState {
  pairs: DichoticPair[]
  currentIndex: number
  isPlaying: boolean
  finished: boolean
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

export class DichoticDigitsController {
  private params: DichoticDigitsParams
  private stimuli: Stimulus[]
  private curve?: CalibCurvePoint[]
  private refDb?: number
  private bufferCache: Map<number, AudioBuffer> = new Map()
  private stopHandle: (() => void) | null = null

  state: DichoticState
  private listeners = new Set<(s: DichoticState) => void>()

  constructor(
    params: DichoticDigitsParams,
    stimuli: Stimulus[],
    refDb?: number,
    curve?: CalibCurvePoint[]
  ) {
    this.params = params
    this.stimuli = stimuli.filter(s => s.file_path)
    this.refDb = refDb
    this.curve = curve
    this.state = {
      pairs: this.generatePairs(),
      currentIndex: 0,
      isPlaying: false,
      finished: false,
    }
  }

  subscribe(fn: (s: DichoticState) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    for (const l of this.listeners) l({ ...this.state, pairs: this.state.pairs.map(p => ({ ...p })) })
  }

  private generatePairs(): DichoticPair[] {
    const randomize = this.params.randomize !== false
    let pairs: DichoticPair[]
    if (!randomize && this.params.fixed_pairs && this.params.fixed_pairs.length > 0) {
      pairs = this.buildFixedPairs()
    } else {
      pairs = []
      const n = this.params.num_pairs
      const dpe = this.params.digits_per_ear
      for (let i = 0; i < n; i++) {
        const shuffled = shuffle(this.stimuli)
        const need = dpe * 2
        const pick = shuffled.slice(0, Math.min(need, shuffled.length))
        while (pick.length < need) pick.push(shuffled[pick.length % shuffled.length])
        const left = pick.slice(0, dpe)
        const right = pick.slice(dpe, dpe * 2)
        pairs.push({
          index: i,
          left_tokens: left.map(s => s.token),
          right_tokens: right.map(s => s.token),
          left_ids: left.map(s => s.id),
          right_ids: right.map(s => s.id),
        })
      }
    }

    // Insertar catch trials
    const ct = this.params.catch_trials
    if (ct && ct.enabled && ct.count > 0) {
      const catches = this.buildCatchTrials(ct.count)
      pairs = this.mergeCatches(pairs, catches, ct.placement)
    }

    // Reindexar
    pairs = pairs.map((p, i) => ({ ...p, index: i }))
    return pairs
  }

  private buildCatchTrials(count: number): DichoticPair[] {
    const dpe = this.params.digits_per_ear
    const arr: DichoticPair[] = []
    for (let i = 0; i < count; i++) {
      const ear: 'left' | 'right' = Math.random() < 0.5 ? 'left' : 'right'
      const shuffled = shuffle(this.stimuli)
      const pick = shuffled.slice(0, dpe)
      const tokens = pick.map(s => s.token)
      const ids = pick.map(s => s.id)
      arr.push({
        index: -1,
        left_tokens: ear === 'left' ? tokens : [],
        right_tokens: ear === 'right' ? tokens : [],
        left_ids: ear === 'left' ? ids : [],
        right_ids: ear === 'right' ? ids : [],
        is_catch: true,
        catch_ear: ear,
      })
    }
    return arr
  }

  private mergeCatches(pairs: DichoticPair[], catches: DichoticPair[], placement: 'random' | 'every_n' | 'start_end'): DichoticPair[] {
    if (catches.length === 0) return pairs
    if (placement === 'start_end') {
      const mid = Math.floor(catches.length / 2)
      return [...catches.slice(0, mid), ...pairs, ...catches.slice(mid)]
    }
    if (placement === 'every_n') {
      const n = Math.max(1, Math.floor(pairs.length / (catches.length + 1)))
      const out: DichoticPair[] = []
      let ci = 0
      pairs.forEach((p, i) => {
        out.push(p)
        if (ci < catches.length && (i + 1) % n === 0) out.push(catches[ci++])
      })
      while (ci < catches.length) out.push(catches[ci++])
      return out
    }
    // random
    const out = [...pairs]
    for (const c of catches) {
      const pos = Math.floor(Math.random() * (out.length + 1))
      out.splice(pos, 0, c)
    }
    return out
  }

  private buildFixedPairs(): DichoticPair[] {
    const byToken = new Map<string, Stimulus>()
    for (const s of this.stimuli) byToken.set(s.token.toLowerCase(), s)
    const pairs: DichoticPair[] = []
    this.params.fixed_pairs!.forEach((pd, i) => {
      const leftStim = pd.left.map(t => byToken.get(t.toLowerCase())).filter(Boolean) as Stimulus[]
      const rightStim = pd.right.map(t => byToken.get(t.toLowerCase())).filter(Boolean) as Stimulus[]
      if (leftStim.length === 0 || rightStim.length === 0) return
      pairs.push({
        index: i,
        left_tokens: leftStim.map(s => s.token),
        right_tokens: rightStim.map(s => s.token),
        left_ids: leftStim.map(s => s.id),
        right_ids: rightStim.map(s => s.id),
      })
    })
    return pairs
  }

  /** Rehidratar desde responses persistidas. expected_pattern: "L:tok1,tok2|R:tok1,tok2", given_pattern: "L:0/1|R:0/1" o null. */
  hydrate(prev: PrevResponse[]) {
    const byIdx = [...prev].sort((a, b) => a.item_index - b.item_index)
    for (const r of byIdx) {
      const pair = this.state.pairs[r.item_index]
      if (!pair) continue
      const m = /^L:([^|]*)\|R:(.*)$/.exec(r.expected_pattern)
      if (m) {
        const leftTokens = m[1].split(',').filter(Boolean)
        const rightTokens = m[2].split(',').filter(Boolean)
        if (leftTokens.length) pair.left_tokens = leftTokens
        if (rightTokens.length) pair.right_tokens = rightTokens
      }
      if (r.given_pattern) {
        const g = /^L:([01])\|R:([01])$/.exec(r.given_pattern)
        if (g) {
          pair.left_correct = g[1] === '1'
          pair.right_correct = g[2] === '1'
        }
      }
    }
    // Avanzar currentIndex al primer par sin respuesta completa
    const firstPending = this.state.pairs.findIndex(p => p.left_correct === undefined || p.right_correct === undefined)
    if (firstPending === -1) {
      this.state.currentIndex = this.state.pairs.length - 1
      this.state.finished = true
    } else {
      this.state.currentIndex = firstPending
    }
    this.emit()
  }

  private async getBuffer(id: number): Promise<AudioBuffer> {
    const cached = this.bufferCache.get(id)
    if (cached) return cached
    const s = this.stimuli.find(x => x.id === id)
    if (!s || !s.file_path) throw new Error(`Estímulo id=${id} sin audio`)
    const bytes = await loadStimulusWav(s.file_path)
    const buf = await loadStimulusBuffer(s.file_path, bytes)
    this.bufferCache.set(id, buf)
    return buf
  }

  currentPair(): DichoticPair | null {
    return this.state.pairs[this.state.currentIndex] ?? null
  }

  async play(): Promise<void> {
    if (this.state.isPlaying || this.state.finished) return
    const pair = this.currentPair()
    if (!pair) return
    this.state.isPlaying = true
    pair.presented_at = Date.now()
    this.emit()

    try {
      const refBin = this.refDb ?? resolveRefDb(1000, 'binaural', this.curve)
      const isi = Math.max(0, this.params.isi_ms)

      if (pair.is_catch) {
        // Mono: reproducir sólo el oído activo
        const ids = pair.catch_ear === 'left' ? pair.left_ids : pair.right_ids
        const bufs = await Promise.all(ids.map(id => this.getBuffer(id)))
        const rmsVals = ids.map(id => this.stimuli.find(s => s.id === id)?.rms_dbfs ?? -20)
        for (let i = 0; i < bufs.length; i++) {
          await new Promise<void>((resolve) => {
            playStimulusBuffer(bufs[i], this.params.level_db, {
              ear: pair.catch_ear,
              rms_dbfs: rmsVals[i],
              refDb: refBin,
              onEnd: () => resolve(),
            }).then(stop => { this.stopHandle = stop })
          })
          this.stopHandle = null
          if (i < bufs.length - 1 && isi > 0) await new Promise(r => setTimeout(r, isi))
        }
      } else {
        const leftBufs = await Promise.all(pair.left_ids.map(id => this.getBuffer(id)))
        const rightBufs = await Promise.all(pair.right_ids.map(id => this.getBuffer(id)))
        const leftRms = pair.left_ids.map(id => this.stimuli.find(s => s.id === id)?.rms_dbfs ?? -20)
        const rightRms = pair.right_ids.map(id => this.stimuli.find(s => s.id === id)?.rms_dbfs ?? -20)

        for (let i = 0; i < leftBufs.length; i++) {
          await new Promise<void>((resolve) => {
            playStimulusPair(leftBufs[i], rightBufs[i], this.params.level_db, {
              rms_dbfs_l: leftRms[i],
              rms_dbfs_r: rightRms[i],
              refDb: refBin,
              onEnd: () => resolve(),
            }).then(stop => { this.stopHandle = stop })
          })
          this.stopHandle = null
          if (i < leftBufs.length - 1 && isi > 0) await new Promise(r => setTimeout(r, isi))
        }
      }
    } finally {
      this.state.isPlaying = false
      this.emit()
    }
  }

  /** Returns the prescribed first-ear for directed mode at a given pair index. */
  firstEarFor(pairIndex: number): 'left' | 'right' {
    const order = this.params.directed_block_order ?? 'lrlr'
    const total = this.state.pairs.length
    if (order === 'interleaved' || order === 'lrlr') {
      return pairIndex % 2 === 0 ? 'left' : 'right'
    }
    // llrr: first half L, second half R
    return pairIndex < Math.ceil(total / 2) ? 'left' : 'right'
  }

  /** Marca un dígito específico (per_digit / per_position granularity). */
  answerDigit(side: 'left' | 'right', position: number, correct: boolean): DichoticPair | null {
    const pair = this.currentPair()
    if (!pair) return null
    const arrKey = side === 'left' ? 'left_digit_correct' : 'right_digit_correct'
    const tokens = side === 'left' ? pair.left_tokens : pair.right_tokens
    const existing = pair[arrKey] ?? tokens.map(() => false)
    existing[position] = correct
    pair[arrKey] = existing
    this.emit()
    return pair
  }

  stop() {
    this.stopHandle?.()
    this.stopHandle = null
    this.state.isPlaying = false
    this.emit()
  }

  /** Marca el par actual con resultados por oído. No avanza automáticamente. */
  answer(leftCorrect: boolean, rightCorrect: boolean): DichoticPair | null {
    const pair = this.currentPair()
    if (!pair) return null
    pair.left_correct = leftCorrect
    pair.right_correct = rightCorrect
    pair.answered_at = Date.now()
    this.emit()
    return pair
  }

  /** Avanza al siguiente par (o marca finished). */
  next(): void {
    if (this.state.currentIndex < this.state.pairs.length - 1) {
      this.state.currentIndex++
    } else {
      this.state.finished = true
    }
    this.emit()
  }

  finishManual() {
    this.state.finished = true
    this.emit()
  }

  reset() {
    this.state.pairs = this.generatePairs()
    this.state.currentIndex = 0
    this.state.finished = false
    this.emit()
  }

  /** Totales agregados por oído. Excluye catch trials del denominador "real". */
  getScores(): {
    leftCorrect: number; rightCorrect: number; answered: number; total: number; asymmetryPct: number | null
    leftDigits?: { correct: number; total: number }
    rightDigits?: { correct: number; total: number }
    catchTotal?: number; catchCorrect?: number
  } {
    const real = this.state.pairs.filter(p => !p.is_catch)
    const answered = real.filter(p => p.left_correct !== undefined && p.right_correct !== undefined)
    const lc = answered.filter(p => p.left_correct).length
    const rc = answered.filter(p => p.right_correct).length
    const total = real.length
    let asym: number | null = null
    if (answered.length > 0) {
      const lPct = (lc / answered.length) * 100
      const rPct = (rc / answered.length) * 100
      asym = rPct - lPct
    }

    const gran = this.params.scoring_granularity ?? 'per_pair'
    let leftDigits: { correct: number; total: number } | undefined
    let rightDigits: { correct: number; total: number } | undefined
    if (gran === 'per_digit' || gran === 'per_position') {
      leftDigits = { correct: 0, total: 0 }
      rightDigits = { correct: 0, total: 0 }
      for (const p of real) {
        leftDigits.total += p.left_tokens.length
        rightDigits.total += p.right_tokens.length
        leftDigits.correct += (p.left_digit_correct ?? []).filter(Boolean).length
        rightDigits.correct += (p.right_digit_correct ?? []).filter(Boolean).length
      }
    }

    const catchPairs = this.state.pairs.filter(p => p.is_catch && p.left_correct !== undefined && p.right_correct !== undefined)
    const catchCorrect = catchPairs.filter(p => (p.catch_ear === 'left' ? p.left_correct : p.right_correct)).length

    return {
      leftCorrect: lc, rightCorrect: rc, answered: answered.length, total, asymmetryPct: asym,
      leftDigits, rightDigits,
      catchTotal: catchPairs.length, catchCorrect,
    }
  }
}
