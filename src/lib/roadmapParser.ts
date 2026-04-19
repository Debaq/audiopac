// Parser específico para docs/ROADMAP_PAC.md — extrae árbol de secciones con
// slugs estables, status (emoji) y conteos recursivos. Ver §8.7.1.

export type RoadmapStatus = 'done' | 'in_progress' | 'pending' | 'partial' | 'blocked' | 'unknown'

export interface RoadmapCounts {
  done: number
  pending: number
  partial: number
  blocked: number
  inProgress: number
  total: number
}

export interface RoadmapSection {
  id: string
  level: number
  title: string
  rawTitle: string
  status: RoadmapStatus
  startLine: number
  endLine: number
  body: string
  children: RoadmapSection[]
  /** Bullets `- ✅/📝/...` en el cuerpo propio (antes del primer child). */
  ownBullets: RoadmapCounts
  /** Agregado: ownBullets + suma recursiva de children + status de cada child como ítem. */
  counts: RoadmapCounts
}

export interface RoadmapParseResult {
  sections: RoadmapSection[]
  all: RoadmapSection[]
  slugToSection: Map<string, RoadmapSection>
}

export function slugify(s: string): string {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const STATUS_EMOJIS: Array<{ re: RegExp; status: Exclude<RoadmapStatus, 'unknown'> }> = [
  { re: /✅/, status: 'done' },
  { re: /🚧/, status: 'in_progress' },
  { re: /⚠️|⚠/, status: 'partial' },
  { re: /❌/, status: 'blocked' },
  { re: /📝/, status: 'pending' },
]

function detectStatus(text: string): RoadmapStatus {
  for (const { re, status } of STATUS_EMOJIS) if (re.test(text)) return status
  return 'unknown'
}

function stripStatusEmoji(text: string): string {
  let out = text
  for (const { re } of STATUS_EMOJIS) out = out.replace(re, '')
  return out.replace(/\s+/g, ' ').trim()
}

function emptyCounts(): RoadmapCounts {
  return { done: 0, pending: 0, partial: 0, blocked: 0, inProgress: 0, total: 0 }
}

function bump(c: RoadmapCounts, st: RoadmapStatus) {
  switch (st) {
    case 'done': c.done++; break
    case 'pending': c.pending++; break
    case 'partial': c.partial++; break
    case 'blocked': c.blocked++; break
    case 'in_progress': c.inProgress++; break
    default: return
  }
  c.total++
}

function countBullets(lines: string[]): RoadmapCounts {
  const c = emptyCounts()
  let inCode = false
  for (const l of lines) {
    if (l.startsWith('```')) { inCode = !inCode; continue }
    if (inCode) continue
    // Bullet: `- ` o `* ` opcionalmente con sangría. Aceptar también `- [x]` GFM.
    const m = /^\s*[-*]\s+(\[(?:\s|x|X)\]\s+)?(.*)$/.exec(l)
    if (!m) continue
    const taskBox = m[1]
    const rest = m[2]
    let st: RoadmapStatus = 'unknown'
    if (taskBox) {
      st = /[xX]/.test(taskBox) ? 'done' : 'pending'
    } else {
      // Solo emojis al INICIO del bullet (primeros 3 chars), no en medio.
      const head = rest.slice(0, 6)
      st = detectStatus(head)
    }
    if (st !== 'unknown') bump(c, st)
  }
  return c
}

export function parseRoadmap(md: string): RoadmapParseResult {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const flat: RoadmapSection[] = []
  const slugSeen = new Map<string, number>()

  // 1) Localizar todos los headings h2+
  let inCodeBlock = false
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (l.startsWith('```')) { inCodeBlock = !inCodeBlock; continue }
    if (inCodeBlock) continue
    const m = /^(#{2,4})\s+(.*)$/.exec(l)
    if (!m) continue
    const level = m[1].length
    const rawTitle = m[2].trim()
    const title = stripStatusEmoji(rawTitle)
    const base = slugify(title) || 'section'
    const seen = slugSeen.get(base) ?? 0
    slugSeen.set(base, seen + 1)
    const id = seen === 0 ? base : `${base}-${seen + 1}`
    flat.push({
      id, level, title, rawTitle,
      status: detectStatus(rawTitle),
      startLine: i, endLine: lines.length,
      body: '', children: [],
      ownBullets: emptyCounts(),
      counts: emptyCounts(),
    })
  }

  // 2) endLine + body + ownBullets (solo cuerpo propio, antes del primer child)
  for (let k = 0; k < flat.length; k++) {
    const s = flat[k]
    let end = lines.length
    let firstChildLine = end
    for (let j = k + 1; j < flat.length; j++) {
      if (flat[j].level <= s.level) { end = flat[j].startLine; break }
    }
    for (let j = k + 1; j < flat.length; j++) {
      if (flat[j].startLine >= end) break
      if (flat[j].level > s.level) { firstChildLine = flat[j].startLine; break }
    }
    s.endLine = end
    s.body = lines.slice(s.startLine + 1, end).join('\n')
    const ownLines = lines.slice(s.startLine + 1, Math.min(firstChildLine, end))
    s.ownBullets = countBullets(ownLines)

    // status fallback: si heading no tenía emoji, mirar primer bullet con emoji.
    if (s.status === 'unknown') {
      for (const bl of ownLines) {
        if (/^\s*[-*]\s/.test(bl)) {
          const head = bl.replace(/^\s*[-*]\s+(\[[^\]]+\]\s*)?/, '').slice(0, 6)
          const st = detectStatus(head)
          if (st !== 'unknown') { s.status = st; break }
        }
      }
    }
  }

  // 3) Árbol
  const roots: RoadmapSection[] = []
  const stack: RoadmapSection[] = []
  for (const s of flat) {
    while (stack.length && stack[stack.length - 1].level >= s.level) stack.pop()
    if (stack.length === 0) roots.push(s)
    else stack[stack.length - 1].children.push(s)
    stack.push(s)
  }

  // 4) Conteos: agregado = ownBullets + suma(children.counts) + bump(child.status)
  function compute(s: RoadmapSection) {
    s.counts = { ...s.ownBullets }
    for (const ch of s.children) {
      compute(ch)
      s.counts.done += ch.counts.done
      s.counts.pending += ch.counts.pending
      s.counts.partial += ch.counts.partial
      s.counts.blocked += ch.counts.blocked
      s.counts.inProgress += ch.counts.inProgress
      s.counts.total += ch.counts.total
      bump(s.counts, ch.status)
    }
  }
  for (const r of roots) compute(r)

  const slugToSection = new Map<string, RoadmapSection>()
  for (const s of flat) slugToSection.set(s.id, s)

  return { sections: roots, all: flat, slugToSection }
}

export function globalStats(result: RoadmapParseResult): RoadmapCounts {
  const c = emptyCounts()
  for (const r of result.sections) {
    c.done += r.counts.done
    c.pending += r.counts.pending
    c.partial += r.counts.partial
    c.blocked += r.counts.blocked
    c.inProgress += r.counts.inProgress
    c.total += r.counts.total
    bump(c, r.status)
  }
  return c
}

export const STATUS_META: Record<RoadmapStatus, { emoji: string; label: string; color: string }> = {
  done: { emoji: '✅', label: 'Hecho', color: 'emerald' },
  in_progress: { emoji: '🚧', label: 'En curso', color: 'sky' },
  pending: { emoji: '📝', label: 'Pendiente', color: 'amber' },
  partial: { emoji: '⚠️', label: 'Parcial', color: 'orange' },
  blocked: { emoji: '❌', label: 'Bloqueado', color: 'red' },
  unknown: { emoji: '·', label: 'Sin estado', color: 'neutral' },
}
