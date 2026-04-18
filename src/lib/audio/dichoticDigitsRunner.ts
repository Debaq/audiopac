import type { DichoticDigitsParams, Stimulus } from '@/types'
import { loadStimulusBuffer, playStimulusPair, type CalibCurvePoint, resolveRefDb } from './engine'
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
    const pairs: DichoticPair[] = []
    const n = this.params.num_pairs
    const dpe = this.params.digits_per_ear
    for (let i = 0; i < n; i++) {
      const shuffled = shuffle(this.stimuli)
      // Necesitamos 2*dpe ítems distintos en cada par (L y R no se repiten entre sí)
      const need = dpe * 2
      const pick = shuffled.slice(0, Math.min(need, shuffled.length))
      // Si la lista no alcanza para todos únicos, rellenar con rotación
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
      // Precargar todos los buffers del par
      const leftBufs = await Promise.all(pair.left_ids.map(id => this.getBuffer(id)))
      const rightBufs = await Promise.all(pair.right_ids.map(id => this.getBuffer(id)))
      const leftRms = pair.left_ids.map(id => this.stimuli.find(s => s.id === id)?.rms_dbfs ?? -20)
      const rightRms = pair.right_ids.map(id => this.stimuli.find(s => s.id === id)?.rms_dbfs ?? -20)
      const refBin = this.refDb ?? resolveRefDb(1000, 'binaural', this.curve)
      const isi = Math.max(0, this.params.isi_ms)

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
        if (i < leftBufs.length - 1 && isi > 0) {
          await new Promise(r => setTimeout(r, isi))
        }
      }
    } finally {
      this.state.isPlaying = false
      this.emit()
    }
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

  /** Totales agregados por oído (solo sobre pares con respuesta). */
  getScores(): { leftCorrect: number; rightCorrect: number; answered: number; total: number; asymmetryPct: number | null } {
    const answered = this.state.pairs.filter(p => p.left_correct !== undefined && p.right_correct !== undefined)
    const lc = answered.filter(p => p.left_correct).length
    const rc = answered.filter(p => p.right_correct).length
    const total = this.state.pairs.length
    let asym: number | null = null
    if (answered.length > 0) {
      const lPct = (lc / answered.length) * 100
      const rPct = (rc / answered.length) * 100
      asym = rPct - lPct
    }
    return { leftCorrect: lc, rightCorrect: rc, answered: answered.length, total, asymmetryPct: asym }
  }
}
