#!/usr/bin/env node
// Genera /home/nick/Escritorio/Proyectos/audiopac-assets/packs/hint-es-clinico-v1.json
// 70 tests HINT_SHARVARD_L01..L70 apuntando a las listas Sharvard.
//
// Uso: node scripts/build-hint-es-clinico-pack.mjs

import { createHash } from 'node:crypto'
import { writeFileSync, readFileSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ASSETS = resolve(__dirname, '../../audiopac-assets')
const OUT = resolve(ASSETS, 'packs/hint-es-clinico-v1.json')
const INDEX = resolve(ASSETS, 'index.json')

const pad = n => String(n).padStart(2, '0')

const COMMON_REFS = [
  {
    citation: 'Aubanel V, García Lecumberri ML, Cooke M. The Sharvard Corpus: A phonemically-balanced Spanish sentence resource for audiology',
    year: 2014,
    doi: '10.3109/14992027.2014.907507',
  },
  {
    citation: 'Nilsson M, Soli SD, Sullivan JA. Development of the Hearing in Noise Test',
    year: 1994,
  },
  {
    citation: 'Soli SD, Wong LL. Assessment of speech intelligibility in noise with the Hearing in Noise Test. Int J Audiol 47(6):356-361',
    year: 2008,
  },
  {
    citation: 'Hall JW III. Introduction to Audiology Today. Pearson. (Caps. sobre speech-in-noise testing y test-retest)',
    year: 2014,
  },
]

const purposeMd = (lid) => `Cuantificar el **SRT-SNR** con la **lista L${lid}** del corpus **Sharvard ES** (Aubanel et al. 2014), fonémicamente equivalente a las otras 69 listas (±1 dB test-retest). Uso clínico: evaluación longitudinal sin efecto aprendizaje, comparación pre/post audífono o implante, estudios multicéntricos con normativos publicados.`

const howItWorksMd = (lid) => `Paradigma HINT adaptativo (Nilsson 1994) con bracketing Hughson-Westlake modificado:\n\n- **Lista L${lid}**: 10 frases Sharvard, 5 palabras clave por frase (50 keywords totales).\n- Ruido rosa 60 dB SPL continuo binaural.\n- SNR inicial **+5 dB**, step-down **4 dB** tras pasar, step-up **2 dB** tras fallar.\n- Criterio de paso: ≥50% keywords correctas por nivel (≥2/5 por frase promediadas sobre 4 frases).\n- Convergencia típica en 15–20 frases; máx 30 trials.\n\nLas listas son intercambiables: L${lid} es estadísticamente equivalente a cualquier otra (L01..L70) sobre un mismo paciente, lo que permite promediar SRT entre varias listas o alternar en re-tests.`

const protocolMd = (lid) => `1. **Instalación previa** (una sola vez):\n   - Desde \`/catalogos\`: catálogo **Sharvard ES** (texto + keywords para las 70 listas).\n   - Descargar pack de audio: voz F (femenina) o M (masculina) — release \`sharvard-audio-v1\`, ~130 MB c/u.\n   - Verificar los 700 WAV procesados en \`stimuli/\` con RMS normalizado a −20 dBFS.\n2. **Calibración** SPL vigente; idealmente calibración del ruido rosa por separado.\n3. Auriculares supraaurales (validado con Sennheiser HDA200 o equivalentes).\n4. Instrucción al paciente: *«Va a escuchar frases sobre un ruido de fondo. Repita cada frase completa. Si solo entendió algunas palabras, **dígamelas igual** — no se quede callado»*.\n5. 2 frases de práctica a SNR +10 dB con otra lista (p.ej. L${lid === '01' ? '02' : '01'}) para evitar aprender L${lid} antes del test real.\n6. Test: 10–30 frases adaptativas en **L${lid}**.\n7. Reportar **SRT-SNR en dB** + desvío típico de los últimos 6 trials.\n8. Para test-retest/seguimiento, usar una lista distinta (nunca repetir L${lid} en la misma semana — genera sesgo de memoria). Criterio clínico: Δ ≥ 2 dB entre mediciones es significativo.`

const targetPopulationMd = `- **Adultos hispanohablantes** (ideal peninsular, aceptable LatAm con advertencia dialectal).\n- Evaluación de beneficio audioprotésico (pre/post adaptación).\n- Pre/post implante coclear.\n- Seguimiento longitudinal con listas equivalentes.\n- Investigación clínica con normativos publicados.\n- Comparación multicéntrica.`

const contraindicationsMd = `- **Catálogo Sharvard o pack de audio no instalados** (el test falla si faltan los WAV).\n- Hipoacusia profunda (>70 dB HL PTA) — piso del SNR no alcanza inteligibilidad.\n- Hablantes de variantes muy distintas al castellano (portugués, gallego, catalán monolingüe).\n- Niños: corpus validado en adultos 18+ únicamente.`

const tests = []
for (let i = 1; i <= 70; i++) {
  const lid = pad(i)
  tests.push({
    code: `HINT_SHARVARD_L${lid}`,
    name: `HINT-ES Sharvard Lista ${lid}`,
    test_type: 'CUSTOM',
    description: `SRT-SNR adaptativo con Sharvard L${lid} (10 frases peninsular ES). Requiere catálogo Sharvard ES + pack audio instalados desde /catalogos.`,
    config_json: {
      tones: {}, isi_ms: 0, iri_ms: 0, envelope_ms: 0, pattern_length: 0,
      practice_sequences: [], test_sequences: [],
      channel: 'binaural', level_db: 65,
      hint: {
        stimulus_list_code: `SHARVARD_ES_L${lid}`,
        start_snr_db: 5,
        noise_level_db: 60,
        noise_type: 'pink',
        sentences_per_level: 4,
        threshold_pass_ratio: 0.5,
        step_down_db: 4,
        step_up_db: 2,
        min_snr_db: -10,
        max_snr_db: 20,
        max_total_trials: 30,
      },
    },
    is_standard: 1,
    family: 'hint',
    purpose_md: purposeMd(lid),
    how_it_works_md: howItWorksMd(lid),
    protocol_md: protocolMd(lid),
    target_population_md: targetPopulationMd,
    contraindications_md: contraindicationsMd,
    estimated_duration_min: 8,
    min_age_years: 18,
    references: COMMON_REFS,
  })
}

const manifest = {
  id: 'hint-es-clinico-v1',
  version: '1.2.0',
  name: 'HINT-ES Clínico (Sharvard L01-L70)',
  category: 'hint',
  description_md: `# HINT-ES Clínico (Sharvard 70 listas)\n\nBateria completa de HINT adaptativo en ruido con el corpus **Sharvard ES peninsular** (Aubanel et al. 2014): 70 listas × 10 frases fonémicamente balanceadas, 5 palabras clave por frase. Un test por lista (L01-L70) para evaluación longitudinal, test-retest en sesiones distintas y evitar efecto aprendizaje.\n\n## Diferencia con \`sharvard-es-v1\`\n\n- \`sharvard-es-v1\`: solo lista L01 como template a clonar (simple).\n- \`hint-es-clinico-v1\`: **70 tests predefinidos**, elegís en \`/tests\` la lista directamente sin clonar.\n\n## Requerimientos\n\n1. Instalar catálogo **Sharvard ES** desde \`/catalogos\` (texto 70 listas)\n2. Descargar pack audio (voz F o M, ~130 MB) del mismo catálogo\n3. Instalar este pack\n\n## Procedimiento\n\n- Voz + ruido rosa, SRT adaptativo por bracketing\n- 4 frases por nivel de SNR, pass si ≥50% keywords correctas\n- Step_down 4 dB tras pasar, step_up 2 dB tras fallar\n- Máx 30 trials por test\n\n## Interpretación\n\nSRT-SNR típico en adultos jóvenes normoyentes: **-5 a -8 dB**. Umbrales >0 dB indican dificultad clínica para extraer habla en ruido (hipoacusia coclear, presbiacusia, déficit central). Alternar listas en re-tests para neutralizar efecto aprendizaje.`,
  requirements: 'audio_pack',
  license: 'CC-BY',
  author: { name: 'AudioPAC', url: 'https://github.com/Debaq/audiopac' },
  references: [
    { citation: 'Aubanel V, García Lecumberri ML, Cooke M (2014). The Sharvard Corpus: A phonemically-balanced Spanish sentence resource for audiology. Int J Audiol 53(9):633-641', url: 'https://zenodo.org/records/3547446' },
    { citation: 'Nilsson M, Soli SD, Sullivan JA (1994). Development of the Hearing in Noise Test for the measurement of speech reception thresholds in quiet and in noise. J Acoust Soc Am 95:1085-1099', url: null },
    { citation: 'Soli SD, Wong LL (2008). Assessment of speech intelligibility in noise with the Hearing in Noise Test. Int J Audiol 47(6):356-361', url: null },
  ],
  tests,
  lists: [],
  lists_ref: 'catalogs/sharvard-es-v1.json',
  interpretation: {
    metric: 'srt_db',
    norms_by_age: [
      { age_min: 18, age_max: 40, normal_min: -8, mild_min: -3, severe_max: 3 },
      { age_min: 41, age_max: 65, normal_min: -5, mild_min: 0, severe_max: 5 },
      { age_min: 66, age_max: 90, normal_min: -2, mild_min: 3, severe_max: 8 },
    ],
    description_md: '**SRT-SNR con Sharvard ES + ruido rosa binaural — adultos normoyentes:**\n\n- 18-40 a: -5 a -8 dB\n- 41-65 a: -3 a -5 dB (efecto envejecimiento periférico)\n- >65 a: 0 a +3 dB (componente cognitivo)\n\nUmbrales >0 dB en jóvenes o >5 dB en mayores indican dificultad clínica para extraer habla en ruido: hipoacusia coclear, presbiacusia mixta, TPAC, déficit atencional. Útil para monitorizar beneficio de adaptación audioprotésica (mejora ≥3 dB clínicamente significativa).',
  },
  report_template_md: '## HINT-ES — {{test_name}}\n\nPaciente **{{patient_name}}** ({{patient_age}} años). Oído evaluado: {{ear}}. Fecha: {{date}}.\n\n**SRT-SNR obtenido: {{metric_value}} dB** (banda {{norm_band}} → {{verdict}}).\n\nSe administraron {{total}} frases con adaptación por bracketing en ruido rosa binaural; {{correct}} trials cumplieron criterio de paso (≥50% palabras clave correctas).',
  metadata: {
    recommended: false,
    target_population: 'adults',
    requires_audio_pack: true,
    audio_pack_release_tag: 'sharvard-audio-v1',
    estimated_duration_min: 8,
  },
}

const json = JSON.stringify(manifest, null, 2) + '\n'
writeFileSync(OUT, json)
const bytes = statSync(OUT).size
const sha = createHash('sha256').update(readFileSync(OUT)).digest('hex')

// Patch index.json
const idx = JSON.parse(readFileSync(INDEX, 'utf8'))
const entry = {
  id: manifest.id,
  version: manifest.version,
  name: manifest.name,
  category: manifest.category,
  requirements: manifest.requirements,
  license: manifest.license,
  url: `packs/${manifest.id}.json`,
  sha256: sha,
  bytes,
}
const existingIdx = idx.packs.findIndex(p => p.id === manifest.id)
if (existingIdx >= 0) idx.packs[existingIdx] = entry
else idx.packs.push(entry)
idx.updated_at = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
writeFileSync(INDEX, JSON.stringify(idx, null, 2) + '\n')

console.log(`Wrote ${OUT} (${bytes} bytes, sha256=${sha})`)
console.log(`Updated ${INDEX}`)
