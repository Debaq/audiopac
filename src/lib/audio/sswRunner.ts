import type { SSWParams, SSWScore, SSWStimulusMeta, Stimulus } from '@/types'
import { loadStimulusBuffer, playSSWItem, type CalibCurvePoint, resolveRefDb } from './engine'
import { loadStimulusWav } from '@/lib/fs/stimuli'
import { parseStimMetadata } from '@/lib/db/stimuli'
import { PREVIEW_PLAY_MS } from '@/lib/preview/mockSession'

export type SSWCondition = 'RNC' | 'RC' | 'LC' | 'LNC'

export interface SSWTrial {
  index: number
  item_id: number
  ear_first: 'R' | 'L'
  expected: Record<SSWCondition, string>
  pair_label?: string
  given?: Record<SSWCondition, string | null>
  correct?: Record<SSWCondition, boolean>
  reversal?: boolean
  presented_at?: number
  answered_at?: number
}

export interface SSWItemBundle {
  item_id: number
  pair_label?: string
  RNC: Stimulus | null
  RC: Stimulus | null
  LC: Stimulus | null
  LNC: Stimulus | null
}

export interface SSWState {
  trials: SSWTrial[]
  currentIndex: number
  isPlaying: boolean
  finished: boolean
  score: SSWScore | null
}

interface PrevResponse {
  item_index: number
  expected_pattern: string
  given_pattern: string | null
  is_correct: number | null
}

export function groupSSWItems(stimuli: Stimulus[]): SSWItemBundle[] {
  const byId = new Map<number, SSWItemBundle>()
  for (const s of stimuli) {
    const meta = parseStimMetadata(s) as Partial<SSWStimulusMeta>
    if (!meta.ssw_item || !meta.side || !meta.position) continue
    let bundle = byId.get(meta.ssw_item)
    if (!bundle) {
      bundle = { item_id: meta.ssw_item, RNC: null, RC: null, LC: null, LNC: null, pair_label: meta.pair_label }
      byId.set(meta.ssw_item, bundle)
    }
    if (!bundle.pair_label && meta.pair_label) bundle.pair_label = meta.pair_label
    const key: SSWCondition =
      meta.side === 'R'
        ? (meta.position === 1 ? 'RNC' : 'RC')
        : (meta.position === 1 ? 'LC' : 'LNC')
    bundle[key] = s
  }
  return Array.from(byId.values()).sort((a, b) => a.item_id - b.item_id)
}

export function normalizeToken(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '')
}

function earFirstFor(order: SSWParams['ear_first_order'], i: number): 'R' | 'L' {
  switch (order) {
    case 'RLRL': return i % 2 === 0 ? 'R' : 'L'
    case 'LRLR': return i % 2 === 0 ? 'L' : 'R'
    case 'RRLL': return i < 2 ? 'R' : (Math.floor(i / 2) % 2 === 0 ? 'R' : 'L')
    case 'random': return Math.random() < 0.5 ? 'R' : 'L'
    case 'fixed_R': return 'R'
    case 'fixed_L': return 'L'
    default: return i % 2 === 0 ? 'R' : 'L'
  }
}

export class SSWController {
  private params: SSWParams
  private items: SSWItemBundle[]
  private curve?: CalibCurvePoint[]
  private refDb?: number
  private bufferCache = new Map<number, AudioBuffer>()
  private stopHandle: (() => void) | null = null
  private preview: boolean

  state: SSWState
  private listeners = new Set<(s: SSWState) => void>()

  constructor(params: SSWParams, stimuli: Stimulus[], refDb?: number, curve?: CalibCurvePoint[], preview = false) {
    this.params = params
    this.preview = preview
    this.items = groupSSWItems(stimuli)
    this.refDb = refDb
    this.curve = curve

    const numItems = Math.min(params.num_items ?? 40, this.items.length)
    const trials: SSWTrial[] = []
    for (let i = 0; i < numItems; i++) {
      const bundle = this.items[i]
      if (!bundle) continue
      if (!preview && (!bundle.RNC || !bundle.RC || !bundle.LC || !bundle.LNC)) continue
      if (preview && !bundle.RNC && !bundle.RC && !bundle.LC && !bundle.LNC) continue
      trials.push({
        index: i,
        item_id: bundle.item_id,
        ear_first: earFirstFor(params.ear_first_order ?? 'RLRL', i),
        expected: {
          RNC: bundle.RNC?.token ?? '—',
          RC: bundle.RC?.token ?? '—',
          LC: bundle.LC?.token ?? '—',
          LNC: bundle.LNC?.token ?? '—',
        },
        pair_label: bundle.pair_label,
      })
    }

    this.state = { trials, currentIndex: 0, isPlaying: false, finished: false, score: null }
  }

  readyItems(): number {
    return this.items.filter(b => b.RNC?.file_path && b.RC?.file_path && b.LC?.file_path && b.LNC?.file_path).length
  }

  subscribe(fn: (s: SSWState) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    for (const l of this.listeners) {
      l({ ...this.state, trials: [...this.state.trials] })
    }
  }

  hydrate(prev: PrevResponse[]) {
    const byIdx = [...prev].sort((a, b) => a.item_index - b.item_index)
    for (const r of byIdx) {
      const parts = r.expected_pattern.split('|')
      const map: Record<string, string> = {}
      for (const p of parts) {
        const [k, ...rest] = p.split(':')
        map[k] = rest.join(':')
      }
      const idx = r.item_index
      const trial = this.state.trials[idx]
      if (!trial) continue
      if (map.first === 'R' || map.first === 'L') trial.ear_first = map.first
      const givenParts = (r.given_pattern ?? '').split('|')
      const givenMap: Record<string, string> = {}
      for (const p of givenParts) {
        const [k, ...rest] = p.split(':')
        if (k) givenMap[k] = rest.join(':')
      }
      const given: Record<SSWCondition, string | null> = {
        RNC: givenMap.RNC ?? null, RC: givenMap.RC ?? null,
        LC: givenMap.LC ?? null, LNC: givenMap.LNC ?? null,
      }
      trial.given = given
      trial.correct = {
        RNC: normalizeToken(given.RNC ?? '') === normalizeToken(trial.expected.RNC),
        RC: normalizeToken(given.RC ?? '') === normalizeToken(trial.expected.RC),
        LC: normalizeToken(given.LC ?? '') === normalizeToken(trial.expected.LC),
        LNC: normalizeToken(given.LNC ?? '') === normalizeToken(trial.expected.LNC),
      }
      trial.reversal = givenMap.reversal === '1'
    }
    const lastAnswered = [...this.state.trials].reverse().find(t => t.given)
    this.state.currentIndex = lastAnswered ? Math.min(lastAnswered.index + 1, this.state.trials.length) : 0
    if (this.state.currentIndex >= this.state.trials.length) {
      this.state.finished = true
      this.state.score = this.computeScore()
    }
    this.emit()
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

  currentTrial(): SSWTrial | null {
    return this.state.trials[this.state.currentIndex] ?? null
  }

  async playCurrent(): Promise<void> {
    if (this.state.isPlaying || this.state.finished) return
    const trial = this.currentTrial()
    if (!trial) return
    if (this.preview) {
      this.state.isPlaying = true
      trial.presented_at = Date.now()
      this.emit()
      await new Promise(r => setTimeout(r, PREVIEW_PLAY_MS))
      this.state.isPlaying = false
      this.emit()
      return
    }
    const bundle = this.items.find(b => b.item_id === trial.item_id)
    if (!bundle?.RNC || !bundle.RC || !bundle.LC || !bundle.LNC) return
    const [rnc, rc, lc, lnc] = await Promise.all([
      this.getBuffer(bundle.RNC), this.getBuffer(bundle.RC),
      this.getBuffer(bundle.LC), this.getBuffer(bundle.LNC),
    ])
    this.state.isPlaying = true
    trial.presented_at = Date.now()
    this.emit()
    await new Promise<void>(resolve => {
      playSSWItem({
        rnc, rc, lc, lnc,
        rms_rnc: bundle.RNC!.rms_dbfs, rms_rc: bundle.RC!.rms_dbfs,
        rms_lc: bundle.LC!.rms_dbfs, rms_lnc: bundle.LNC!.rms_dbfs,
        level_db: this.params.level_db,
        ear_first: trial.ear_first,
        refDb: this.refDb,
        curve: this.curve,
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

  answer(given: Record<SSWCondition, string | null>, reversal: boolean = false): SSWTrial | null {
    const trial = this.currentTrial()
    if (!trial || trial.given) return null
    trial.given = given
    trial.reversal = reversal
    trial.answered_at = Date.now()
    trial.correct = {
      RNC: normalizeToken(given.RNC ?? '') === normalizeToken(trial.expected.RNC),
      RC: normalizeToken(given.RC ?? '') === normalizeToken(trial.expected.RC),
      LC: normalizeToken(given.LC ?? '') === normalizeToken(trial.expected.LC),
      LNC: normalizeToken(given.LNC ?? '') === normalizeToken(trial.expected.LNC),
    }
    this.emit()
    return trial
  }

  next() {
    if (this.state.finished) return
    if (this.state.currentIndex < this.state.trials.length - 1) {
      this.state.currentIndex++
    } else {
      this.state.finished = true
      this.state.score = this.computeScore()
    }
    this.emit()
  }

  finalize(): SSWScore {
    if (!this.state.finished) {
      this.state.finished = true
      this.state.score = this.computeScore()
      this.emit()
    }
    return this.state.score!
  }

  computeScore(): SSWScore {
    const conds: SSWCondition[] = ['RNC', 'RC', 'LC', 'LNC']
    const tally: Record<SSWCondition, { correct: number; total: number }> =
      { RNC: { correct: 0, total: 0 }, RC: { correct: 0, total: 0 }, LC: { correct: 0, total: 0 }, LNC: { correct: 0, total: 0 } }
    let reversals = 0
    for (const t of this.state.trials) {
      if (!t.correct) continue
      for (const c of conds) {
        tally[c].total++
        if (t.correct[c]) tally[c].correct++
      }
      if (t.reversal) reversals++
    }
    const by_condition: SSWScore['by_condition'] = {
      RNC: { correct: tally.RNC.correct, total: tally.RNC.total, error_pct: tally.RNC.total ? 100 * (1 - tally.RNC.correct / tally.RNC.total) : 0 },
      RC: { correct: tally.RC.correct, total: tally.RC.total, error_pct: tally.RC.total ? 100 * (1 - tally.RC.correct / tally.RC.total) : 0 },
      LC: { correct: tally.LC.correct, total: tally.LC.total, error_pct: tally.LC.total ? 100 * (1 - tally.LC.correct / tally.LC.total) : 0 },
      LNC: { correct: tally.LNC.correct, total: tally.LNC.total, error_pct: tally.LNC.total ? 100 * (1 - tally.LNC.correct / tally.LNC.total) : 0 },
    }
    const rTotal = tally.RNC.total + tally.RC.total
    const lTotal = tally.LC.total + tally.LNC.total
    const rErr = (tally.RNC.total - tally.RNC.correct) + (tally.RC.total - tally.RC.correct)
    const lErr = (tally.LC.total - tally.LC.correct) + (tally.LNC.total - tally.LNC.correct)
    const total_errors = rErr + lErr
    const total_items = rTotal + lTotal
    const raw_score_pct = total_items ? 100 * total_errors / total_items : 0
    const ear_effect_pct = (lTotal && rTotal)
      ? ((lErr / lTotal) - (rErr / rTotal)) * 100
      : 0
    const nonComp = (tally.RNC.total - tally.RNC.correct) + (tally.LNC.total - tally.LNC.correct)
    const comp = (tally.RC.total - tally.RC.correct) + (tally.LC.total - tally.LC.correct)
    const ncTotal = tally.RNC.total + tally.LNC.total
    const cTotal = tally.RC.total + tally.LC.total
    const order_effect_pct = (ncTotal && cTotal)
      ? ((comp / cTotal) - (nonComp / ncTotal)) * 100
      : 0
    let response_bias: 'none' | 'left' | 'right' = 'none'
    if (Math.abs(ear_effect_pct) > 15) response_bias = ear_effect_pct > 0 ? 'left' : 'right'
    const qualifiers: string[] = []
    if (Math.abs(ear_effect_pct) > 15) qualifiers.push('ear_effect_significativo')
    if (reversals >= 5) qualifiers.push('reversals_elevados')
    if (Math.abs(order_effect_pct) > 15) qualifiers.push('order_effect_significativo')

    return {
      total_errors, total_items, raw_score_pct,
      by_condition,
      by_ear: { R: { errors: rErr, total: rTotal }, L: { errors: lErr, total: lTotal } },
      ear_effect_pct, order_effect_pct, reversals,
      response_bias, qualifiers,
    }
  }

  getTrials(): SSWTrial[] { return this.state.trials }

  /** Codifica expected/given para persistencia en `responses`. */
  serializeExpected(trial: SSWTrial): string {
    return `RNC:${trial.expected.RNC}|RC:${trial.expected.RC}|LC:${trial.expected.LC}|LNC:${trial.expected.LNC}|first:${trial.ear_first}`
  }

  serializeGiven(trial: SSWTrial): string | null {
    if (!trial.given) return null
    const g = trial.given
    return `RNC:${g.RNC ?? ''}|RC:${g.RC ?? ''}|LC:${g.LC ?? ''}|LNC:${g.LNC ?? ''}|reversal:${trial.reversal ? 1 : 0}`
  }
}

/**
 * Reconstruye `SSWScore` a partir de `responses` persistidos.
 * Útil para informes sin necesidad de levantar el controller completo.
 */
export function scoreFromResponses(prev: PrevResponse[]): SSWScore {
  const conds: SSWCondition[] = ['RNC', 'RC', 'LC', 'LNC']
  const tally: Record<SSWCondition, { correct: number; total: number }> =
    { RNC: { correct: 0, total: 0 }, RC: { correct: 0, total: 0 }, LC: { correct: 0, total: 0 }, LNC: { correct: 0, total: 0 } }
  let reversals = 0

  for (const r of prev) {
    const parts = r.expected_pattern.split('|')
    const expMap: Record<string, string> = {}
    for (const p of parts) {
      const [k, ...rest] = p.split(':')
      expMap[k] = rest.join(':')
    }
    const givenParts = (r.given_pattern ?? '').split('|')
    const givMap: Record<string, string> = {}
    for (const p of givenParts) {
      const [k, ...rest] = p.split(':')
      if (k) givMap[k] = rest.join(':')
    }
    for (const c of conds) {
      if (!expMap[c]) continue
      tally[c].total++
      if (normalizeToken(givMap[c] ?? '') === normalizeToken(expMap[c])) tally[c].correct++
    }
    if (givMap.reversal === '1') reversals++
  }

  const by_condition: SSWScore['by_condition'] = {
    RNC: { correct: tally.RNC.correct, total: tally.RNC.total, error_pct: tally.RNC.total ? 100 * (1 - tally.RNC.correct / tally.RNC.total) : 0 },
    RC: { correct: tally.RC.correct, total: tally.RC.total, error_pct: tally.RC.total ? 100 * (1 - tally.RC.correct / tally.RC.total) : 0 },
    LC: { correct: tally.LC.correct, total: tally.LC.total, error_pct: tally.LC.total ? 100 * (1 - tally.LC.correct / tally.LC.total) : 0 },
    LNC: { correct: tally.LNC.correct, total: tally.LNC.total, error_pct: tally.LNC.total ? 100 * (1 - tally.LNC.correct / tally.LNC.total) : 0 },
  }
  const rTotal = tally.RNC.total + tally.RC.total
  const lTotal = tally.LC.total + tally.LNC.total
  const rErr = (tally.RNC.total - tally.RNC.correct) + (tally.RC.total - tally.RC.correct)
  const lErr = (tally.LC.total - tally.LC.correct) + (tally.LNC.total - tally.LNC.correct)
  const total_errors = rErr + lErr
  const total_items = rTotal + lTotal
  const raw_score_pct = total_items ? 100 * total_errors / total_items : 0
  const ear_effect_pct = (lTotal && rTotal) ? ((lErr / lTotal) - (rErr / rTotal)) * 100 : 0
  const nonCompErr = (tally.RNC.total - tally.RNC.correct) + (tally.LNC.total - tally.LNC.correct)
  const compErr = (tally.RC.total - tally.RC.correct) + (tally.LC.total - tally.LC.correct)
  const ncTotal = tally.RNC.total + tally.LNC.total
  const cTotal = tally.RC.total + tally.LC.total
  const order_effect_pct = (ncTotal && cTotal) ? ((compErr / cTotal) - (nonCompErr / ncTotal)) * 100 : 0
  let response_bias: 'none' | 'left' | 'right' = 'none'
  if (Math.abs(ear_effect_pct) > 15) response_bias = ear_effect_pct > 0 ? 'left' : 'right'
  const qualifiers: string[] = []
  if (Math.abs(ear_effect_pct) > 15) qualifiers.push('ear_effect_significativo')
  if (reversals >= 5) qualifiers.push('reversals_elevados')
  if (Math.abs(order_effect_pct) > 15) qualifiers.push('order_effect_significativo')

  return {
    total_errors, total_items, raw_score_pct,
    by_condition,
    by_ear: { R: { errors: rErr, total: rTotal }, L: { errors: lErr, total: lTotal } },
    ear_effect_pct, order_effect_pct, reversals,
    response_bias, qualifiers,
  }
}
