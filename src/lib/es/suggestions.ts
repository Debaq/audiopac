/**
 * Sugerencias léxicas para corregir desbalances por clase articulatoria.
 * Léxico ES neutro LatAm, palabras familiares de uso común (2-3 sílabas).
 */

import type { Manner, Place } from './phonetics'
import { MANNER_LABELS, PLACE_LABELS } from './phonetics'
import type { ArticulatoryStats } from './phonetics'

// ejemplos canónicos por clase. Priorizamos bisílabos/trisílabos familiares.
const MANNER_EXAMPLES: Record<Manner, string[]> = {
  oclusiva: ['pato', 'toco', 'bote', 'dado', 'gato', 'cuco'],
  fricativa: ['jota', 'joya', 'jugo', 'sopa', 'foca', 'zorro'],
  africada: ['chico', 'chapa', 'chino', 'ocho', 'lucha', 'hacha'],
  nasal: ['mano', 'niño', 'ñame', 'cama', 'mano', 'nena'],
  lateral: ['pala', 'lana', 'lila', 'cola', 'luna'],
  vibrante_simple: ['pero', 'cara', 'oro', 'aro', 'pera'],
  vibrante_multiple: ['carro', 'perro', 'torre', 'rata', 'rosa'],
  aproximante: ['yema', 'yoga', 'llave', 'yo-yo', 'mayo'],
}

const PLACE_EXAMPLES: Record<Place, string[]> = {
  bilabial: ['pato', 'bote', 'mano', 'pipa', 'bobo'],
  labiodental: ['foca', 'foco', 'fama', 'fila', 'café'],
  dental_alveolar: ['toco', 'dado', 'sopa', 'lana', 'ratón'],
  palatal: ['chico', 'niño', 'llave', 'yema', 'hacha'],
  velar: ['gato', 'jota', 'cuco', 'jugo', 'coco'],
  glotal: [],
}

export interface BalanceSuggestion {
  severity: 'info' | 'warn'
  category: 'manner' | 'place' | 'structure' | 'voicing'
  key: string         // ej. 'fricativa'
  label: string       // ej. 'fricativas'
  direction: 'under' | 'over'
  diff: number        // observado - esperado (puntos %)
  examples: string[]  // palabras sugeridas (sólo relevantes cuando direction=under)
  text: string        // mensaje listo para UI
}

interface GenInput {
  stats: ArticulatoryStats
  expectedManner: Record<Manner, number>
  expectedPlace: Record<Place, number>
  expectedOpenPct: number
  /** umbral en puntos % de diff absoluto para emitir sugerencia */
  threshold?: number
}

export function generateSuggestions({ stats, expectedManner, expectedPlace, expectedOpenPct, threshold = 4 }: GenInput): BalanceSuggestion[] {
  const out: BalanceSuggestion[] = []
  const total = stats.total_consonants
  if (total === 0) return out

  // Manner
  for (const k of Object.keys(expectedManner) as Manner[]) {
    const obs = (stats.manner[k] / total) * 100
    const exp = expectedManner[k]
    const diff = obs - exp
    if (Math.abs(diff) < threshold) continue
    const direction = diff < 0 ? 'under' : 'over'
    const label = MANNER_LABELS[k]
    const examples = direction === 'under' ? MANNER_EXAMPLES[k] : []
    out.push({
      severity: Math.abs(diff) > threshold * 2 ? 'warn' : 'info',
      category: 'manner',
      key: k,
      label,
      direction,
      diff,
      examples,
      text: direction === 'under'
        ? `Faltan ${label} (${diff.toFixed(1)} pts). Agregá: ${examples.slice(0, 3).join(', ')}.`
        : `Exceso de ${label} (+${diff.toFixed(1)} pts). Considerá reemplazar algunas.`,
    })
  }

  // Place
  for (const k of Object.keys(expectedPlace) as Place[]) {
    const exp = expectedPlace[k]
    if (exp === 0) continue
    const obs = (stats.place[k] / total) * 100
    const diff = obs - exp
    if (Math.abs(diff) < threshold) continue
    const direction = diff < 0 ? 'under' : 'over'
    const label = PLACE_LABELS[k]
    const examples = direction === 'under' ? PLACE_EXAMPLES[k] : []
    out.push({
      severity: Math.abs(diff) > threshold * 2 ? 'warn' : 'info',
      category: 'place',
      key: k,
      label,
      direction,
      diff,
      examples,
      text: direction === 'under'
        ? `Faltan consonantes ${label} (${diff.toFixed(1)} pts). Agregá: ${examples.slice(0, 3).join(', ')}.`
        : `Exceso ${label} (+${diff.toFixed(1)} pts).`,
    })
  }

  // Estructura silábica
  const totSyl = stats.open_syllables + stats.closed_syllables
  if (totSyl > 0) {
    const openPct = (stats.open_syllables / totSyl) * 100
    const diff = openPct - expectedOpenPct
    if (Math.abs(diff) > 10) {
      const direction = diff < 0 ? 'under' : 'over'
      out.push({
        severity: Math.abs(diff) > 20 ? 'warn' : 'info',
        category: 'structure',
        key: 'open_syllables',
        label: 'sílabas abiertas (CV)',
        direction,
        diff,
        examples: direction === 'under' ? ['casa', 'mesa', 'pato', 'dedo', 'bola'] : ['carta', 'puerto', 'falso', 'tiempo', 'cinco'],
        text: direction === 'under'
          ? `Pocas sílabas abiertas (${openPct.toFixed(0)}% vs ${expectedOpenPct}% esperado). Agregá palabras CV.CV: casa, mesa, pato.`
          : `Demasiadas sílabas abiertas (${openPct.toFixed(0)}% vs ${expectedOpenPct}% esperado). Incluí palabras con coda: carta, puerto, cinco.`,
      })
    }
  }

  // Sonoridad: rango ES ~55-65% voiced. Si se va de 40-75 es llamativo.
  if (total > 0) {
    const voicedPct = (stats.voiced / total) * 100
    if (voicedPct < 40 || voicedPct > 75) {
      const direction = voicedPct < 40 ? 'under' : 'over'
      out.push({
        severity: 'warn',
        category: 'voicing',
        key: 'voicing',
        label: 'consonantes sonoras',
        direction,
        diff: voicedPct - 58,
        examples: direction === 'under' ? ['mano', 'ronda', 'bola', 'nido', 'gol'] : ['taza', 'foco', 'chico', 'paso', 'sopa'],
        text: direction === 'under'
          ? `Pocas sonoras (${voicedPct.toFixed(0)}%). Agregá /m/ /n/ /l/ /r/ /b/d/g/.`
          : `Exceso de sonoras (${voicedPct.toFixed(0)}%). Sumá /p/ /t/ /k/ /f/ /s/ /ch/.`,
      })
    }
  }

  // Ordena: warn primero, luego por |diff| desc
  out.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'warn' ? -1 : 1
    return Math.abs(b.diff) - Math.abs(a.diff)
  })
  return out
}
