/**
 * Balance fonémico observado (en la lista) vs esperado (corpus ES).
 * Frecuencias referenciales aproximadas de español general (RAE / corpus CREA).
 * No pretende ser IPA — trabaja a nivel ortográfico + digrafos.
 */

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Info } from 'lucide-react'
import { analyze, articulatoryStats, MANNER_LABELS, PLACE_LABELS, chiSquareScore, findMinimalPairs, CONTRAST_LABELS } from '@/lib/es/phonetics'
import type { Manner, Place, MinimalPairContrast } from '@/lib/es/phonetics'
import { generateSuggestions } from '@/lib/es/suggestions'

// % esperado en corpus español (promedio texto/habla). Digrafos separados.
const EXPECTED_CONS_PCT: Record<string, number> = {
  s: 7.98, r: 6.87, n: 6.71, d: 5.86, l: 4.97, t: 4.63, c: 4.68, m: 3.15,
  p: 2.51, b: 1.42, g: 1.01, v: 0.90, y: 0.90, h: 0.70, f: 0.69, z: 0.52,
  j: 0.44, ñ: 0.31, x: 0.22,
  ch: 0.40, ll: 0.40, rr: 0.80, qu: 0.88,
}
const EXPECTED_VOW_PCT: Record<string, number> = {
  e: 13.68, a: 12.53, o: 8.68, i: 6.25, u: 3.93,
}

function normalize(pct: Record<string, number>): Record<string, number> {
  const sum = Object.values(pct).reduce((a, b) => a + b, 0)
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(pct)) out[k] = (v / sum) * 100
  return out
}

const EXPECTED_CONS = normalize(EXPECTED_CONS_PCT)
const EXPECTED_VOW = normalize(EXPECTED_VOW_PCT)

// Referencias por clase articulatoria (corpus ES general, aproximado)
const EXPECTED_MANNER_PCT: Record<Manner, number> = {
  oclusiva: 30,
  fricativa: 28,
  nasal: 16,
  lateral: 8,
  vibrante_simple: 8,
  vibrante_multiple: 2,
  africada: 1,
  aproximante: 7,
}
const EXPECTED_PLACE_PCT: Record<Place, number> = {
  dental_alveolar: 52,
  bilabial: 16,
  velar: 15,
  palatal: 10,
  labiodental: 4,
  glotal: 0,
}
// Silabas: ES favorece abiertas ~70% CV
const EXPECTED_OPEN_PCT = 70

function stripAccent(v: string): string {
  return v.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

/** Divide frases en palabras para análisis agregado. Descarta puntuación. */
function tokensToWords(tokens: string[], mode: 'word' | 'sentence'): string[] {
  if (mode === 'word') return tokens
  const out: string[] = []
  for (const t of tokens) {
    for (const w of t.split(/\s+/)) {
      const clean = w.replace(/[^\p{L}\-]/gu, '').toLowerCase()
      if (clean) out.push(clean)
    }
  }
  return out
}

interface Props {
  tokens: string[]
  className?: string
  /** `sentence`: divide en palabras antes de analizar (HINT/Matrix). Default `word`. */
  mode?: 'word' | 'sentence'
  /** Si true, verifica que todos los tokens sean monosílabos (ej. Dichotic Digits). */
  expectMonosyllabic?: boolean
  /** Si true, muestra sección de pares mínimos (PALPA). */
  showMinimalPairs?: boolean
}

export function PhonemeBalanceChart({ tokens, className, mode = 'word', expectMonosyllabic, showMinimalPairs }: Props) {
  const words = useMemo(() => tokensToWords(tokens, mode), [tokens, mode])
  if (words.length === 0) return null

  // Tally observado
  const consCount: Record<string, number> = {}
  const vowCount: Record<string, number> = {}
  let consTotal = 0
  let vowTotal = 0
  for (const t of words) {
    const a = analyze(t)
    for (const c of a.consonants) {
      consCount[c] = (consCount[c] ?? 0) + 1
      consTotal++
    }
    for (const v of a.vowels) {
      const base = stripAccent(v)
      if (EXPECTED_VOW[base] !== undefined) {
        vowCount[base] = (vowCount[base] ?? 0) + 1
        vowTotal++
      }
    }
  }

  const consObsPct: Record<string, number> = {}
  for (const [k, v] of Object.entries(consCount)) consObsPct[k] = consTotal > 0 ? (v / consTotal) * 100 : 0
  const vowObsPct: Record<string, number> = {}
  for (const [k, v] of Object.entries(vowCount)) vowObsPct[k] = vowTotal > 0 ? (v / vowTotal) * 100 : 0

  // Score chi-cuadrado normalizado (reemplaza 100 − Σ|diff|)
  const balanceScoreCons = chiSquareScore(consCount, EXPECTED_CONS, consTotal)
  const balanceScoreVow = chiSquareScore(vowCount, EXPECTED_VOW, vowTotal)

  // Para mostrar: top 14 consonantes por esperado + vocales 5
  const consRows = Object.entries(EXPECTED_CONS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([k, expected]) => ({
      letter: k,
      observed: consObsPct[k] ?? 0,
      expected,
      diff: (consObsPct[k] ?? 0) - expected,
    }))
  // Agregar cualquier observado no listado al final
  for (const [k, v] of Object.entries(consObsPct)) {
    if (!consRows.find(r => r.letter === k)) {
      consRows.push({ letter: k, observed: v, expected: 0, diff: v })
    }
  }

  const vowRows = Object.entries(EXPECTED_VOW)
    .sort((a, b) => b[1] - a[1])
    .map(([k, expected]) => ({
      letter: k,
      observed: vowObsPct[k] ?? 0,
      expected,
      diff: (vowObsPct[k] ?? 0) - expected,
    }))

  const BarRow = ({ row, maxScale, color }: { row: { letter: string; observed: number; expected: number; diff: number }; maxScale: number; color: string }) => {
    const obsW = (row.observed / maxScale) * 100
    const expX = (row.expected / maxScale) * 100
    const over = row.diff > 1.5
    const under = row.diff < -1.5
    return (
      <div className="flex items-center gap-2 text-[10px]">
        <span className="w-6 font-mono text-right">{row.letter}</span>
        <div className="relative flex-1 h-3 bg-[var(--secondary)] rounded">
          <div
            className={`absolute left-0 top-0 h-full rounded ${color}`}
            style={{ width: `${Math.min(100, obsW)}%` }}
          />
          {row.expected > 0 && (
            <div
              className="absolute top-[-2px] h-[calc(100%+4px)] w-[2px] bg-[var(--foreground)]/60"
              style={{ left: `${Math.min(100, expX)}%` }}
              title={`Esperado ES: ${row.expected.toFixed(1)}%`}
            />
          )}
        </div>
        <span className={`w-16 text-right tabular-nums ${over ? 'text-emerald-600' : under ? 'text-amber-600' : 'text-[var(--muted-foreground)]'}`}>
          {row.observed.toFixed(1)}%
        </span>
        <span className="w-14 text-right tabular-nums text-[var(--muted-foreground)]">
          {row.diff > 0 ? '+' : ''}{row.diff.toFixed(1)}
        </span>
      </div>
    )
  }

  const maxCons = Math.max(12, ...consRows.map(r => Math.max(r.observed, r.expected)))
  const maxVow = Math.max(20, ...vowRows.map(r => Math.max(r.observed, r.expected)))

  const balanceLabel = (score: number) =>
    score >= 70 ? { txt: 'balanceado', color: 'bg-emerald-500/15 text-emerald-700' }
    : score >= 45 ? { txt: 'aceptable', color: 'bg-sky-500/15 text-sky-700' }
    : score >= 20 ? { txt: 'desbalanceado', color: 'bg-amber-500/15 text-amber-700' }
    : { txt: 'muy desbalanceado', color: 'bg-red-500/15 text-red-700' }

  const consLabel = balanceLabel(balanceScoreCons)
  const vowLabel = balanceLabel(balanceScoreVow)

  return (
    <div className={`rounded-md border border-[var(--border)]/40 bg-[var(--secondary)]/20 p-2.5 space-y-3 ${className ?? ''}`}>
      <div className="flex items-center justify-between flex-wrap gap-1">
        <b className="text-[11px]">
          Balance fonémico vs español
          {mode === 'sentence' && <span className="ml-1 text-[9px] font-normal text-[var(--muted-foreground)]">({words.length} palabras de {tokens.length} frases)</span>}
        </b>
        <div className="flex gap-1.5 text-[10px]">
          <span className={`px-1.5 py-0.5 rounded ${consLabel.color}`} title="Chi-cuadrado normalizado (0-100)">
            Consonantes: {consLabel.txt} ({balanceScoreCons.toFixed(0)})
          </span>
          <span className={`px-1.5 py-0.5 rounded ${vowLabel.color}`} title="Chi-cuadrado normalizado (0-100)">
            Vocales: {vowLabel.txt} ({balanceScoreVow.toFixed(0)})
          </span>
        </div>
      </div>

      {expectMonosyllabic && <MonosyllabicCheck words={words} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-[var(--muted-foreground)] mb-1">
            Consonantes <span className="opacity-60">(barra = observado · línea = esperado ES)</span>
          </div>
          <div className="space-y-0.5">
            {consRows.map(r => (
              <BarRow key={r.letter} row={r} maxScale={maxCons} color="bg-sky-500/60" />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-[10px] text-[var(--muted-foreground)] mb-1">Vocales</div>
            <div className="space-y-0.5">
              {vowRows.map(r => (
                <BarRow key={r.letter} row={r} maxScale={maxVow} color="bg-rose-500/60" />
              ))}
            </div>
          </div>
          <ArticulatorySection tokens={words} />
        </div>
      </div>

      {showMinimalPairs && <MinimalPairsSection words={words} />}

      <div className="text-[9px] text-[var(--muted-foreground)] border-t border-[var(--border)]/40 pt-1">
        Score = chi-cuadrado normalizado (100·e^(-χ²/df)). ≥70 balanceado · ≥45 aceptable · &lt;20 muy desbalanceado.
        Verde: sobre-representado (+), ámbar: sub-representado (−). Frecuencias esperadas del corpus CREA/RAE.
      </div>
    </div>
  )
}

function MonosyllabicCheck({ words }: { words: string[] }) {
  const nonMono = words.filter(w => analyze(w).syllable_count !== 1)
  if (nonMono.length === 0) {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-[10px] text-emerald-700">
        ✓ Todos los tokens son monosílabos ({words.length}).
      </div>
    )
  }
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-[10px] text-amber-700">
      <b>Atención:</b> {nonMono.length} de {words.length} tokens no son monosílabos:
      <span className="ml-1 font-mono">{nonMono.slice(0, 6).join(', ')}{nonMono.length > 6 ? `, +${nonMono.length - 6}` : ''}</span>
    </div>
  )
}

function MinimalPairsSection({ words }: { words: string[] }) {
  const [open, setOpen] = useState(false)
  const pairs = useMemo(() => findMinimalPairs(words), [words])
  if (words.length < 2) return null

  const byContrast: Record<MinimalPairContrast, { a: string; b: string }[]> = {
    voicing: [], manner: [], place: [], nasal_oral: [], vowel: [], rhotic: [], other: [],
  }
  for (const p of pairs) byContrast[p.contrast].push({ a: p.a, b: p.b })

  const total = pairs.length
  const coverage = total / Math.max(1, words.length / 2) // pares por palabra

  return (
    <div className="rounded-md border border-[var(--border)]/40 bg-[var(--secondary)]/20 p-2 space-y-1">
      <button type="button" onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-1 text-[11px] font-medium">
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span>Pares mínimos (PALPA)</span>
        <span className="ml-auto text-[10px] text-[var(--muted-foreground)]">
          {total} pares · {coverage >= 0.8 ? <b className="text-emerald-600">cobertura buena</b> : coverage >= 0.3 ? <b className="text-sky-700">parcial</b> : <b className="text-amber-600">baja</b>}
        </span>
      </button>
      {open && (
        <div className="pt-1 space-y-1">
          {(Object.keys(byContrast) as MinimalPairContrast[]).map(k => {
            const arr = byContrast[k]
            if (arr.length === 0) return null
            return (
              <div key={k} className="text-[10px]">
                <span className="font-semibold w-28 inline-block">{CONTRAST_LABELS[k]}</span>
                <span className="text-[var(--muted-foreground)]">({arr.length}) </span>
                <span className="font-mono">{arr.slice(0, 8).map(p => `${p.a}↔${p.b}`).join(', ')}{arr.length > 8 ? ` +${arr.length - 8}` : ''}</span>
              </div>
            )
          })}
          {total === 0 && <div className="text-[10px] text-[var(--muted-foreground)]">No se detectaron pares mínimos (distancia 1) en la lista.</div>}
        </div>
      )}
    </div>
  )
}

function ArticulatorySection({ tokens }: { tokens: string[] }) {
  const stats = articulatoryStats(tokens)
  const suggestions = useMemo(() => generateSuggestions({
    stats,
    expectedManner: EXPECTED_MANNER_PCT,
    expectedPlace: EXPECTED_PLACE_PCT,
    expectedOpenPct: EXPECTED_OPEN_PCT,
  }), [stats])

  if (stats.total_consonants === 0) return null

  const mannerPct = (k: Manner) => (stats.manner[k] / stats.total_consonants) * 100
  const placePct = (k: Place) => (stats.place[k] / stats.total_consonants) * 100

  const mannerRows = (Object.keys(EXPECTED_MANNER_PCT) as Manner[]).map(k => ({
    key: k,
    label: MANNER_LABELS[k],
    observed: mannerPct(k),
    expected: EXPECTED_MANNER_PCT[k],
    diff: mannerPct(k) - EXPECTED_MANNER_PCT[k],
  }))
  const placeRows = (Object.keys(EXPECTED_PLACE_PCT) as Place[])
    .filter(k => EXPECTED_PLACE_PCT[k] > 0)
    .map(k => ({
      key: k,
      label: PLACE_LABELS[k],
      observed: placePct(k),
      expected: EXPECTED_PLACE_PCT[k],
      diff: placePct(k) - EXPECTED_PLACE_PCT[k],
    }))

  const maxM = Math.max(35, ...mannerRows.map(r => Math.max(r.observed, r.expected)))
  const maxP = Math.max(55, ...placeRows.map(r => Math.max(r.observed, r.expected)))

  const openPct = stats.open_syllables + stats.closed_syllables > 0
    ? (stats.open_syllables / (stats.open_syllables + stats.closed_syllables)) * 100
    : 0
  const voicedPct = stats.total_consonants > 0 ? (stats.voiced / stats.total_consonants) * 100 : 0

  const ClassRow = ({ row, maxScale, color }: {
    row: { label: string; observed: number; expected: number; diff: number }
    maxScale: number
    color: string
  }) => {
    const obsW = (row.observed / maxScale) * 100
    const expX = (row.expected / maxScale) * 100
    const over = row.diff > 2.5
    const under = row.diff < -2.5
    return (
      <div className="flex items-center gap-2 text-[10px]">
        <span className="w-24 text-right">{row.label}</span>
        <div className="relative flex-1 h-3 bg-[var(--secondary)] rounded">
          <div className={`absolute left-0 top-0 h-full rounded ${color}`} style={{ width: `${Math.min(100, obsW)}%` }} />
          <div
            className="absolute top-[-2px] h-[calc(100%+4px)] w-[2px] bg-[var(--foreground)]/60"
            style={{ left: `${Math.min(100, expX)}%` }}
            title={`Esperado ES: ${row.expected.toFixed(1)}%`}
          />
        </div>
        <span className={`w-14 text-right tabular-nums ${over ? 'text-emerald-600' : under ? 'text-amber-600' : 'text-[var(--muted-foreground)]'}`}>
          {row.observed.toFixed(1)}%
        </span>
        <span className="w-12 text-right tabular-nums text-[var(--muted-foreground)]">
          {row.diff > 0 ? '+' : ''}{row.diff.toFixed(1)}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-2 border-t border-[var(--border)]/40 pt-2">
      <div className="flex items-center justify-between">
        <b className="text-[11px]">Balance articulatorio</b>
        <div className="text-[10px] text-[var(--muted-foreground)]">n = {stats.total_consonants}</div>
      </div>

      <div>
        <div className="text-[10px] text-[var(--muted-foreground)] mb-1">Por modo de articulación</div>
        <div className="space-y-0.5">
          {mannerRows.map(r => <ClassRow key={r.key} row={r} maxScale={maxM} color="bg-violet-500/60" />)}
        </div>
      </div>

      <div>
        <div className="text-[10px] text-[var(--muted-foreground)] mb-1">Por punto de articulación</div>
        <div className="space-y-0.5">
          {placeRows.map(r => <ClassRow key={r.key} row={r} maxScale={maxP} color="bg-teal-500/60" />)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded border border-[var(--border)]/40 p-2">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[var(--muted-foreground)]">Estructura silábica</span>
            <span className={`${Math.abs(openPct - EXPECTED_OPEN_PCT) > 15 ? 'text-amber-600' : 'text-[var(--muted-foreground)]'}`}>
              esperado {EXPECTED_OPEN_PCT}%
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span>Abiertas (CV):</span>
            <b>{openPct.toFixed(0)}%</b>
            <span className="text-[var(--muted-foreground)]">·</span>
            <span>Cerradas (CVC+):</span>
            <b>{(100 - openPct).toFixed(0)}%</b>
          </div>
          <div className="text-[9px] text-[var(--muted-foreground)]">
            {stats.open_syllables + stats.closed_syllables} sílabas · coda avg: {(stats.coda_count / Math.max(1, stats.open_syllables + stats.closed_syllables)).toFixed(2)}
          </div>
        </div>
        <div className="rounded border border-[var(--border)]/40 p-2">
          <div className="text-[var(--muted-foreground)] mb-0.5">Sonoridad</div>
          <div className="flex items-center gap-1">
            <span>Sonoras:</span> <b>{voicedPct.toFixed(0)}%</b>
            <span className="text-[var(--muted-foreground)]">·</span>
            <span>Sordas:</span> <b>{(100 - voicedPct).toFixed(0)}%</b>
          </div>
          <div className="text-[9px] text-[var(--muted-foreground)]">
            {stats.voiced} sonoras / {stats.voiceless} sordas (sobre consonantes)
          </div>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="rounded border border-[var(--border)]/40 bg-[var(--background)]/40 p-2 space-y-1">
          <div className="flex items-center gap-1 text-[10px] font-semibold">
            <Info className="w-3 h-3" />
            Sugerencias para mejorar balance
          </div>
          <ul className="space-y-0.5">
            {suggestions.slice(0, 6).map((s, i) => (
              <li key={i} className={`text-[10px] ${s.severity === 'warn' ? 'text-amber-700' : 'text-[var(--foreground)]'}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${s.severity === 'warn' ? 'bg-amber-500' : 'bg-sky-500'}`} />
                {s.text}
              </li>
            ))}
          </ul>
          {suggestions.length > 6 && (
            <div className="text-[9px] text-[var(--muted-foreground)]">+{suggestions.length - 6} sugerencias más (ajustá las primeras y revisá el chart).</div>
          )}
        </div>
      )}
    </div>
  )
}
