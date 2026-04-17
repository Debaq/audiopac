import type { TestResponse, TestTemplateParsed, TestSession, Phase } from '@/types'

export interface RTStats {
  n: number
  mean: number | null
  median: number | null
  stdev: number | null
  min: number | null
  max: number | null
}

export interface PositionStat {
  index: number
  total: number
  correct: number
  accuracy: number
}

export interface ConfusionEntry {
  from: string
  to: string
  count: number
}

export interface PatternStat {
  pattern: string
  total: number
  correct: number
  accuracy: number
}

export interface PhaseStats {
  total: number
  correct: number
  score: number
  rt: RTStats
}

export interface SessionAnalysis {
  threshold: number
  passed: boolean
  verdict: 'normal' | 'borderline' | 'abnormal'
  practice: PhaseStats
  test: PhaseStats
  practiceToTestDelta: number
  positionErrors: PositionStat[]
  confusions: ConfusionEntry[]
  patternAccuracy: PatternStat[]
  partialMatchRate: number
  rtTrend: 'faster' | 'slower' | 'stable' | 'insufficient'
  errorDistribution: { early: number; mid: number; late: number }
  interpretation: string[]
}

const DEFAULT_THRESHOLD = 0.75

function rtStats(rts: number[]): RTStats {
  const clean = rts.filter((x): x is number => typeof x === 'number' && !isNaN(x))
  if (clean.length === 0) return { n: 0, mean: null, median: null, stdev: null, min: null, max: null }
  const sorted = [...clean].sort((a, b) => a - b)
  const mean = clean.reduce((a, b) => a + b, 0) / clean.length
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)]
  const variance = clean.reduce((a, b) => a + (b - mean) ** 2, 0) / clean.length
  return {
    n: clean.length,
    mean,
    median,
    stdev: Math.sqrt(variance),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  }
}

function phaseStats(responses: TestResponse[], phase: Phase): PhaseStats {
  const items = responses.filter(r => r.phase === phase)
  const correct = items.filter(r => r.is_correct === 1).length
  const total = items.length
  const rts = items.map(r => r.reaction_time_ms).filter((x): x is number => x !== null)
  return {
    total,
    correct,
    score: total === 0 ? 0 : correct / total,
    rt: rtStats(rts),
  }
}

function positionErrorAnalysis(responses: TestResponse[]): PositionStat[] {
  const test = responses.filter(r => r.phase === 'test' && r.given_pattern)
  if (test.length === 0) return []
  const maxLen = Math.max(...test.map(r => r.expected_pattern.length))
  const stats: PositionStat[] = []
  for (let i = 0; i < maxLen; i++) {
    let total = 0, correct = 0
    for (const r of test) {
      if (i >= r.expected_pattern.length) continue
      total++
      const given = r.given_pattern ?? ''
      if (given[i] === r.expected_pattern[i]) correct++
    }
    stats.push({ index: i, total, correct, accuracy: total === 0 ? 0 : correct / total })
  }
  return stats
}

function confusionMatrix(responses: TestResponse[]): ConfusionEntry[] {
  const map = new Map<string, number>()
  for (const r of responses.filter(x => x.phase === 'test' && x.given_pattern)) {
    const exp = r.expected_pattern
    const giv = r.given_pattern ?? ''
    const len = Math.min(exp.length, giv.length)
    for (let i = 0; i < len; i++) {
      if (exp[i] !== giv[i]) {
        const key = `${exp[i]}→${giv[i]}`
        map.set(key, (map.get(key) ?? 0) + 1)
      }
    }
  }
  return Array.from(map.entries())
    .map(([k, count]) => {
      const [from, to] = k.split('→')
      return { from, to, count }
    })
    .sort((a, b) => b.count - a.count)
}

function patternAccuracy(responses: TestResponse[]): PatternStat[] {
  const map = new Map<string, { total: number; correct: number }>()
  for (const r of responses.filter(x => x.phase === 'test')) {
    const cur = map.get(r.expected_pattern) ?? { total: 0, correct: 0 }
    cur.total++
    if (r.is_correct === 1) cur.correct++
    map.set(r.expected_pattern, cur)
  }
  return Array.from(map.entries())
    .map(([pattern, s]) => ({ pattern, total: s.total, correct: s.correct, accuracy: s.correct / s.total }))
    .sort((a, b) => a.accuracy - b.accuracy)
}

function partialMatchRate(responses: TestResponse[]): number {
  const errors = responses.filter(r => r.phase === 'test' && r.is_correct === 0 && r.given_pattern)
  if (errors.length === 0) return 0
  let partial = 0
  for (const r of errors) {
    const exp = r.expected_pattern
    const giv = r.given_pattern ?? ''
    const len = Math.min(exp.length, giv.length)
    let matches = 0
    for (let i = 0; i < len; i++) if (exp[i] === giv[i]) matches++
    if (matches > 0 && matches < exp.length) partial++
  }
  return partial / errors.length
}

function rtTrend(responses: TestResponse[]): SessionAnalysis['rtTrend'] {
  const items = responses
    .filter(r => r.phase === 'test' && r.reaction_time_ms !== null)
    .map(r => r.reaction_time_ms as number)
  if (items.length < 6) return 'insufficient'
  const half = Math.floor(items.length / 2)
  const first = items.slice(0, half)
  const second = items.slice(-half)
  const mA = first.reduce((a, b) => a + b, 0) / first.length
  const mB = second.reduce((a, b) => a + b, 0) / second.length
  const delta = (mB - mA) / mA
  if (delta > 0.15) return 'slower'
  if (delta < -0.15) return 'faster'
  return 'stable'
}

function errorDistribution(responses: TestResponse[]): { early: number; mid: number; late: number } {
  const test = responses.filter(r => r.phase === 'test')
  if (test.length === 0) return { early: 0, mid: 0, late: 0 }
  const third = Math.ceil(test.length / 3)
  const segs = [test.slice(0, third), test.slice(third, 2 * third), test.slice(2 * third)]
  const rate = (seg: TestResponse[]) => seg.length === 0 ? 0 : seg.filter(r => r.is_correct === 0).length / seg.length
  return { early: rate(segs[0]), mid: rate(segs[1]), late: rate(segs[2]) }
}

function buildInterpretation(a: Omit<SessionAnalysis, 'interpretation'>, template: TestTemplateParsed): string[] {
  const out: string[] = []
  const scorePct = (a.test.score * 100).toFixed(1)

  if (a.verdict === 'normal') {
    out.push(`Desempeño dentro de rango esperado (${scorePct}%, umbral ≥${(a.threshold * 100).toFixed(0)}%).`)
  } else if (a.verdict === 'borderline') {
    out.push(`Desempeño limítrofe (${scorePct}%). Considerar reevaluación o prueba complementaria.`)
  } else {
    out.push(`Desempeño bajo el umbral de referencia (${scorePct}%, umbral ≥${(a.threshold * 100).toFixed(0)}%). Sugiere dificultad en ${template.test_type === 'DPS' ? 'procesamiento temporal (duración)' : template.test_type === 'PPS' ? 'procesamiento de frecuencia/patrón tonal' : 'la habilidad evaluada'}.`)
  }

  if (a.practiceToTestDelta < -0.1) {
    out.push(`Caída de ${Math.abs(a.practiceToTestDelta * 100).toFixed(0)} pp entre práctica y test: posible efecto de fatiga, atención o dificultad con ítems test.`)
  } else if (a.practiceToTestDelta > 0.15) {
    out.push(`Mejora notable de práctica a test (${(a.practiceToTestDelta * 100).toFixed(0)} pp): sugiere aprendizaje rápido del paradigma.`)
  }

  const worstPos = a.positionErrors.reduce((w, p) => p.accuracy < w.accuracy ? p : w, a.positionErrors[0])
  if (a.positionErrors.length >= 2 && worstPos && worstPos.accuracy < 0.7) {
    out.push(`Posición ${worstPos.index + 1} concentra errores (${(worstPos.accuracy * 100).toFixed(0)}% acierto). Revisar posible efecto de posición serial.`)
  }

  if (a.confusions.length > 0) {
    const top = a.confusions[0]
    if (top.count >= 3) {
      out.push(`Confusión predominante: "${top.from}" percibido como "${top.to}" (${top.count} veces). Indica sesgo perceptual hacia ${top.to}.`)
    }
  }

  if (a.partialMatchRate > 0.5) {
    out.push(`${(a.partialMatchRate * 100).toFixed(0)}% de los errores son parciales (alguna posición correcta): sugiere dificultad discriminativa, no ausencia de percepción.`)
  }

  if (a.rtTrend === 'slower') {
    out.push('Latencias crecientes a lo largo de la prueba: considerar fatiga o pérdida de atención sostenida.')
  } else if (a.rtTrend === 'faster') {
    out.push('Latencias decrecientes: familiarización progresiva con la tarea.')
  }

  if (a.errorDistribution.late > a.errorDistribution.early + 0.15) {
    out.push('Errores concentrados al final: patrón compatible con fatiga auditiva o disminución de atención.')
  } else if (a.errorDistribution.early > a.errorDistribution.late + 0.15) {
    out.push('Errores concentrados al inicio: patrón compatible con calentamiento lento o ansiedad inicial.')
  }

  if (a.test.rt.mean !== null && a.test.rt.mean > 4000) {
    out.push(`Tiempo medio de respuesta elevado (${(a.test.rt.mean / 1000).toFixed(1)}s): evaluar velocidad de procesamiento.`)
  }

  out.push('Interpretación automática orientativa. El juicio clínico final corresponde al profesional.')
  return out
}

export function analyzeSession(
  _session: TestSession,
  template: TestTemplateParsed,
  responses: TestResponse[],
  threshold = DEFAULT_THRESHOLD,
): SessionAnalysis {
  const practice = phaseStats(responses, 'practice')
  const test = phaseStats(responses, 'test')
  const passed = test.score >= threshold
  const verdict: SessionAnalysis['verdict'] =
    test.score >= threshold ? 'normal'
    : test.score >= threshold - 0.1 ? 'borderline'
    : 'abnormal'

  const base = {
    threshold,
    passed,
    verdict,
    practice,
    test,
    practiceToTestDelta: test.score - practice.score,
    positionErrors: positionErrorAnalysis(responses),
    confusions: confusionMatrix(responses),
    patternAccuracy: patternAccuracy(responses),
    partialMatchRate: partialMatchRate(responses),
    rtTrend: rtTrend(responses),
    errorDistribution: errorDistribution(responses),
  }

  const interpretation = buildInterpretation(base, template)
  return { ...base, interpretation }
}
