// Análisis fonético básico de español LatAm/peninsular.
// No pretende ser IPA estricto — apunta a feedback UX al crear listas SRT/bisílabos.

const STRONG = new Set(['a', 'á', 'e', 'é', 'o', 'ó'])
const WEAK = new Set(['i', 'í', 'u', 'ú', 'ü'])
const ACCENTED = new Set(['á', 'é', 'í', 'ó', 'ú'])
const VOWELS = new Set([...STRONG, ...WEAK])

export function isVowel(c: string): boolean { return VOWELS.has(c.toLowerCase()) }
export function isStrong(c: string): boolean { return STRONG.has(c.toLowerCase()) }
export function isWeak(c: string): boolean { return WEAK.has(c.toLowerCase()) }
export function isAccented(c: string): boolean { return ACCENTED.has(c.toLowerCase()) }

function stripDiacritic(c: string): string {
  return c.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

/** Cuenta sílabas usando regla ES: dos fuertes = hiato; débil acentuada = hiato; resto = diptongo. */
export function syllableCount(raw: string): number {
  const w = raw.toLowerCase().trim()
  if (!w) return 0
  let count = 0
  let inNucleus = false
  let prev: string | null = null
  for (let i = 0; i < w.length; i++) {
    const c = w[i]
    if (isVowel(c)) {
      if (!inNucleus) {
        count++; inNucleus = true
      } else if (prev) {
        // dos vocales contiguas — ¿hiato?
        const bothStrong = isStrong(prev) && isStrong(c)
        const weakAcc = (isWeak(prev) && isAccented(prev)) || (isWeak(c) && isAccented(c))
        if (bothStrong || weakAcc) count++  // nuevo núcleo
      }
      prev = c
    } else {
      inNucleus = false
      prev = null
    }
  }
  return count
}

/** Detecta posición tonal. Regla ES:
 *  - palabra con tilde: esa es la tónica
 *  - termina en vocal/n/s: penúltima (grave)
 *  - termina en consonante (≠ n/s): última (aguda)
 */
export function stressedSyllableIndex(word: string, syllables: string[]): number {
  // si alguna sílaba tiene tilde, esa manda
  for (let i = 0; i < syllables.length; i++) {
    if ([...syllables[i]].some(isAccented)) return i
  }
  const last = word[word.length - 1]?.toLowerCase() ?? ''
  const endsVowelNS = isVowel(last) || last === 'n' || last === 's'
  if (syllables.length === 0) return -1
  return endsVowelNS ? Math.max(0, syllables.length - 2) : syllables.length - 1
}

const INSEPARABLE = new Set(['pr','pl','br','bl','tr','dr','fr','fl','gr','gl','cr','cl','ch','ll','rr'])

/** Divide en sílabas. Pragmático, ~95% correcto para léxico básico. */
export function syllabify(raw: string): string[] {
  const w = raw.toLowerCase().trim()
  if (!w) return []
  // Paso 1: identificar grupos (V = núcleo vocálico, C = consonante individual).
  type Token = { kind: 'V' | 'C'; text: string }
  const tokens: Token[] = []
  let i = 0
  while (i < w.length) {
    const c = w[i]
    if (!/[a-záéíóúüñ]/.test(c)) { i++; continue }
    if (isVowel(c)) {
      let end = i + 1
      // extender núcleo con vocales que formen diptongo/triptongo
      while (end < w.length && isVowel(w[end])) {
        const prev = w[end - 1]
        const curr = w[end]
        const bothStrong = isStrong(prev) && isStrong(curr)
        const weakAcc = (isWeak(prev) && isAccented(prev)) || (isWeak(curr) && isAccented(curr))
        if (bothStrong || weakAcc) break
        end++
      }
      tokens.push({ kind: 'V', text: w.slice(i, end) })
      i = end
    } else {
      // consonantes contiguas — cada una es C individual (los digrafos ch/ll/rr se manejan en el boundary)
      tokens.push({ kind: 'C', text: c })
      i++
    }
  }
  // Paso 2: recorrer y armar sílabas. Regla: todo hasta el próximo V, aplicando corte según cluster.
  const syllables: string[] = []
  let buffer = ''
  let idx = 0
  while (idx < tokens.length) {
    const t = tokens[idx]
    if (t.kind === 'V') {
      buffer += t.text
      // mirar consonantes que siguen antes del próximo núcleo
      let cEnd = idx + 1
      while (cEnd < tokens.length && tokens[cEnd].kind === 'C') cEnd++
      const cs = tokens.slice(idx + 1, cEnd).map(x => x.text)
      const nextV = cEnd < tokens.length
      if (!nextV) {
        // final de palabra — toda la cola queda en la sílaba actual
        buffer += cs.join('')
        syllables.push(buffer); buffer = ''
        break
      }
      // decidir split del cluster
      const n = cs.length
      let splitAt = 0  // consonantes que quedan en la sílaba actual (coda)
      if (n === 0) splitAt = 0
      else if (n === 1) splitAt = 0  // V-CV
      else if (n === 2) {
        const pair = cs.join('')
        splitAt = INSEPARABLE.has(pair) ? 0 : 1  // V-CCV ó VC-CV
      } else if (n === 3) {
        const lastTwo = cs.slice(-2).join('')
        splitAt = INSEPARABLE.has(lastTwo) ? 1 : 2
      } else {
        // 4+ : poco probable en ES, dejar las últimas 2 en onset si son inseparables
        const lastTwo = cs.slice(-2).join('')
        splitAt = INSEPARABLE.has(lastTwo) ? n - 2 : n - 1
      }
      buffer += cs.slice(0, splitAt).join('')
      syllables.push(buffer); buffer = cs.slice(splitAt).join('')
      idx = cEnd
    } else {
      // consonante antes de cualquier vocal (raro, ej: consonante inicial sin V) — saltar
      buffer += t.text
      idx++
    }
  }
  if (buffer) syllables.push(buffer)
  return syllables
}

export type StressType = 'aguda' | 'llana' | 'esdrujula' | 'sobresdrujula' | null

export interface PhonemeAnalysis {
  word: string
  syllables: string[]
  syllable_count: number
  stressed_index: number
  stress_type: StressType
  stress_label: string     // etiqueta legible (ej: "llana / grave")
  has_written_accent: boolean
  vowels: string[]         // todas las vocales en orden
  consonants: string[]     // todas las consonantes (con digrafos agrupados)
  has_diphthong: boolean
  has_hiato: boolean
  disilabo: boolean        // exactamente 2 sílabas
  issues: string[]         // warnings visibles al user
}

export function classifyStress(syllableCount: number, stressedIndex: number): { type: StressType; label: string } {
  if (syllableCount === 0 || stressedIndex < 0) return { type: null, label: '—' }
  const fromEnd = syllableCount - 1 - stressedIndex
  if (fromEnd === 0) return { type: 'aguda', label: 'aguda (oxítona)' }
  if (fromEnd === 1) return { type: 'llana', label: 'llana / grave (paroxítona)' }
  if (fromEnd === 2) return { type: 'esdrujula', label: 'esdrújula (proparoxítona)' }
  return { type: 'sobresdrujula', label: 'sobresdrújula' }
}

const DIGRAPHS = ['ch', 'll', 'rr', 'qu']

export function analyze(raw: string): PhonemeAnalysis {
  const word = raw.trim().toLowerCase()
  const syllables = syllabify(word)
  const count = syllables.length
  const stressed = stressedSyllableIndex(word, syllables)
  const vowels: string[] = []
  const consonants: string[] = []

  let i = 0
  while (i < word.length) {
    const two = word.slice(i, i + 2)
    if (DIGRAPHS.includes(two)) { consonants.push(two); i += 2; continue }
    const c = word[i]
    if (isVowel(c)) vowels.push(c)
    else if (/[a-zñü]/.test(c)) consonants.push(c)
    i++
  }

  // diptongos: grupos vocálicos de 2+ letras
  let hasDiph = false
  let hasHiato = false
  for (const s of syllables) {
    const vs = [...s].filter(isVowel)
    if (vs.length >= 2) hasDiph = true
  }
  // hiato = más sílabas que lo que tendrían si todo fuera diptongo
  const rawVowelGroups = (word.match(/[aáeéiíoóuúü]+/g) ?? []).length
  if (count > rawVowelGroups) hasHiato = true
  if (count > 0 && rawVowelGroups < count) hasHiato = true

  const issues: string[] = []
  if (!word) issues.push('palabra vacía')
  else {
    if (count === 0) issues.push('no se detectaron vocales')
    if (/[^a-záéíóúüñ\s-]/.test(word)) issues.push('contiene caracteres no alfabéticos')
    if (count !== 2) issues.push(`tiene ${count} sílaba${count === 1 ? '' : 's'} (no es disílabo)`)
  }

  const { type: stressType, label: stressLabel } = classifyStress(count, stressed)
  const hasWrittenAccent = [...word].some(isAccented)

  return {
    word,
    syllables,
    syllable_count: count,
    stressed_index: stressed,
    stress_type: stressType,
    stress_label: stressLabel,
    has_written_accent: hasWrittenAccent,
    vowels,
    consonants,
    has_diphthong: hasDiph,
    has_hiato: hasHiato,
    disilabo: count === 2,
    issues,
  }
}

// util opcional
export function stripAccents(s: string): string {
  return s.split('').map(stripDiacritic).join('')
}

// ============================================================================
// Clasificación articulatoria (ES neutro LatAm / peninsular)
// ============================================================================

export type Manner = 'oclusiva' | 'fricativa' | 'africada' | 'nasal' | 'lateral' | 'vibrante_simple' | 'vibrante_multiple' | 'aproximante'
export type Place = 'bilabial' | 'labiodental' | 'dental_alveolar' | 'palatal' | 'velar' | 'glotal'

export interface ConsonantFeatures {
  manner: Manner
  place: Place
  voiced: boolean
}

/** Clasifica consonante española. `nextChar` para desambiguar c/g según vocal siguiente. */
export function classifyConsonant(letter: string, nextChar?: string): ConsonantFeatures | null {
  const l = letter.toLowerCase()
  const next = nextChar?.toLowerCase() ?? ''
  const nextIsPalVowel = next === 'e' || next === 'é' || next === 'i' || next === 'í'

  switch (l) {
    case 'p': return { manner: 'oclusiva', place: 'bilabial', voiced: false }
    case 'b':
    case 'v': return { manner: 'oclusiva', place: 'bilabial', voiced: true }
    case 't': return { manner: 'oclusiva', place: 'dental_alveolar', voiced: false }
    case 'd': return { manner: 'oclusiva', place: 'dental_alveolar', voiced: true }
    case 'k': return { manner: 'oclusiva', place: 'velar', voiced: false }
    case 'c':
      // c + e/i = fricativa (/s/ o /θ/), c + a/o/u = oclusiva velar /k/
      return nextIsPalVowel
        ? { manner: 'fricativa', place: 'dental_alveolar', voiced: false }
        : { manner: 'oclusiva', place: 'velar', voiced: false }
    case 'qu': return { manner: 'oclusiva', place: 'velar', voiced: false }
    case 'g':
      // g + e/i = fricativa velar /x/; g + a/o/u = oclusiva velar /g/
      return nextIsPalVowel
        ? { manner: 'fricativa', place: 'velar', voiced: false }
        : { manner: 'oclusiva', place: 'velar', voiced: true }
    case 'f': return { manner: 'fricativa', place: 'labiodental', voiced: false }
    case 's': return { manner: 'fricativa', place: 'dental_alveolar', voiced: false }
    case 'z': return { manner: 'fricativa', place: 'dental_alveolar', voiced: false }
    case 'j': return { manner: 'fricativa', place: 'velar', voiced: false }
    case 'x': return { manner: 'fricativa', place: 'velar', voiced: false }
    case 'h': return null // muda en ES
    case 'ch': return { manner: 'africada', place: 'palatal', voiced: false }
    case 'm': return { manner: 'nasal', place: 'bilabial', voiced: true }
    case 'n': return { manner: 'nasal', place: 'dental_alveolar', voiced: true }
    case 'ñ': return { manner: 'nasal', place: 'palatal', voiced: true }
    case 'l': return { manner: 'lateral', place: 'dental_alveolar', voiced: true }
    case 'll': return { manner: 'aproximante', place: 'palatal', voiced: true } // yeísmo predominante
    case 'r': return { manner: 'vibrante_simple', place: 'dental_alveolar', voiced: true }
    case 'rr': return { manner: 'vibrante_multiple', place: 'dental_alveolar', voiced: true }
    case 'y': return { manner: 'aproximante', place: 'palatal', voiced: true }
    case 'w': return { manner: 'aproximante', place: 'velar', voiced: true }
    default: return null
  }
}

export const MANNER_LABELS: Record<Manner, string> = {
  oclusiva: 'oclusivas',
  fricativa: 'fricativas',
  africada: 'africadas',
  nasal: 'nasales',
  lateral: 'laterales',
  vibrante_simple: 'vibrante ˉr',
  vibrante_multiple: 'vibrante rr',
  aproximante: 'aproximantes',
}
export const PLACE_LABELS: Record<Place, string> = {
  bilabial: 'bilabial',
  labiodental: 'labiodental',
  dental_alveolar: 'dental/alveolar',
  palatal: 'palatal',
  velar: 'velar',
  glotal: 'glotal',
}

/** Separa consonantes por posición en sílaba: onset (antes de vocal) vs coda (después). */
export function splitOnsetCoda(syllable: string): { onset: string[]; coda: string[] } {
  // tokenizar digrafos + letras
  const tokens: string[] = []
  let i = 0
  while (i < syllable.length) {
    const two = syllable.slice(i, i + 2).toLowerCase()
    if (two === 'ch' || two === 'll' || two === 'rr' || two === 'qu') { tokens.push(two); i += 2; continue }
    tokens.push(syllable[i].toLowerCase()); i++
  }
  const onset: string[] = []
  const coda: string[] = []
  let seenVowel = false
  for (const t of tokens) {
    const isV = t.length === 1 && isVowel(t)
    if (!seenVowel) {
      if (isV) seenVowel = true
      else onset.push(t)
    } else {
      if (!isV) coda.push(t)
    }
  }
  return { onset, coda }
}

export interface ArticulatoryStats {
  manner: Record<Manner, number>
  place: Record<Place, number>
  voiced: number
  voiceless: number
  onset_count: number
  coda_count: number
  open_syllables: number  // sílabas CV sin coda
  closed_syllables: number  // sílabas con coda
  total_consonants: number
}

/**
 * Score de balance vs distribución esperada usando chi-cuadrado normalizado.
 * Entrada: observed counts (no %) y expected % (suma ≈ 100).
 * Salida: 0–100 (100 = calce perfecto). Penaliza más las desviaciones relativas que Σ|diff|.
 * No es un test estadístico válido (los tokens no son independientes), pero ordena bien
 * para UX: celdas con expected bajo y muchos observados pesan más.
 */
export function chiSquareScore(observed: Record<string, number>, expectedPct: Record<string, number>, totalObs: number): number {
  if (totalObs <= 0) return 0
  let chi2 = 0
  let dfRef = 0
  for (const [k, expPct] of Object.entries(expectedPct)) {
    const eCount = (expPct / 100) * totalObs
    if (eCount < 0.5) continue  // evita división por ~0
    const o = observed[k] ?? 0
    chi2 += Math.pow(o - eCount, 2) / eCount
    dfRef++
  }
  // normaliza por gl para que distintos vocabularios sean comparables
  const df = Math.max(1, dfRef - 1)
  const normalized = chi2 / df
  // mapea a 0-100 con exp decay: score=100 si chi2/df=0, ~50 si chi2/df≈1, ~10 si ≈3
  const score = 100 * Math.exp(-normalized)
  return Math.max(0, Math.min(100, score))
}

// ============================================================================
// Pares mínimos (ES) — útil para listas de discriminación tipo PALPA
// ============================================================================

export type MinimalPairContrast =
  | 'voicing'            // p/b, t/d, k/g, s/z
  | 'manner'             // cambio de modo (ej. p/f, t/s)
  | 'place'              // cambio de punto (ej. p/t, m/n)
  | 'nasal_oral'         // m/b, n/d
  | 'vowel'              // cambio de vocal
  | 'rhotic'             // r/rr
  | 'other'

export interface MinimalPair {
  a: string
  b: string
  contrast: MinimalPairContrast
  position: number       // índice de la letra que difiere (aprox)
}

/** Detecta pares mínimos por edit-distance 1 (misma longitud, una posición distinta). */
export function findMinimalPairs(tokens: string[]): MinimalPair[] {
  const pairs: MinimalPair[] = []
  const norm = tokens.map(t => t.trim().toLowerCase()).filter(Boolean)
  for (let i = 0; i < norm.length; i++) {
    for (let j = i + 1; j < norm.length; j++) {
      const a = norm[i], b = norm[j]
      if (a.length !== b.length) continue
      let diffs = 0
      let pos = -1
      for (let k = 0; k < a.length; k++) {
        if (a[k] !== b[k]) { diffs++; pos = k; if (diffs > 1) break }
      }
      if (diffs !== 1) continue
      const ca = a[pos], cb = b[pos]
      pairs.push({ a, b, contrast: classifyContrast(ca, cb, a, b, pos), position: pos })
    }
  }
  return pairs
}

function classifyContrast(ca: string, cb: string, a: string, b: string, pos: number): MinimalPairContrast {
  if (isVowel(ca) && isVowel(cb)) return 'vowel'
  // para c/g necesitamos contexto (vocal siguiente)
  const fa = classifyConsonant(ca, a[pos + 1])
  const fb = classifyConsonant(cb, b[pos + 1])
  if (!fa || !fb) return 'other'
  // r/rr — heurística: si uno de los dos son vibrantes distintas
  if ((fa.manner === 'vibrante_simple' && fb.manner === 'vibrante_multiple') ||
      (fa.manner === 'vibrante_multiple' && fb.manner === 'vibrante_simple')) return 'rhotic'
  // nasal vs oral (no-nasal)
  if ((fa.manner === 'nasal') !== (fb.manner === 'nasal')) return 'nasal_oral'
  // voicing puro: mismo manner + mismo place + distinto voiced
  if (fa.manner === fb.manner && fa.place === fb.place && fa.voiced !== fb.voiced) return 'voicing'
  // manner distinto
  if (fa.manner !== fb.manner) return 'manner'
  // place distinto (mismo manner)
  if (fa.place !== fb.place) return 'place'
  return 'other'
}

export const CONTRAST_LABELS: Record<MinimalPairContrast, string> = {
  voicing: 'sordo/sonoro',
  manner: 'modo articulatorio',
  place: 'punto articulatorio',
  nasal_oral: 'nasal/oral',
  vowel: 'vocal',
  rhotic: 'r/rr',
  other: 'otro',
}

export function articulatoryStats(tokens: string[]): ArticulatoryStats {
  const manner: Record<Manner, number> = {
    oclusiva: 0, fricativa: 0, africada: 0, nasal: 0, lateral: 0,
    vibrante_simple: 0, vibrante_multiple: 0, aproximante: 0,
  }
  const place: Record<Place, number> = {
    bilabial: 0, labiodental: 0, dental_alveolar: 0, palatal: 0, velar: 0, glotal: 0,
  }
  let voiced = 0, voiceless = 0
  let onsetCount = 0, codaCount = 0
  let openSyl = 0, closedSyl = 0
  let total = 0
  for (const token of tokens) {
    const a = analyze(token)
    const word = token.toLowerCase()
    for (let si = 0; si < a.syllables.length; si++) {
      const syl = a.syllables[si]
      const { onset, coda } = splitOnsetCoda(syl)
      if (coda.length > 0) closedSyl++
      else openSyl++
      onsetCount += onset.length
      codaCount += coda.length
      const classifyList = (list: string[]) => {
        for (let ci = 0; ci < list.length; ci++) {
          const c = list[ci]
          // para c/g necesitamos próxima letra en la sílaba para desambiguar
          const idx = syl.indexOf(c)
          const nc = idx >= 0 ? syl[idx + c.length] : undefined
          const f = classifyConsonant(c, nc)
          if (!f) continue
          manner[f.manner]++
          place[f.place]++
          if (f.voiced) voiced++; else voiceless++
          total++
        }
      }
      classifyList(onset)
      classifyList(coda)
    }
    // evita warning de unused
    void word
  }
  return { manner, place, voiced, voiceless, onset_count: onsetCount, coda_count: codaCount, open_syllables: openSyl, closed_syllables: closedSyl, total_consonants: total }
}
