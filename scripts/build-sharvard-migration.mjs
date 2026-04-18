#!/usr/bin/env node
// Genera migración SQL seed Sharvard 700 frases + keywords desde
// sharvard/lists-phonemic-SAMPA.txt (formato: code|ortho_uppercase_keys|SAMPA).
// Uso: node scripts/build-sharvard-migration.mjs > src-tauri/migrations/017_seed_sharvard.sql
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve('sharvard/lists-phonemic-SAMPA.txt')
const raw = fs.readFileSync(SRC, 'utf8')
const lines = raw.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('sent|'))

function isAllUpper(token) {
  // Token fully uppercase (≥2 letras), admite acentos y Ñ
  const letters = token.match(/\p{L}/gu) ?? []
  if (letters.length < 2) return false
  return letters.every(c => c === c.toUpperCase() && c !== c.toLowerCase())
}

function stripEdgePunct(w) {
  return w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

function normalizeKey(w) {
  return w.toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function sqlEsc(s) { return s.replace(/'/g, "''") }

// Parsear
const entries = []
for (const line of lines) {
  const parts = line.split('|')
  if (parts.length < 2) continue
  const [code, ortho] = parts
  const words = ortho.trim().split(/\s+/)
  const keywords = []
  const cleanWords = words.map(w => {
    const core = stripEdgePunct(w)
    if (isAllUpper(core)) {
      keywords.push(normalizeKey(core))
      // Lowercase preservando acentos
      const lower = core.toLowerCase()
      return w.replace(core, lower)
    }
    return w
  })
  let sentence = cleanWords.join(' ')
  // Capitalizar primera letra alfabética
  sentence = sentence.replace(/^(\P{L}*)(\p{L})/u, (_, pre, c) => pre + c.toUpperCase())
  // Terminar con punto si no tiene
  if (!/[.!?]$/.test(sentence.trim())) sentence = sentence.trim() + '.'
  entries.push({ code, sentence, keywords })
}

if (entries.length !== 700) {
  console.error(`// Aviso: se esperaban 700 entradas, parseadas ${entries.length}`)
}

// Emitir SQL: 70 listas × 10 frases
const out = []
out.push('-- Fase 4: seed Sharvard 700 frases peninsular ES (Aubanel et al. 2014, Zenodo 3547446)')
out.push('-- 70 listas × 10 frases balanceadas fonémicamente, 5 keywords por frase (uppercase en fuente).')
out.push('-- Audio Sharvard original NO incluido (265 MB). Descarga aparte: zenodo.org/records/3547446')
out.push('-- Usuario graba audios propios en /estimulos o descarga pack desde repo assets (futuro).')
out.push('')

for (let i = 0; i < 70; i++) {
  const listNum = String(i + 1).padStart(2, '0')
  const code = `SHARVARD_ES_L${listNum}`
  const name = `Sharvard ES Lista ${i + 1}`
  const desc = `Lista ${i + 1}/70 del corpus Sharvard (peninsular ES). 10 frases balanceadas fonémicamente, 5 palabras clave por frase.`
  out.push(`INSERT INTO stimulus_lists (code, name, category, language, country_code, description, is_standard) VALUES`)
  out.push(`  ('${code}', '${sqlEsc(name)}', 'sentence', 'es', NULL, '${sqlEsc(desc)}', 1);`)
}
out.push('')

for (let i = 0; i < 70; i++) {
  const listNum = String(i + 1).padStart(2, '0')
  const code = `SHARVARD_ES_L${listNum}`
  const slice = entries.slice(i * 10, i * 10 + 10)
  out.push(`-- ${code}`)
  const values = slice.map((e, idx) => {
    const pos = idx + 1
    const kwJson = JSON.stringify(e.keywords)
    return `  SELECT id, ${pos}, '${sqlEsc(e.sentence)}', '${sqlEsc(kwJson)}' FROM stimulus_lists WHERE code='${code}'`
  }).join('\n  UNION ALL\n')
  out.push(`INSERT INTO stimuli (list_id, position, token, keywords_json)`)
  out.push(values + ';')
  out.push('')
}

// Plantilla test que use Sharvard L01 por default (usuario puede cambiar)
out.push(`-- Plantilla HINT apuntando a Sharvard L01 (usuario puede clonar y cambiar lista)`)
out.push(`INSERT OR IGNORE INTO test_templates (code, name, test_type, description, is_standard, config_json) VALUES`)
out.push(`  ('HINT_SHARVARD_L01', 'HINT-ES Sharvard Lista 1', 'CUSTOM',`)
out.push(`   'SRT-SNR adaptativo con Sharvard Lista 1 (10 frases peninsular ES). Clona la plantilla para usar otra lista (L01–L70). Requiere audios grabados o pack Sharvard.',`)
out.push(`   1,`)
out.push(`   '{"tones":{},"isi_ms":0,"iri_ms":0,"envelope_ms":0,"pattern_length":0,"practice_sequences":[],"test_sequences":[],"channel":"binaural","level_db":65,"hint":{"stimulus_list_code":"SHARVARD_ES_L01","start_snr_db":5,"noise_level_db":60,"noise_type":"pink","sentences_per_level":4,"threshold_pass_ratio":0.5,"step_down_db":4,"step_up_db":2,"min_snr_db":-10,"max_snr_db":20,"max_total_trials":30}}');`)

process.stdout.write(out.join('\n') + '\n')
