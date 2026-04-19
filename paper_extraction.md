# AudioPAC — Extracción técnica exhaustiva para papers (AUDITIO + JOSS)

Documento autogenerado a partir de lectura del repo principal (`/home/nick/Escritorio/Proyectos/audiopac`) y repo hermano (`/home/nick/Escritorio/Proyectos/audiopac-assets`) al commit `a86da41` (2026-04-18). Cada afirmación técnica cita archivo:línea. Cuando hay divergencia entre documentación (`README.md`, `docs/ROADMAP_PAC.md`) y código, se indica.

---

## 1. Inventario de baterías y tests

### 1.1 Tabla maestra de packs publicados

Fuente: `/home/nick/Escritorio/Proyectos/audiopac-assets/index.json:51-239` (17 packs) y los 17 archivos `packs/*.json` individuales. Autor de todos los packs: `"AudioPAC"` (equipo del proyecto) — NO son publicaciones bibliográficas firmadas por los autores originales de cada test; son implementaciones que **citan** al autor original. Licencia: `CC-BY-SA` para packs con contenido clínico-algorítmico propio, `CC-BY` para los que redistribuyen corpus Sharvard.

| Pack (id) | Versión | Categoría | Requisitos | Tests (código) | Listas | Licencia | Bytes |
|---|---|---|---|---|---|---|---|
| `pac-patterns-v1` | 1.2.0 | pac.patterns | ninguno | FPT_STD, PPS_LONG, DPT_LONG, MEM_SEQ_5, MEM_SEQ_6, MEM_SEQ_7 | — | CC-BY-SA | 20 075 |
| `pps-pinheiro-v1` | 1.1.0 | pac.patterns | ninguno | PPS_STD | — | CC-BY-SA | 7 034 |
| `dps-musiek-v1` | 1.1.0 | pac.patterns | ninguno | DPS_STD | — | CC-BY-SA | 7 076 |
| `pac-limens-v1` | 1.1.0 | pac.limens | ninguno | DLF_SCREEN, DLF_FINE, DLD_SCREEN, DLD_FINE, DLI_SCREEN, DLI_FINE | — | CC-BY-SA | 23 913 |
| `pac-temporal-v1` | 1.1.0 | pac.temporal | ninguno | GAP_20, GAP_10, GAP_5, TOJ_BIN, TOJ_FAST, FGC_SCREEN | — | CC-BY-SA | 20 748 |
| `pac-binaural-v1` | 1.1.0 | pac.binaural | ninguno | ILD_LAT, DICHOTIC_NV, FUSION_BIN | — | CC-BY-SA | 14 879 |
| `pac-noise-v1` | 1.1.0 | pac.noise | ninguno | GIN_STD, RGD_20, RGD_10, RGD_5, NBN_SCREEN | — | CC-BY-SA | 18 222 |
| `pac-mld-v1` | 1.1.0 | pac.mld | ninguno | MLD_STD | — | CC-BY-SA | 10 196 |
| `logoaud-latam-v1` | 1.1.0 | logoaudiometry | recording | SRT_LATAM_BISIL | SRT_LATAM_BISIL_A (20 ítems), DISC_LATAM_MONO_A (25 ítems) | CC-BY-SA | 12 995 |
| `logoaud-us-es-v1` | 1.1.0 | logoaudiometry | recording | SRT_US_ES_BISIL | SRT_US_ES_BISIL_A (20) | CC-BY-SA | 8 347 |
| `dichotic-digits-es-v1` | 1.1.0 | dichotic | recording | DD_ES_FREE, DD_ES_DIRECTED | DICHOTIC_DIGITS_ES (8 dígitos) | CC-BY-SA | 12 921 |
| `hint-es-v1` | 1.1.0 | hint | recording | HINT_ES_CUSTOM | HINT_ES_CUSTOM_A (vacía) | CC-BY-SA | 8 501 |
| `sinb-es-v1` | 1.1.0 | hint | recording | SINB_ES_CUSTOM | SINB_ES_CUSTOM_A (vacía) | CC-BY-SA | 7 446 |
| `palpa-es-v1` | 1.1.0 | logoaudiometry | recording | — (solo listas) | PALPA_PARES_MIN_ES_A (40 palabras = 20 pares mínimos) | CC-BY-SA | 6 982 |
| `matrix-es-v1` | 1.1.0 | hint | recording | MATRIX_ES | MATRIX_ES_A (50 palabras = 5 col × 10) | CC-BY-SA | 15 438 |
| `sharvard-es-v1` | 1.1.0 | hint | audio_pack | HINT_SHARVARD_L01 | (referencia `catalogs/sharvard-es-v1.json`, 70 listas × 10) | CC-BY | 7 629 |
| `hint-es-clinico-v1` | 1.2.0 | hint | audio_pack | HINT_SHARVARD_L01..L70 (70 tests) | (referencia catálogo Sharvard) | CC-BY | 336 283 |

Total: 17 packs, coincide con README. `hint-es-clinico-v1` aporta los 70 tests individuales apuntando a las 70 listas Sharvard.

### 1.2 Parámetros técnicos por test

Valores extraídos de `config_json` en cada pack JSON. Nivel de presentación: dB SPL (mapeado por curva de calibración; fallback `DEFAULT_REF_DB = 85` en `src/lib/audio/engine.ts:48`).

#### Pack `pac-patterns-v1` (Pinheiro / Musiek)

| Test | Modalidad | Frecuencias | Duración tono | ISI | IRI | Envolvente | Nº prác | Nº test | Nivel | Canal | Min edad | Duración estimada |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FPT_STD | no-verbal / humming | 880 / 1122 Hz | 150 ms | 200 ms | 5000 ms | 10 ms | 10 | 30 | 60 dB SPL | binaural | 7 a | 8 min |
| PPS_LONG | no-verbal | 880 / 1122 Hz | 200 ms | 300 ms | 6000 ms | 10 ms | 5 | 20 | 60 | binaural | 10 a | 6 min |
| DPT_LONG | no-verbal | 1000 Hz | 250/500 ms (C/L) | 300 ms | 6000 ms | 10 ms | 5 | 20 | 60 | binaural | 8 a | 7 min |
| MEM_SEQ_5 | no-verbal | 440/587/698/880/1174 Hz | 250 ms | 400 ms | 6000 ms | 10 ms | 3 | 16 | 60 | binaural | 7 a | 5 min |
| MEM_SEQ_6 | no-verbal | idem + ext | 250 ms | 400 ms | 6000 ms | 10 ms | 3 | 16 | 60 | binaural | 10 a | 6 min |
| MEM_SEQ_7 | no-verbal | idem + ext | 250 ms | 400 ms | 6000 ms | 10 ms | 3 | 16 | 60 | binaural | 13 a | 7 min |

Fuente: `audiopac-assets/packs/pac-patterns-v1.json`.

#### Pack `pps-pinheiro-v1` — **FPT/PPS versión Musiek preferida**

PPS_STD: 880 Hz (L) / 1430 Hz (H) (contraste ~1 octava, mayor que FPT_STD 880/1122). Duración 200 ms, ISI 300 ms, IRI 6000 ms, envelope 10 ms, 20 práctica + 60 test a 60 dB SPL binaural (`packs/pps-pinheiro-v1.json:30-131`). Min edad 7 a, duración 10 min.

**Prosa FPT/PPS**: implementado como "patrones de frecuencia" con dos tonos (grave/agudo) presentados en secuencias de 3. El motor usa osciladores sinusoidales (`engine.ts:343-346`) con envolvente lineal (`engine.ts:303-318`). Differencia entre variantes: FPT (Pinheiro histórico) usa Δf ≈ 242 Hz (~4 semitonos); PPS estándar usa Δf ≈ 550 Hz (~octava). Modalidad respuesta: verbal ("grave-agudo-grave") o humming — el humming aísla hemisferio derecho no-verbal y evita falsos positivos por dificultad anómica (`packs/pps-pinheiro-v1.json:135`).

#### Pack `dps-musiek-v1`

DPS_STD: 1000 Hz fijo, L=500 ms / C=250 ms, ISI 300 ms, IRI 6000 ms, envelope 10 ms, 10 práctica + 60 test, 60 dB SPL binaural (`packs/dps-musiek-v1.json`). Min edad 8 a, 10 min.

**Prosa DPS**: paradigma de **Musiek, Baran & Pinheiro 1990** — 3 tonos isofrecuenciales (1 kHz) con duración contrastante 2:1 (L=500/C=250 ms). Aísla procesamiento temporal puro eliminando pistas espectrales. Sensible a lesiones del hemisferio derecho y cuerpo calloso (Musiek 2002). Disociación diagnóstica clásica: FPT normal + DPS alterado → lesión temporal derecha. Implementado usando ToneDefinition.duration_ms por letra sin cambiar frecuencia (`engine.ts:155-180`).

#### Pack `pac-limens-v1` (limens diferenciales)

Todos a 60 dB SPL binaural, 8 práctica + 30 test, envelope 10 ms.

| Test | Tipo | Parámetros clave | ISI | Duración | Min edad |
|---|---|---|---|---|---|
| DLF_SCREEN | screening | Δf = 20 Hz @ 1 kHz | 500 ms | 300 ms tono | 11 a |
| DLF_FINE | fino | Δf = 5 Hz @ 1 kHz | 500 ms | 400 ms | 9 a |
| DLD_SCREEN | screening | 200 vs 250 ms | 500 ms | (variable) | 11 a |
| DLD_FINE | fino | 200 vs 215 ms | 500 ms | (variable) | 11 a |
| DLI_SCREEN | screening | Δnivel = 3 dB | 500 ms | — | 11 a |
| DLI_FINE | fino | Δnivel = 1 dB | 500 ms | — | 13 a |

Referencias en pack: Moore 1973 (JASA 54:610), Sek-Moore 1995 (JASA 97:2479), Abel 1972 (JASA 51:1219), Jesteadt-Wier-Green 1977 (JASA 61:169), Tallal 1980 (Brain Lang 9:182). Interpretación: metric=accuracy_pct; adulto sano 11-60 a: normal ≥80% (screening), ≥65% (fino).

#### Pack `pac-temporal-v1`

| Test | Paradigma | Gap/ISI | Duración tono | Envelope | Min edad |
|---|---|---|---|---|---|
| GAP_20 | gap 20 ms entre 2 tonos | ISI 20 ms | 300 ms @ 1 kHz | 5 ms | 7 a |
| GAP_10 | gap 10 ms | ISI 10 ms | 300 ms | 3 ms | 8 a |
| GAP_5 | gap 5 ms | ISI 5 ms | 300 ms | 2 ms | 11 a |
| TOJ_BIN | orden temporal L/R | ISI 100 ms | 150 ms L + 150 ms R | 10 ms | 8 a |
| TOJ_FAST | TOJ rápido | ISI 40 ms | 100 ms L/R | 5 ms | 11 a |
| FGC_SCREEN | gap con cambio de freq | ISI 0 ms (micro-splice) | base 1 kHz 120 ms + G/H 60 ms @ +200/+500 Hz | 2 ms | 8 a |

Todos binaural, 60 dB SPL, 4 práctica + 20 test. Referencias: Plomp 1964 (JASA 36:277), Hirsh 1959 (JASA 31:759), Pinheiro-Musiek 1985 (Williams-Wilkins), Musiek et al. 2005 (Ear Hear 26:608 — GIN), Tallal 1980.

#### Pack `pac-binaural-v1`

| Test | Paradigma | ISI | Nº test | Min edad |
|---|---|---|---|---|
| ILD_LAT | lateralización por ILD (tono con gain_l/gain_r asimétrico) | 2000 ms | 24 | 8 a |
| DICHOTIC_NV | tonos simultáneos L≠R (sintaxis `"LHL\|HLH"` → plano parallel) | 350 ms | 16 | 8 a |
| FUSION_BIN | fusión binaural tonal | 100 ms | 12 | 8 a |

60 dB SPL. Referencias: Kimura 1961, Matzker 1959, Musiek 1983 (Ear Hear 4:79), Blauert 1997 (MIT Press), Mills 1958. Interpretación: metric `asymmetry_pct`, adulto 11-60 a lateralización correcta ≥85%.

Implementación dicótica: en `engine.ts:187-200` — patrón con `|` es "plan dicótico": parte izquierda al oído L, derecha al R, simultáneas; total = max(left,right). `buildSidePlan` construye dos planes en paralelo (`engine.ts:147-180`).

#### Pack `pac-noise-v1`

| Test | Paradigma | Duración ruido | Nivel | Nº test | Notas |
|---|---|---|---|---|---|
| GIN_STD | gap-in-noise Musiek 2005 | 3000 ms ruido blanco con gaps 2/4/6+ ms a mitad | 65 dB SPL | 30 | ISI inter-secuencia 800 ms |
| RGD_20 | Random Gap Detection (2 bursts ruido) | 50 ms burst | 65 | 20 | ISI 20 ms |
| RGD_10 | idem | 50 ms | 65 | 20 | ISI 10 ms |
| RGD_5 | idem | 50 ms | 65 | 20 | ISI 5 ms |
| NBN_SCREEN | ruido banda angosta 1 kHz bw 200 Hz | 2000 ms | 60 | 10 | ISI 500 ms |

Referencias: Musiek et al 2005 (Ear Hear 26:608), Keith 2000 (Auditec), Shinn-Chermak-Musiek 2009 (JAAA 20:229), Bamiou et al 2001. Interpretación: metric=gap_ms; umbral GIN normal adulto ~4-6 ms.

**Prosa GIN**: Gaps-In-Noise — Musiek 2005. Ruido blanco continuo (3 s) con gaps embebidos de ancho variable (2/4/6… ms) posicionados a mitad del ruido. Implementación: `engine.ts:307-315` — `toneGain.gain.setValueAtTime(peak, gapStart - ramp)` + `linearRampToValueAtTime(0, gapStart)` + `setValueAtTime(0, gapEnd)` + ramp de vuelta. Rampa min(2 ms, gap_width/4) para evitar clicks. Umbral ≤6 ms en normales.

#### Pack `pac-mld-v1` (Masking Level Difference)

MLD_STD: 4 tokens (A=SoNo + tono 500 Hz @ 60 dB, B=SoNo catch, C=SπNo + tono 500 Hz @ 50 dB con `phase_invert_right=true`, D=SπNo catch). Envolvente 20 ms, ISI 1000 ms, IRI 3000 ms, 6 práctica + 20 test. Ruido blanco a 65 dB (`packs/pac-mld-v1.json`).

Implementación inversión de fase: `engine.ts:334` — `rightNode.gain.value = rGain * (tone.phase_invert_right ? -1 : 1)`; el ruido nunca se invierte. Referencias: Hirsh 1948 (JASA 20:536), Licklider 1948 (JASA 20:150), Durlach 1963 (JASA 35:1206), Wilson et al 2003 (JAAA 14:1), Noffsinger 1972 (Acta Otolaryngol Suppl 303). Sensible a EM y schwannoma vestibular (tronco bajo / complejo olivar superior medial).

**Prosa MLD**: `Wilson 500-Hz MLD protocol` (Wilson 2003, JAAA 14:1). MLD clásico = umbral detección tono en ruido SoNo menos umbral en SπNo (tono invertido en fase entre oídos, ruido en fase). MLD normal ≥10 dB; valores <5 dB sugieren disfunción del tronco auditivo bajo. Implementación AudioPAC es "task de detección" (detectar tono presente vs catch), no umbral adaptativo.

#### Pack `logoaud-latam-v1` / `logoaud-us-es-v1` — SRT bisílabos

Ambos tests SRT (`SRT_LATAM_BISIL` / `SRT_US_ES_BISIL`) comparten `config_json.srt`:
- `start_level_db: 50`
- `words_per_level: 4`
- `step_down_db: 10`, `step_up_db: 5`
- `threshold_pass_ratio: 0.5`
- `min_level_db: 0`, `max_level_db: 90`
- `max_total_trials: 40`
- `stimulus_list_code: SRT_LATAM_BISIL_A` (20 bisílabos LatAm) / `SRT_US_ES_BISIL_A` (20)

Canal binaural, nivel inicial 50 dB HL. Lista DISC_LATAM_MONO_A: 25 monosílabos para discriminación. Referencias LatAm: Tato 1949, ASHA 1988, Carhart-Jerger 1959 (método preferred, JSHD 24:330), Hughson-Westlake 1944. Referencias US-ES: McCullough et al 1994 (Am J Audiol 3:19), Lipski 2008 (Varieties of Spanish in the US), Wilson-McArdle 2005. Interpretación: metric=srt_db; normal adulto ≤20 dB HL; debe coincidir ±10 dB con PTA.

**Prosa SRT**: método Hughson-Westlake-modificado Carhart-Jerger 1959 — familiarización opcional (v2), bracketing descendente-ascendente con 4 palabras por nivel, step_down 10 dB tras pasar, step_up 5 dB tras fallar; SRT = mínimo nivel con pass que tiene fail por debajo. Extendido con carrier phrase y enmascaramiento contralateral opcionales (`srtRunner.ts:232-246`) y tres cutoff rules: `bracketing` (default), `fixed_trials`, `plateau` (`srtRunner.ts:285-310`).

#### Pack `dichotic-digits-es-v1`

Dos tests con `config_json.dichotic_digits`:
- DD_ES_FREE / DD_ES_DIRECTED
- `num_pairs: 20`, `digits_per_ear: 2`, `isi_ms: 300`
- `level_db: 55 dB HL`, `stimulus_list_code: DICHOTIC_DIGITS_ES`
- Lista DICHOTIC_DIGITS_ES con **8 dígitos ES** (1-9 excluyendo "siete" que es bisílabo — rompe onset alignment) (`packs/dichotic-digits-es-v1.json`)

Modos: `free` (recuerdo libre, Musiek 1983) vs `directed` (recuerdo dirigido, Strouse-Wilson 1999). Directed admite block order `lrlr`/`llrr`/`interleaved`. Catch trials opcionales (count, placement random/every_n/start_end). Scoring granularity: `per_pair`/`per_position`/`per_digit` (`dichoticDigitsRunner.ts:89-173`).

**Prosa Dichotic Digits ES**: Musiek 1983, revisado 1991. Pares de dígitos simultáneos L+R usando `playStimulusPair` (`engine.ts:704-761`) con mismo `startTime` en el AudioContext (sample-accurate). Paciente reporta todos los dígitos (libre) o solo uno de los oídos (dirigido). REA (Right Ear Advantage) normal 5-10%; asimetrías >20% sugieren compromiso callosal o cortical contralateral. Interpretación en pack: metric `asymmetry_pct`, adulto ≥90% por oído.

Referencias: Musiek 1983 (Ear Hear 4:79), Kimura 1961 (Can J Psychol 15:166), Musiek-Gollegly-Kibbe-Verkest-Lenz 1991 (Am J Otol 12:109), Strouse-Wilson 1999, Jerger-Martin (para niños).

#### Pack `hint-es-v1` (HINT español custom)

HINT_ES_CUSTOM: `config_json.hint`:
- `start_snr_db: 5`, `noise_level_db: 60 dB SPL`, `noise_type: 'pink'`
- `sentences_per_level: 4`, `threshold_pass_ratio: 0.5`
- `step_down_db: 4`, `step_up_db: 2`
- `min_snr_db: -10`, `max_snr_db: 20` (aprox según cfg del pack)
- Lista vacía — el usuario graba sus frases

Referencias: Nilsson-Soli-Sullivan 1994 (JASA 95:1085 — HINT original), Killion 1997, Humes 2007 (JAAA 18:590), Huarte (validación ES). Interpretación: SRT-SNR normal adultos jóvenes ~-3 a -6 dB.

**Prosa HINT**: Nilsson et al 1994. Frases del HINT corpus en ruido rosa adaptativo. Paciente repite la frase; examinador marca keywords correctos (chips clickables en UI). Pasa trial si ratio_correct ≥ 0.5. Algoritmo: bracketing SNR (step 4/2 dB). Implementado en `hintRunner.ts:54-319`. Engine: `playStimulusWithNoise` (`engine.ts:625-697`) — ruido en loop con lead-in/out 200 ms + fade 50 ms. Mapeo SPL: `voiceGain = dbToGain(level_db - rms_dbfs, ref)`; `noiseGain = 10^((noise_level_db - noiseRef)/20)` con `noiseRef` desde `noise_calibration_points` si existe, sino heurístico (`engine.ts:93-104`).

#### Pack `sinb-es-v1` (Speech in Babble / SSN)

SINB_ES_CUSTOM: igual HINT pero `noise_type: 'ssn'` (Speech-Shaped Noise = ruido rosa filtrado LP 1 kHz Q=0.707 — aproxima LTASS del habla) (`engine.ts:269-275`). Lista vacía.

Normativas por edad (pack):
- 11-40 a: normal ≥-8 dB SRT-SNR
- 41-65 a: normal ≥-5 dB
- 66-90 a: normal ≥-2 dB

Referencias: Killion et al 2004 (JASA 116:2395 — QuickSIN), Hochmuth et al 2012 (Int J Audiol 51:536 — Matrix ES), Byrne et al 1994 (LTASS internacional).

#### Pack `matrix-es-v1` (Hochmuth 2012)

MATRIX_ES: `config_json.matrix`:
- `columns: 5` (estructura "Nombre-Verbo-Número-Objeto-Adjetivo")
- `start_snr_db: 0`, `noise_level_db: 65 dB SPL`, `noise_type: 'pink'`
- `inter_word_gap_ms: 80`
- `sentences_per_level: 4`, `threshold_pass_ratio: 0.6`
- `step_down_db: 4`, `step_up_db: 2`
- Lista MATRIX_ES_A: 50 palabras (10 por columna) con metadata `column: 0..4`

Referencias: Hochmuth-Brand-Zokoll-Castro-Wardenga-Kollmeier 2012 (Int J Audiol 51:536), Kollmeier et al 2015 (Int J Audiol 54 Suppl 2:3 — multilingual matrix).

**Prosa Matrix 5-AFC**: `MatrixController` (`matrixRunner.ts:62-315`). Cada trial elige 1 palabra random de cada columna (5 palabras total) y las concatena con gap 80 ms en ruido continuo (`playStimulusSequenceWithNoise`, `engine.ts:769-854`). UI: grid 5×10 clickeable; paciente marca la palabra percibida por columna. Pasa si ≥0.6 correctas. Test-retest Hochmuth ±1 dB. Normativas idénticas a SinB por edad.

#### Pack `palpa-es-v1`

Sin tests (solo lista). `PALPA_PARES_MIN_ES_A`: 40 palabras = 20 pares mínimos consonánticos (oclusivas sordo/sonoro, fricativas, nasales, laterales, vibrantes). Categoría `discrimination`. Requiere grabación. Interpretación: accuracy_pct, adulto sano ≥90% (techo), 75-89% dificultad fonológica leve, <75% compromiso significativo. Referencias: Kay-Lesser-Coltheart 1992 (PALPA original), Valle-Cuetos 1995 (EPLA adaptación ES), Ellis-Young 1988, Franklin 1989 (Aphasiology 3:189).

#### Packs `sharvard-es-v1` y `hint-es-clinico-v1`

Corpus **Sharvard ES** (Aubanel, García Lecumberri, Cooke 2014, Int J Audiol 53:633, [Zenodo 3547446](https://zenodo.org/records/3547446)): 700 frases peninsular ES, 70 listas × 10 frases, balanceadas fonémicamente, 5 keywords por frase. Licencia CC-BY. Catálogo en `audiopac-assets/catalogs/sharvard-es-v1.json` (211 165 bytes, SHA-256 `6d4db257…fc43ee`).

Audio packs (GitHub Releases, release_tag `sharvard-audio-v1`):
- Voz F: `sharvard-es-f-v1.tar.gz`, 130 114 985 bytes, WAV mono 48 kHz (speaker ES-F-01)
- Voz M: `sharvard-es-m-v1.tar.gz`, 135 015 044 bytes, WAV mono 48 kHz (speaker ES-M-01)
- Fuente: `index.json:22-47`

`sharvard-es-v1` pack expone solo `HINT_SHARVARD_L01` (template a clonar). `hint-es-clinico-v1` v1.2.0 expone **70 tests `HINT_SHARVARD_L01..L70`** seleccionables directamente — cada uno con ficha clínica completa. Ambos usan el runner HINT con `noise_type: 'pink'`, `noise_level_db: 60`, `start_snr_db: 5`, pink ruido rosa.

---

## 2. Arquitectura

### 2.1 Diagrama motor + packs

```
 ┌────────────────────────────────────────────────────────────┐
 │                     AudioPAC (Tauri v2)                     │
 │                                                             │
 │  Frontend (React 19 + Vite)                                 │
 │  ┌──────────────────────┐                                   │
 │  │  src/lib/audio/      │  engine.ts (950 loc)              │
 │  │   - engine.ts        │  osciladores + ruidos + mezcla    │
 │  │   - runner.ts        │  TestRunner (patterns)            │
 │  │   - srtRunner.ts     │  SRTController                    │
 │  │   - hintRunner.ts    │  HINTController                   │
 │  │   - matrixRunner.ts  │  MatrixController                 │
 │  │   - dichoticDigits-  │  DichoticDigitsController         │
 │  │     Runner.ts        │                                   │
 │  │   - recording.ts     │  MediaRecorder + processClip      │
 │  │   - denoise.ts       │  STFT spectral gate               │
 │  │   - device.ts        │  enumerateDevices / default out   │
 │  └──────────────────────┘                                   │
 │                                                             │
 │  ┌──────────────────────┐      ┌──────────────────────┐     │
 │  │  src/lib/packs/      │      │  src/lib/es/         │     │
 │  │   - types.ts         │      │   - phonetics.ts     │     │
 │  │   - installer.ts     │      │     (silabificación  │     │
 │  │   - interpretation   │      │      articulatoria   │     │
 │  │   - readiness        │      │      balance score)  │     │
 │  └──────────────────────┘      └──────────────────────┘     │
 │                                                             │
 │  src/lib/db/ (sessions, patients, stimuli, templates, …)    │
 │                    │                                        │
 │  ─────────────────┼────────────────  via @tauri-apps/plugin-sql
 │                    ▼                                        │
 │  Rust backend (src-tauri/)                                  │
 │   - migrations 001 + 002                                    │
 │   - cmd `reset_database`                                    │
 │   - plugins: sql, fs, dialog, http, os, process, opener     │
 │                                                             │
 └────────────────────────────────────────────────────────────┘
                 │                              ▲
                 │ SQLite local                 │ fetch on-demand
                 ▼                              │
   appDataDir/audiopac.db               audiopac-assets repo:
   appDataDir/stimuli/*.wav               index.json + packs/*.json
                                          + GitHub Releases (tar.gz)
```

Stack confirmado (`package.json`, `src-tauri/Cargo.toml`):
- Tauri 2.10.3 (`Cargo.toml:24`), tauri-plugin-sql 2 con feature `sqlite` (`Cargo.toml:26`)
- React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (`package.json`)
- Plugins Tauri: sql, dialog, fs, os, http (2.5.8), process, opener (`Cargo.toml:26-32`)
- jsPDF para informes, Zustand para stores (`package.json`)

### 2.2 Flujo instalación/desinstalación/update de packs

`src/lib/packs/installer.ts`:
- `fetchPacksIndex()` línea 58-64: GET `${ASSETS_RAW}/index.json` via `@tauri-apps/plugin-http`
- `fetchPackManifest(entry)` línea 66-77: GET del manifiesto + verificación SHA-256 (`crypto.subtle.digest`) contra `entry.sha256`. Lanza error si mismatch.
- `installPack(manifest, source)` línea 101-221: **idempotente** — si el pack ya existe por `code`, UPDATE de metadata; sino INSERT. Para tests y listas: upsert por `code` (UPDATE si existe, INSERT si no) — **preserva `file_path` de estímulos ya grabados**. Copia test_meta a `packs.metadata_json.tests_meta[code]` (línea 29-49).
- `uninstallPack(code)` línea 227-247: bloquea si hay `test_sessions` apuntando a algún template del pack (JOIN + COUNT). Si limpio, DELETE en `test_templates`, `stimulus_lists`, `packs` (FK cascade borra `stimuli`).
- Updates: `src/stores/packUpdates.ts` hace diff de versión instalada vs versión disponible en `index.json` → muestra aviso global.

### 2.3 Schema JSON del pack (canónico)

Definido en `src/lib/packs/types.ts:121-147`:

```ts
interface PackManifest {
  id: string
  version: string
  name: string
  category: 'pac.patterns'|'pac.limens'|'pac.temporal'|'pac.binaural'
          |'pac.noise'|'pac.mld'|'logoaudiometry'|'dichotic'|'hint'
          |'sentence-corpus'
  description_md: string
  requirements: 'ninguno' | 'recording' | 'audio_pack'
  license: string
  author: { name: string; url?: string }
  references?: Array<{ citation: string; url?: string|null }>
  tests?: PackTest[]
  lists?: PackStimulusList[]
  lists_ref?: string
  interpretation?: PackInterpretation | null
  report_template_md?: string
  families?: Record<string, string>
  metadata?: Record<string, unknown>
}

interface PackTest {
  code: string
  name: string
  test_type: 'DPS'|'PPS'|'CUSTOM'
  description?: string
  config_json: Record<string, unknown>
  is_standard?: 0|1
  family?: string
  purpose_md?: string
  how_it_works_md?: string
  protocol_md?: string
  target_population_md?: string
  contraindications_md?: string
  estimated_duration_min?: number
  min_age_years?: number
  max_age_years?: number
  references?: Array<{citation:string; url?:string; doi?:string; year?:number}>
  attachments?: Array<{label:string; url:string; kind?:'pdf'|'video'|'link'}>
}

interface PackInterpretation {
  metric: string  // 'accuracy_pct'|'asymmetry_pct'|'srt_db'|'gap_ms'|...
  norms_by_age?: Array<{
    age_min: number; age_max: number
    normal_min?: number; normal_max?: number
    mild_min?: number;   mild_max?: number
    severe_min?: number; severe_max?: number
  }>
  description_md?: string
}
```

Índice raíz `index.json` — schema propio (`audiopac-assets/README.md:28-62`):

```jsonc
{
  "schema": 1,
  "updated_at": "2026-04-18T15:21:26Z",
  "catalogs": [ {
      "id":"sharvard-es","version":"1.0.0","type":"sentence",
      "license":"CC-BY","lists":70,"items":700,"keywords_per_item":5,
      "text_url":"catalogs/sharvard-es-v1.json","text_sha256":"…",
      "audio_packs":[{"voice":"F","release_tag":"sharvard-audio-v1",
        "asset_name":"sharvard-es-f-v1.tar.gz","sha256":"…","bytes":130114985,
        "format":"wav","sample_rate":48000,"channels":1}, … ]
  } ],
  "packs":[ {"id":"pac-patterns-v1","version":"1.2.0",
             "url":"packs/pac-patterns-v1.json","sha256":"…","bytes":20075, …} ]
}
```

### 2.4 Schema SQLite

`src-tauri/migrations/001_initial.sql` (schema v2-packs, colapsado) + `002_noise_calibration.sql`.

```sql
-- Perfiles (profesionales)
CREATE TABLE profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, avatar TEXT, color TEXT DEFAULT '#6B1F2E',
  pin_hash TEXT,  -- SHA-256 del PIN (opcional)
  created_at TEXT, updated_at TEXT
);

-- Pacientes (CRUD manual por el profesional)
CREATE TABLE patients (
  id, document_id UNIQUE, first_name, last_name, birth_date,
  gender, phone, email, address, notes,
  created_by → profiles(id) ON DELETE SET NULL, …
);
CREATE INDEX idx_patients_document, idx_patients_name;

-- Paquetes instalados
CREATE TABLE packs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL, version TEXT NOT NULL, name TEXT NOT NULL,
  category TEXT, description_md TEXT,
  requirements TEXT CHECK(requirements IN ('ninguno','recording','audio_pack')),
  license TEXT, author_json TEXT, references_json TEXT,
  interpretation_json TEXT, metadata_json TEXT,
  source_url TEXT, manifest_sha256 TEXT,
  installed_at, updated_at
);

-- Plantillas de test
CREATE TABLE test_templates (
  id, code UNIQUE, name, test_type CHECK IN ('DPS','PPS','CUSTOM'),
  description, config_json NOT NULL, is_standard, is_active,
  pack_id → packs(id) ON DELETE SET NULL,  -- preserva sesiones
  created_by → profiles(id) ON DELETE SET NULL
);

-- Calibración — referencia por frecuencia (1 kHz) + tabla de puntos multi-freq
CREATE TABLE calibrations (
  id, label, device_id, device_label, headphone_model,
  ear CHECK IN ('left','right','binaural'),
  frequency_hz DEFAULT 1000, internal_level_dbfs DEFAULT -20,
  measured_db_spl NOT NULL, ref_db_spl NOT NULL,
  is_active, valid_until, notes, created_by, created_at
);

CREATE TABLE calibration_points (
  id, calibration_id NOT NULL → calibrations(id) ON DELETE CASCADE,
  frequency_hz NOT NULL, ear CHECK IN ('left','right','binaural'),
  internal_level_dbfs, measured_db_spl, ref_db_spl,
  UNIQUE(calibration_id, frequency_hz, ear)
);

-- Calibración de ruido por tipo (mig 002)
CREATE TABLE noise_calibration_points (
  id, calibration_id → calibrations(id) ON DELETE CASCADE,
  noise_type CHECK IN ('white','pink','ssn'),
  internal_level_dbfs, measured_db_spl, ref_db_spl,
  UNIQUE(calibration_id, noise_type)
);

-- Sesiones de evaluación
CREATE TABLE test_sessions (
  id, patient_id → patients(id) CASCADE,
  template_id → test_templates(id),
  profile_id → profiles(id),
  ear, response_mode CHECK IN ('verbal','hummed','manual'),
  status CHECK IN ('in_progress','completed','cancelled'),
  practice_score, test_score, total_items, correct_items, notes,
  config_snapshot TEXT,            -- snapshot inmutable de TestConfig
  calibration_id → calibrations(id) ON DELETE SET NULL,
  ref_db_snapshot REAL,            -- snapshot del ref_db escalar
  calibration_curve_snapshot TEXT, -- snapshot JSON de la curva multi-freq
  started_at, completed_at
);

CREATE TABLE test_responses (
  id, session_id → test_sessions(id) CASCADE,
  item_index, phase CHECK IN ('practice','test'),
  expected_pattern, given_pattern, is_correct,
  reaction_time_ms, presented_at
);

-- Listas de estímulos y estímulos individuales
CREATE TABLE stimulus_lists (
  id, code UNIQUE, name,
  category CHECK IN ('srt','discrimination','dichotic_digits','sentence','custom'),
  language DEFAULT 'es', country_code,
  description, is_standard, is_active,
  pack_id → packs(id) ON DELETE SET NULL,
  created_by → profiles(id) ON DELETE SET NULL
);

CREATE TABLE stimuli (
  id, list_id → stimulus_lists(id) CASCADE,
  position, token, file_path,
  duration_ms, rms_dbfs, peak_dbfs, sample_rate,
  normalized DEFAULT 0,
  keywords_json,   -- array JSON de keywords HINT
  metadata_json,   -- { column: 0..4 (Matrix), ssw_item:int, side:'R|L', … }
  UNIQUE(list_id, position)
);

-- Settings
CREATE TABLE settings ( key PRIMARY KEY, value TEXT, updated_at );
INSERT INTO settings VALUES
  ('country_code','LATAM'),
  ('schema_era','v2-packs');
```

Migraciones activas (`src-tauri/src/migrations.rs:6-22`):
- v1 `initial_schema_v2_packs` → `001_initial.sql`
- v2 `noise_calibration_points` → `002_noise_calibration.sql`

Nota: pre-v2 (`schema_era != 'v2-packs'`) dispara modal bloqueante `SchemaIncompatibleDialog` que invoca cmd Rust `reset_database` (`src-tauri/src/lib.rs:9-53`) — borra `audiopac.db` + sidecars `-shm`/`-wal` en los tres `app_config_dir`/`app_data_dir`/`app_local_data_dir` + carpeta `stimuli/`, luego `app.exit(0)`.

### 2.5 Flujo datos test → PDF

1. Usuario selecciona template + paciente en `/evaluacion`.
2. Al iniciar: INSERT en `test_sessions` con `config_snapshot = JSON.stringify(template.config)`, `calibration_id = activa`, `ref_db_snapshot = ref_db_spl`, `calibration_curve_snapshot = JSON.stringify(curve)`. Los tres snapshots son **inmutables** — recalibrar después no altera el informe.
3. Runner correspondiente (`runner.ts` para PPS/DPS/CUSTOM, `srtRunner.ts`, `hintRunner.ts`, `matrixRunner.ts`, `dichoticDigitsRunner.ts`) ejecuta y escribe respuestas en `test_responses` (una fila por trial, con `expected_pattern`, `given_pattern`, `is_correct`, `reaction_time_ms`, `presented_at`).
4. Al terminar: UPDATE `test_sessions` con `practice_score`, `test_score`, `total_items`, `correct_items`, `completed_at`, `status='completed'`.
5. `SessionReportPage` lee session + responses → deriva métrica (`deriveMetricValue`, `interpretation.ts:222-226`) → busca `pack.interpretation.norms_by_age[]` y `pickNormBand(age)` (`interpretation.ts:71-78`) → `evaluateNorm` produce verdict `'normal' | 'borderline' | 'abnormal'` según dirección métrica (`interpretation.ts:87-102`).
6. Renderiza plantilla de informe custom por pack si existe (`fillReportTemplate`, `interpretation.ts:60-69`) con placeholders `{{patient_name}}`, `{{test_score}}`, `{{srt_db}}`, `{{verdict}}`, `{{norm_band}}`, …
7. jsPDF genera PDF; también export CSV.

### 2.6 Sin red en runtime clínico

Confirmado:
- `PRIVACY.md:33-37`: "La aplicación no realiza conexiones de red en operación normal."
- Únicas conexiones: (a) fetch de `audiopac-assets/index.json` y pack JSONs vía `tauri-plugin-http` **solo al instalar/actualizar packs** manualmente desde `/catalogos` (`installer.ts:58-77`); (b) GitHub Releases para audios (Sharvard tar.gz) al instalar pack audio.
- Durante sesión de evaluación no hay fetch (tests corren contra DB + filesystem local).
- Sin telemetría, sin reporting de crashes, sin analytics (`PRIVACY.md:23-30`).

---

## 3. Calibración

### 3.1 Algoritmo tono 1 kHz paso a paso

Fuente: `docs/ROADMAP_PAC.md:87-96` + `engine.ts:876-907` + `lib/db/calibrations.ts:26-45`.

1. UI `/calibracion` presenta tono continuo sinusoidal a `internal_level_dbfs = -20` (default) @ 1 kHz. Función `playCalibrationTone(1000, -20, ear)` (`engine.ts:876`) genera `OscillatorNode` con gain lineal = `10^(dbfs/20)`, **sin mapeo SPL** — es un tono patrón bruto.
2. Usuario reproduce con auriculares sobre acoplador (6cc supraaurales / 2cc intraaurales), mide con sonómetro externo e ingresa valor leído (ej: 74 dB SPL).
3. Sistema calcula: `ref_db_spl = measured_db_spl - internal_level_dbfs` → en el ejemplo: `74 - (-20) = 94 dB SPL @ 0 dBFS`.
4. Al activar: UPDATE `calibrations SET is_active=0` para todas y `=1` para la nueva (`calibrations.ts:26-45`). Default `valid_until` = hoy+6 meses (`calibrations.ts:20-24`).
5. En runtime, `dbToGain(db_spl, ref_db)` (`engine.ts:138-145`) convierte a gain: `db_fs = db_spl - ref`; `gain = 10^(db_fs/20)`.

### 3.2 Curva multi-frecuencia 250-8000 Hz (Fase 3)

Tabla `calibration_points` vincula `calibration_id × frequency_hz × ear` → `ref_db_spl` (`001_initial.sql:116-127`). Interpolación log-frecuencia en `engine.ts:110-132`:

```ts
// resolveRefDb(freq, ear, curve?)
// 1) filtrar puntos del mismo oído, ordenados por freq ascendente
// 2) fallback: binaural → oído opuesto → activeRefDb escalar
// 3) si 1 punto → ref_db_spl directo
// 4) si freq fuera de bounds → piso o techo
// 5) interpolación log2:
const la = Math.log2(a.frequency_hz), lb = Math.log2(b.frequency_hz)
const lf = Math.log2(frequency_hz)
const t = (lf - la) / (lb - la)
ref = a.ref_db_spl + t * (b.ref_db_spl - a.ref_db_spl)
```

Puntos ancla: decididos por el usuario (UI `/calibracion` ofrece chips de freq comunes). NO hay lista fija en código; contador N/12 sugerido en UI. Roadmap indica 250–8000 Hz (`docs/ROADMAP_PAC.md:147`).

Cuando tono no es 1 kHz: `playSequence` resuelve por frecuencia efectiva de cada tono en el plan (`engine.ts:290-294`). Estímulos grabados (`playStimulusBuffer`) fijan `freq=1000` para mapeo (`engine.ts:498`) — limitación: mapea todo el habla a ref@1 kHz.

### 3.3 Calibración de ruido (Fase 5, mig 002)

Tabla `noise_calibration_points` con UNIQUE(calibration_id, noise_type ∈ pink/white/ssn) (`002_noise_calibration.sql:5-15`).

`resolveNoiseRefDb(type, ear, override?)` (`engine.ts:93-104`): si hay calibración real por tipo, la usa; sino fallback heurístico: `ref_tono@1kHz + rms_estimado`, donde `rms = -20 (ssn) / -15 (pink) / -5 (white)`. UI `/calibracion` sección 4: reproduce `playCalibrationNoise(type, -20, ear)` en loop (`engine.ts:914-950`), user mide SPL, guarda punto.

### 3.4 Device tracking — qué se hashea

**NO es hash criptográfico** — usa el `deviceId` crudo del navegador. Fuente `lib/audio/device.ts:14-21`: `navigator.mediaDevices.enumerateDevices()` filtra `kind === 'audiooutput'` y guarda `{deviceId, label}`. Al crear calibración se guardan `device_id` y `device_label` (`001_initial.sql:98-99`).

Store `useCalibrationStore` (`src/stores/calibration.ts:19-25`):
```ts
function computeStatus(active, devId, devLabel): 'none'|'ok'|'expired'|'device_mismatch' {
  if (!active) return 'none'
  if (isCalibrationExpired(active)) return 'expired'
  if (active.device_id && devId && active.device_id !== devId) return 'device_mismatch'
  if (active.device_label && devLabel && active.device_label !== devLabel && !active.device_id)
    return 'device_mismatch'
  return 'ok'
}
```

Listener global `navigator.mediaDevices.addEventListener('devicechange', …)` re-evalúa en caliente (`calibration.ts:61-63`).

### 3.5 Expiración

Default `valid_until = today + 6 meses` (`calibrations.ts:20-24`). `isCalibrationExpired` (`calibrations.ts:47-50`) compara `new Date(valid_until) < new Date()`. Estado `'expired'` muestra badge "Vencida" en UI y banner global en `AppLayout` (`docs/ROADMAP_PAC.md:137-140`). **Lo que pasa**: calibración sigue activa funcionalmente (los `ref_db_spl` se siguen usando), pero hay advertencia visible. No bloquea evaluación.

### 3.6 Snapshot inmutable por sesión

En `test_sessions`:
- `calibration_id` → `calibrations(id)` ON DELETE SET NULL (no borra sesión al borrar calibración)
- `ref_db_snapshot REAL` — valor escalar al iniciar
- `calibration_curve_snapshot TEXT` — JSON de la curva multi-freq (`001_initial.sql:149-151`)

Los runners reciben estos snapshots y los pasan al engine como `options.refDb` y `options.curve` (`runner.ts:30-45`, `srtRunner.ts:65-76`, `hintRunner.ts:67-76`, `matrixRunner.ts:74-85`, `dichoticDigitsRunner.ts:62-71`). Recalibrar después no afecta el informe histórico.

### 3.7 Pre-session check (2 tonos)

Modal `PreSessionCheck` (`docs/ROADMAP_PAC.md:139-140`): reproduce 2 tonos (ref y ref-6 dB en orden aleatorio) via `playBurstDbfs` (`engine.ts:445-481`), paciente/examinador elige el más fuerte. Umbral decisión: si responde bien detecta que el volumen del SO cambió radicalmente (mute, -20 dB). Limitación explícita: "sin plugin nativo no se puede leer volumen OS directo" (`docs/ROADMAP_PAC.md:141`).

---

## 4. Pipeline grabación / procesado

Archivo principal: `src/lib/audio/recording.ts` (421 loc) + `src/lib/audio/denoise.ts` (216 loc).

### 4.1 MediaRecorder (codec/bitrate)

`startMicRecording()` (`recording.ts:64-120`):
```ts
navigator.mediaDevices.getUserMedia({ audio: {
  channelCount: 1,
  echoCancellation: false,   // explícitamente OFF
  noiseSuppression: false,   // explícitamente OFF
  autoGainControl: false,    // explícitamente OFF
}})

pickRecordingMime(): primer soportado de
  ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
```

Sin forzar bitrate (default del navegador, típicamente 128 kbps Opus). Decodifica al detener con `AudioContext.decodeAudioData()`.

### 4.2 Resample

`resampleMono(buf, targetRate)` (`recording.ts:270-289`): OfflineAudioContext con target rate (default 44100 Hz, ver `DEFAULT_PROC:targetSampleRate`). Si multi-canal, mezcla downmix: `out[i] += d[i] / numberOfChannels` (sumatoria divida). Usa resampler interno del navegador (típicamente sinc-interpolation).

### 4.3 High-Pass 80 Hz

`applyHighpass(buf, hz)` (`recording.ts:291-303`): `BiquadFilterNode` type='highpass', frequency=80 Hz, Q=0.707 (Butterworth 2º orden, -3 dB en 80 Hz, pendiente -12 dB/oct). Default `hpHz: 80` en `DEFAULT_PROC` (`recording.ts:31`). Remueve DC y rumble.

### 4.4 VAD (Voice Activity Detection)

`findVadBounds(data, sampleRate, opts)` (`recording.ts:184-268`):
- **Ventana**: 10 ms (`winSamples = sampleRate * 0.010`), **hop 5 ms** (`hopSamples = sampleRate * 0.005`)
- **Features por frame**: RMS en dBFS y ZCR (zero-crossing rate)
- **Piso de ruido adaptativo**: `percentil 10` de RMS finitos (`recording.ts:208-211`)
- **Umbral primario**: `primaryThrDb = max(noiseDb + noise_margin, abs_floor)`; defaults: `noiseMarginDb = 12`, `absFloorDbfs = -50`
- **Asistencia ZCR para fricativas**: `zcrHigh = percentil 70 de ZCR` (`recording.ts:216-217`). Si `rmsDb > fricThrDb (= primary-6)` AND `zcr > zcrHigh` → considera voz
- **Cierre morfológico**: rellena huecos <80 ms (`minSilenceMs: 80`) entre frames voz (`recording.ts:240-253`)
- **Apertura morfológica**: descarta islas <30 ms (`minSpeechMs: 30`) (`recording.ts:225-236`)
- **Márgenes**: pre 30 ms, post 50 ms (`vadPreMarginMs: 30`, `vadPostMarginMs: 50`)
- Si no detecta voz → retorna `null` y el pipeline hace fallback a `findTrimBounds` RMS fijo

### 4.5 Trim RMS fijo (fallback)

`findTrimBounds(data, sampleRate, thresholdDbfs)` (`recording.ts:150-167`): ventana 20 ms, umbral `trimSilenceDbfs: -45`. Avanza por bloques, marca primer bloque > umbral como start-1win, último como end+2win.

### 4.6 Fade

Lineal, rampa `i/fadeSamples` para los primeros/últimos `fadeSamples` samples (`recording.ts:348-352`):
```ts
fadeSamples = min(floor(fadeMs/1000 * sampleRate), floor(len/2))
// Default fadeMs: 10
for (let i = 0; i < fadeSamples; i++) {
  const g = i / fadeSamples
  trimmed[i] *= g
  trimmed[trimmed.length - 1 - i] *= g
}
```

**Lineal**, no cosenoidal.

### 4.7 Normalización RMS a -20 dBFS

`recording.ts:354-366`:
```ts
const currentRms = computeRmsDbfs(trimmed)  // 20·log10(sqrt(Σv²/N))
const deltaDb = o.targetRmsDbfs - currentRms  // target = -20
let gain = Math.pow(10, deltaDb / 20)
// Clamp anti-clip:
const peakAfter = peak * gain
if (peakAfter > 0.99) gain *= 0.99 / peakAfter
for (let i = 0; i < trimmed.length; i++) trimmed[i] *= gain
```

Fórmula: `gain = 10^((target_rms - current_rms)/20)`. Peak clamp en 0.99 para evitar clipping.

### 4.8 Denoise espectral STFT

`src/lib/audio/denoise.ts`:
- **FFT**: radix-2 iterativo in-place (`denoise.ts:30-64`), N=1024 default (`DEFAULT_DENOISE.fftSize: 1024`)
- **Ventana**: Hann, `win[i] = 0.5 - 0.5·cos(2π·i/(N-1))` (`denoise.ts:96-97`)
- **Hop**: `N * 0.25 = 256 samples` (hopRatio 0.25, overlap 75%)
- **Perfil de ruido**: percentil 20 de magnitud por bin a través del tiempo (`noisePercentile: 0.20`) — no requiere silencio inicial limpio (`denoise.ts:121-128`)
- **Gate por bin**: `m_masked = mags[f][k] > noise[k] * 10^(6/20) ? 1 : 10^(-12/20)` (`denoise.ts:130-140`); `gateThresholdDb: 6`, `reductionDb: -12`
- **Smoothing frecuencia**: promedio dentro half-width = 2 bins (`freqSmoothBins: 2`, líneas 143-156) — reduce musical noise
- **Smoothing tiempo**: promedio dentro half-width = 2 frames (`timeSmoothFrames: 2`, líneas 159-174)
- **iSTFT**: IFFT con espejo Hermítico + overlap-add + normalización por `Σwin²` (`denoise.ts:176-206`)

Integrado en `processClip` tras HP y antes de VAD (`recording.ts:320-327`), flag `denoise: true` default.

### 4.9 Export WAV

`encodeWav(buf)` (`recording.ts:378-414`): WAV PCM 16-bit mono little-endian. Header RIFF canónico (44 bytes). Escribe a `appDataDir/stimuli/list{id}_{pos}_{token}.wav` via `@tauri-apps/plugin-fs`.

### 4.10 Análisis fonético ES

`src/lib/es/phonetics.ts` (389 loc):
- `syllabify(raw)` (línea 64-139): reglas ES — digrafos `ch/ll/rr/qu` como consonante única; clusters inseparables `pr/pl/br/bl/tr/dr/fr/fl/gr/gl/cr/cl`; diptongo si débil+fuerte sin tilde o dos débiles distintas; hiato si dos fuertes o débil tildada. Nota: "~95% correcto, casos borde tipo 'idea' fallan" (docs/ROADMAP_PAC.md:584).
- `stressedSyllableIndex(word, syllables)` (línea 50-59): tilde manda; sino penúltima si termina en vocal/n/s, última otherwise.
- `classifyStress(count, idx)` (línea 159-166): aguda (oxítona, fromEnd=0) / llana-grave (paroxítona, 1) / esdrújula (proparoxítona, 2) / sobresdrújula.
- `analyze(raw) → PhonemeAnalysis`: syllables, syllable_count, stressed_index, stress_type, has_written_accent, vowels[], consonants[] (digrafos agrupados), has_diphthong, has_hiato, disilabo (===2), issues[].
- `classifyConsonant(letter, nextChar?) → {manner, place, voiced}`: oclusiva/fricativa/africada/nasal/lateral/vibrante_simple/vibrante_multiple/aproximante × bilabial/labiodental/dental_alveolar/palatal/velar/glotal. Desambigua c/g según vocal siguiente (e/i = pal → fricativa; a/o/u = oclusiva).
- `articulatoryStats(tokens)`: agrega manner/place/voiced, cuenta onset/coda/open_syllables/closed_syllables.

### 4.11 Balance fonémico vs RAE/CREA

Componente `PhonemeBalanceChart.tsx` (toggle en editor SRT, `docs/ROADMAP_PAC.md:591-597`):
- Barras horizontales consonantes (14 top + extras observadas) con línea esperada ES (RAE/CREA)
- Barras vocales (a/e/i/o/u)
- Balance articulatorio (por modo, por punto)
- Mini-cards estructura silábica (% abiertas CV vs cerradas CVC+; ES esperado ~70% abiertas) y sonoridad
- **Balance score 0-100 por grupo**: `100 - Σ|obs-esperado|`. Etiquetas: balanceado ≥85, aceptable 70-85, desbalanceado 50-70, muy desbalanceado <50
- Dataset: frecuencias esperadas hardcoded en componente; documentación declara "RAE/CREA" como fuente (README.md:104; ROADMAP_PAC.md:596) — el valor exacto de esas frecuencias y el link al corpus NO están en el código. **NO ENCONTRADO archivo dataset exacto** (RAE CREA es el corpus referido, pero el JSON o la tabla de frecuencias fonémicas no aparece en el repo; están inlineados en el componente `PhonemeBalanceChart.tsx`).

---

## 5. Timing Web Audio API

### 5.1 Sample-accurate

El motor usa exclusivamente el reloj del AudioContext (`ctx.currentTime`), no `setTimeout`/`setInterval`, para sincronización de eventos. Esto garantiza timing sample-accurate según la especificación Web Audio API:

- `engine.ts:258`: `const startTime = ctx.currentTime + 0.05` (offset 50 ms de seguridad)
- `engine.ts:300-301`: `const t0 = startTime + tone.startOffset_ms / 1000; const t1 = t0 + tone.duration_ms / 1000`
- Todos los `setValueAtTime`, `linearRampToValueAtTime`, `source.start(t)`, `source.stop(t)` usan valores absolutos de AudioContext time.

### 5.2 Cadena AudioNodes tono + ruido

En `playSequence` (`engine.ts:242-393`):

```
 OscillatorNode (sine, freq)          AudioBufferSourceNode (pink/white loop)
         │                                         │
         │                                         ▼
         │                           BiquadFilter (LP ssn / BP narrow) [opcional]
         │                                         │
         ▼                                         ▼
   toneGain (GainNode: envelope + gap cuts)   noiseGain (envelope)
         │                                         │
         └──────────┬───────────┬──────────────────┘
                    ▼           ▼
              leftNode      rightNode  (GainNode: gain L/R con phase_invert_right * -1)
                    │           │
                    ▼           ▼
               ChannelMerger(2)
                    │
                    ▼
              AudioContext.destination
```

Mezcla tono + ruido simultánea: si `ToneDefinition.noise_mix` está presente (MLD), se crea rama paralela `nGain → nNode` con envelope idéntica (`engine.ts:359-382`). Ruido nunca se invierte de fase.

### 5.3 Sincronía dicótica L/R

Tres mecanismos:

1. **Patrones con `|`** (tonos no-verbales): `buildSequencePlan("LHL|HLH", config)` (`engine.ts:187-200`) crea dos side-plans paralelos. Cada tono se schedula con su propio `t0` pero todos referenciados al mismo `startTime + 0.05`. `totalDuration = max(left.total, right.total)`.
2. **`playStimulusPair(bufferL, bufferR, level_db, opts)`** (`engine.ts:704-761`): usado por Dichotic Digits. Mismo `startAt = ctx.currentTime + 0.05` para ambos `src.start(startAt)`. `onended` en el buffer más largo.
3. **TOJ** (`tones.L.ear = 'left'`, `tones.R.ear = 'right'`): `earGains(ear)` mapea a `{l:1, r:0}` o `{l:0, r:1}` en GainNodes (`engine.ts:236-240`, líneas 331-354).

Sample-accurate porque Web Audio sched todos los eventos en el mismo AudioContext clock.

### 5.4 Manejo sample rate 44.1 / 48 kHz

`getAudioContext()` (`engine.ts:28-33`) fuerza `sampleRate: 48000, latencyHint: 'interactive'` al crear el AudioContext compartido. Si el hardware no soporta 48k el navegador lo resamplea transparentemente (pero dependiendo del driver puede haber overhead). Buffers de ruido se cachean por sample rate (`engine.ts:206, 216`). Estímulos grabados se resamplean a 44.1 kHz en processClip (`targetSampleRate: 44100`) — esto genera asimetría: buffer grabado a 44.1k se reproduce en un contexto a 48k (resample implícito del navegador al reproducir).

### 5.5 Mediciones empíricas de latencia

**NO ENCONTRADO**. No hay archivos de test/benchmark que midan latencia empírica (getOutputTimestamp, performance.now vs audioTime). La arquitectura confía en la garantía sample-accurate de Web Audio API sin verificación.

---

## 6. Runners adaptativos

### 6.1 TestRunner (patterns — FPT/PPS/DPS/MEM_SEQ/MLD/GIN/etc.)

`src/lib/audio/runner.ts` (132 loc). Paradigma simple: cola de items (práctica + test) con respuesta binaria.
- Construcción (línea 30-45): items de `config.practice_sequences` + `config.test_sequences`, cada item un `pattern` (string como `"LHL"`).
- `play()` → `playSequence(pattern, config, {ear, refDb, curve})` (línea 60-69).
- `answer(given)`: `correct = given.toUpperCase() === pattern.toUpperCase()` (línea 76). No hay adaptatividad — todos los trials son fijos.
- Score: `score = correct / total` por fase (línea 126-128).

### 6.2 Hughson-Westlake modificado / SRT — Carhart-Jerger 1959

`SRTController` en `src/lib/audio/srtRunner.ts` (371 loc). Bracketing descendente-ascendente.

**Paso inicial + reducción**: `start_level_db: 50` (dB HL). `step_down_db: 10` (tras pasar), `step_up_db: 5` (tras fallar). Configurables por test.

**Criterio por nivel**: `words_per_level: 4`; `threshold_pass_ratio: 0.5` → pasa si ≥2/4 correctos (`srtRunner.ts:141-147`).

**Algoritmo** (`advanceIfLevelComplete`, `srtRunner.ts:282-350`):
1. Si nivel completo (4 presentados) y pasó → `next = current - step_down_db` (desciende 10 dB).
2. Si falló y ya hay un `pass` previo → cerrar con `srtDb = min(passes)`, `ended_reason='bracketed'`.
3. Si falló sin pass previo → `next = current + step_up_db`.
4. Bracketing: hay algún `pass` AND algún `fail < pass` → cerrar con `srtDb = min(passes)`.
5. Pisos: `next < min_level_db` → `ended_reason='floor'`; `next > max_level_db` → `'ceiling'`; `trials >= max_total_trials` (40) → `'max_trials'`.

**Cutoff rules custom** (`srtRunner.ts:285-311`):
- `{kind:'bracketing'}` (default)
- `{kind:'fixed_trials', trials: N}` — termina al llegar a N trials totales.
- `{kind:'plateau', consecutive_levels: N, delta_db: X}` — termina si los últimos N niveles están dentro de X dB; SRT = media aritmética.

**Cálculo de umbral**: `srtDb = min(niveles que pasaron)`, que equivale al nivel más bajo con ≥50% reconocimiento que tiene fail por debajo.

**Referencias en pack** (`logoaud-latam-v1.json`): Hughson-Westlake 1944; Carhart-Jerger 1959 (JSHD 24:330); ASHA 1988.

### 6.3 HINT — Nilsson-Soli-Sullivan 1994

`HINTController` en `src/lib/audio/hintRunner.ts` (319 loc). Adapta SNR por bracketing SNR-based:

- `start_snr_db: 5`, `noise_level_db: 60 dB SPL`, `noise_type: 'pink'`
- `sentences_per_level: 4`, `threshold_pass_ratio: 0.5`
- `step_down_db: 4` (tras pasar; SNR menor = más difícil), `step_up_db: 2` (tras fallar)
- `min_snr_db: -10`, `max_snr_db: 20` (approx; bounds configurables)
- `voiceLevel = noise_level_db + snr_db` (`hintRunner.ts:216`)

**Scoring**: cada trial es una frase; pasa si `correctKeys.length / keywords.length >= threshold_pass_ratio` (`hintRunner.ts:249-250`). Paciente marca qué keywords entendió (chips clickables en UI).

**Algoritmo** (`advanceIfLevelComplete`, `hintRunner.ts:257-298`): idéntico a SRT pero sobre SNR. Bracketing: pass y fail<pass → `srtSnrDb = min(passes)`.

**Referencias**: Nilsson 1994 (JASA 95:1085). Interpretación pack: normal adulto ~-3 a -6 dB SNR.

### 6.4 Matrix 5-AFC — Hochmuth 2012

`MatrixController` en `src/lib/audio/matrixRunner.ts` (315 loc).

- Grid 5 columnas × 10 palabras. Estructura de frase "Nombre-Verbo-Número-Objeto-Adjetivo".
- `columns: 5`, `inter_word_gap_ms: 80`
- `start_snr_db: 0`, `noise_level_db: 65 dB SPL`, `noise_type: 'pink'`
- `sentences_per_level: 4`, `threshold_pass_ratio: 0.6` (3/5 correctas)
- `step_down_db: 4`, `step_up_db: 2`

**Trial**: elige aleatoriamente 1 palabra de cada columna (`pickRandom`, `matrixRunner.ts:46-48`) → concatena con 80 ms gap en ruido continuo via `playStimulusSequenceWithNoise` (`engine.ts:769-854`). UI: grid 5×10 clickeable en MatrixRun.tsx; paciente marca la palabra percibida por columna. `correct_count = Σ (given[i] === expected[i])`. Pasa si ratio ≥0.6.

**Algoritmo adaptativo**: idéntico patrón a HINT. `srtSnrDb = min(passes)` al bracketear.

**Referencias**: Hochmuth et al 2012 (Int J Audiol 51:536), Kollmeier et al 2015 (multilingual).

### 6.5 Dichotic Digits — Musiek 1983 / Strouse-Wilson 1999

`DichoticDigitsController` en `src/lib/audio/dichoticDigitsRunner.ts` (401 loc). **No adaptativo** — es task de reconocimiento a nivel fijo.

- Nivel fijo: `level_db: 55 dB HL`
- `num_pairs: 20`, `digits_per_ear: 2`, `isi_ms: 300`
- Modo: `free` (recuerda todos) o `directed` (solo un oído, alterna por bloque)

**Generación de pares** (`generatePairs`, `dichoticDigitsRunner.ts:89-125`):
- Aleatoria (default): por cada par, shuffle del pool 8 dígitos, toma 2 para L y 2 para R.
- Fija: `params.fixed_pairs[]` (investigador-defined).
- Catch trials: `{enabled, count, placement}` → inserta pares mono (solo un oído activo) en posiciones random / every_n / start_end.

**Block order directed** (`firstEarFor`, `dichoticDigitsRunner.ts:295-304`):
- `lrlr`: alterna L,R,L,R,…
- `llrr`: primera mitad L, segunda R.
- `interleaved`: alterna como lrlr.

**Scoring** (`getScores`, línea 359-400):
- Per-pair: `leftCorrect`, `rightCorrect` booleanos por par (`answer(L,R)`).
- Per-position/per-digit: array por dígito (`answerDigit(side, pos, correct)`, línea 307-317).
- Asymmetry: `(rPct - lPct)`. REA normal +5 a +10%.
- Catch trials: scoring separado para validar atención.

**Engine**: `playStimulusPair(bufferL, bufferR, level_db, opts)` — ambos start en mismo `ctx.currentTime + 0.05` (sample-accurate sincronía L/R).

**Referencias**: Musiek 1983 (Ear Hear 4:79), Kimura 1961, Musiek et al 1991 (Am J Otol 12:109), Strouse-Wilson 1999, Jerger-Martin.

### 6.6 Bracketing genérico

Patrón común en SRT/HINT/Matrix:

```
while (not done) {
  presentN(words/sentences) at currentLevel
  pass = correct/N >= threshold_pass_ratio
  if pass and exists fail < pass in history:
    threshold = min(passes); BRACKETED
  elif pass:
    next = current - step_down_db
  else:  // fail
    if exists pass in history: threshold = min(passes); BRACKETED
    else: next = current + step_up_db
  check bounds (floor/ceiling/max_trials)
}
```

Diferencias entre runners: SRT opera en dB HL, HINT/Matrix en SNR dB (voice-noise). SRT trabaja palabras (binary correct), HINT/Matrix trabajan frases (ratio de keywords/palabras correctas ≥ threshold → trial pass).

---

## 7. Tests automatizados / validación

### 7.1 Suite de tests unitarios

**NO EXISTE**. No hay archivos `*.test.ts`, `*.spec.ts`, `vitest.config*`, `jest.config*` en el repo (comprobado con búsqueda). No hay framework de tests instalado en `package.json`.

### 7.2 CI

`.github/workflows/ci.yml`:
- Trigger: push/PR a `main` con cambios en `src/**`, `src-tauri/**`, etc.
- Pasos: `pnpm install` → `pnpm tsc -b` (TypeScript typecheck) → `pnpm build` (Vite) → `cargo check` (Rust typecheck) → `cargo clippy` (lint Rust, continue-on-error).
- **No corre tests** — sólo verifica que compila.

`.github/workflows/release.yml`: build Linux (AppImage + binario raw) y Windows (NSIS + MSI, con firma opcional vía `WINDOWS_CERT_BASE64`/`WINDOWS_CERT_PASSWORD` secrets). Timestamp con digicert. Workflow SignPath (`release-signpath.yml.disabled`) listo pero inactivo.

### 7.3 Mediciones empíricas timing / precisión

**NO ENCONTRADO**. Ni benchmarks de latencia/jitter, ni tests de precisión de bracketing, ni validación contra referencia. Confianza en:
- Especificación Web Audio API (timing sample-accurate)
- Correctitud de implementación por inspección y uso clínico

Esto es una limitación relevante para justificar uso clínico.

---

## 8. Referencias bibliográficas en código

Extraídas de los 17 packs JSON (`audiopac-assets/packs/*.json` campo `references` tanto en raíz como dentro de cada test), más comentarios en código y roadmap. Autoría original; los packs son implementaciones.

### 8.1 PAC patrones temporales / frecuenciales

- Pinheiro ML, Ptacek PH (1971). Reversals in the perception of noise and tone patterns. J Acoust Soc Am 49:1778-1782. DOI: 10.1121/1.1912589.
- Musiek FE, Pinheiro ML (1987). Frequency patterns in cochlear, brainstem, and cerebral lesions. Audiology 26:79-88.
- Musiek FE, Baran JA, Pinheiro ML (1990). Duration pattern recognition in normal subjects and patients with cerebral and cochlear lesions. Audiology 29:304-313.
- Musiek FE (1994). Frequency (pitch) and duration pattern tests. J Am Acad Audiol 5:265-268.
- Musiek FE (2002). The frequency pattern test: a guide. Hear J 55(6):58.
- Bellis TJ (2003). Assessment and management of central auditory processing disorders (2nd ed). Delmar.
- Pinheiro ML, Musiek FE (1985). Assessment of central auditory dysfunction: Foundations and clinical correlates. Williams & Wilkins.

### 8.2 Limens diferenciales / umbrales psicofísicos

- Moore BCJ (1973). Frequency difference limens for short-duration tones. J Acoust Soc Am 54:610-619.
- Sek A, Moore BCJ (1995). Frequency discrimination as a function of frequency, measured in several ways. J Acoust Soc Am 97:2479-2486.
- Abel SM (1972). Duration discrimination of noise and tone bursts. J Acoust Soc Am 51:1219-1223.
- Jesteadt W, Wier CC, Green DM (1977). Intensity discrimination as a function of frequency and sensation level. J Acoust Soc Am 61:169-177.
- Tallal P (1980). Auditory temporal perception, phonics, and reading disabilities in children. Brain Lang 9:182-198.

### 8.3 Procesamiento temporal fino (gap, TOJ)

- Plomp R (1964). Rate of decay of auditory sensation. J Acoust Soc Am 36:277-282.
- Hirsh IJ (1959). Auditory perception of temporal order. J Acoust Soc Am 31:759-767.

### 8.4 Ruido y GIN

- Musiek FE, Shinn JB, Jirsa R, Bamiou DE, Baran JA, Zaida E (2005). GIN (Gaps-In-Noise) test performance in subjects with confirmed central auditory nervous system involvement. Ear Hear 26:608-618.
- Keith RW (2000). Random Gap Detection Test. Auditec, St. Louis.
- Shinn JB, Chermak GD, Musiek FE (2009). GIN (Gaps-In-Noise) performance in the pediatric population. J Am Acad Audiol 20:229-238.

### 8.5 Dicótica y binaural

- Kimura D (1961). Cerebral dominance and the perception of verbal stimuli. Can J Psychol 15:166-171.
- Matzker J (1959). Two new methods for the assessment of central auditory functions in cases of brain disease. Ann Otol Rhinol Laryngol 68:1185-1197.
- Musiek FE (1983). Assessment of central auditory dysfunction: the dichotic digit test revisited. Ear Hear 4:79-83.
- Musiek FE, Gollegly KM, Kibbe KS, Verkest-Lenz SB (1991). Proposed screening test for central auditory disorders: follow-up on the dichotic digits test. Am J Otol 12:109-113.
- Strouse A, Wilson RH (1999). Dichotic digit test (varios papers, citado en pack dichotic-digits-es-v1).
- Blauert J (1997). Spatial Hearing: The Psychophysics of Human Sound Localization. MIT Press.
- Mills AW (1958). On the minimum audible angle. J Acoust Soc Am 30:237-246. (citado como Mills 1958 en pac-binaural-v1).

### 8.6 MLD

- Hirsh IJ (1948). The influence of interaural phase on interaural summation and inhibition. J Acoust Soc Am 20:536-544.
- Licklider JCR (1948). The influence of interaural phase relations upon the masking of speech by white noise. J Acoust Soc Am 20:150-159.
- Durlach NI (1963). Equalization and cancellation theory of binaural masking-level differences. J Acoust Soc Am 35:1206-1218.
- Wilson RH, Moncrieff DW, Townsend EA, Pillion AL (2003). Development of a 500-Hz masking-level difference protocol for clinic use. J Am Acad Audiol 14:1-8.
- Noffsinger D et al. (1972). Auditory and vestibular aberrations in multiple sclerosis. Acta Otolaryngol Suppl 303:1-63.

### 8.7 Habla en ruido / SRT / HINT / Matrix

- Nilsson M, Soli SD, Sullivan JA (1994). Development of the Hearing in Noise Test for the measurement of speech reception thresholds in quiet and in noise. J Acoust Soc Am 95:1085-1099.
- Killion MC, Niquette PA, Gudmundsen GI, Revit LJ, Banerjee S (2004). Development of a quick speech-in-noise test for measuring signal-to-noise ratio loss. J Acoust Soc Am 116:2395-2405.
- Killion MC (1997). Hearing aids: past, present, future. Ear Hear 18:1-2.
- Humes LE (2007). The contributions of audibility and cognitive factors to the benefit provided by amplified speech to older adults. J Am Acad Audiol 18:590-603.
- Hochmuth S, Brand T, Zokoll MA, Castro FJ, Wardenga N, Kollmeier B (2012). A Spanish matrix sentence test for assessing speech reception thresholds in noise. Int J Audiol 51(7):536-544.
- Kollmeier B et al (2015). The multilingual matrix test: Principles, applications, and comparison across languages. Int J Audiol 54 Suppl 2:3-16.
- Byrne D et al (1994). An international comparison of long-term average speech spectra. J Acoust Soc Am 96:2108-2120.
- Huarte A (ref. validación ES HINT, citado en hint-es-v1 sin detalle).

### 8.8 Corpus Sharvard

- Aubanel V, García Lecumberri ML, Cooke M (2014). The Sharvard Corpus: A phonemically-balanced Spanish sentence resource for audiology. Int J Audiol 53(9):633-641. Zenodo: https://zenodo.org/records/3547446.

### 8.9 SRT bisílabos / logoaudiometría

- Tato JM (1949). Logoaudiometría. Libros de la Facultad, Buenos Aires.
- ASHA (1988). Guidelines for determining threshold level for speech. ASHA 30:85-89.
- Carhart R, Jerger JF (1959). Preferred method for clinical determination of pure-tone thresholds. J Speech Hear Disord 24:330-345.
- Hughson W, Westlake HD (1944). Manual for program outline of rehabilitation of aural casualties. Trans Am Acad Ophthalmol Otolaryngol 48(suppl).
- McCullough JA, Wilson RH, Birck JD, Anderson LG (1994). A multimedia Spanish word recognition test. Am J Audiol 3:19-22.
- Lipski JM (2008). Varieties of Spanish in the United States. Georgetown University Press.
- Wilson RH, McArdle R (2005). Speech signals used to evaluate functional status of the auditory system. J Rehabil Res Dev 42(suppl):79-94.

### 8.10 PALPA / diagnóstico fonémico

- Kay J, Lesser R, Coltheart M (1992). PALPA: Psycholinguistic Assessments of Language Processing in Aphasia. Lawrence Erlbaum.
- Valle F, Cuetos F (1995). EPLA: Evaluación del Procesamiento Lingüístico en la Afasia. Lawrence Erlbaum.
- Ellis AW, Young AW (1988). Human Cognitive Neuropsychology. Lawrence Erlbaum.
- Franklin S (1989). Dissociations in auditory word comprehension: Evidence from nine fluent aphasic patients. Aphasiology 3:189-207.

---

## 9. Limitaciones técnicas

### 9.1 Explícitas en docs

Del README.md (línea 92): "Uso investigativo / screening. Sin acoplador 6cc/2cc no cumple ANSI S3.6 ni IEC 60645-1."

Del roadmap (líneas 102-104): "Sin acoplador el valor es aproximado, no cumple ANSI S3.6 / IEC 60645-1 para uso médico legal. Etiqueta en UI: 'Uso investigativo / screening. No diagnóstico clínico certificado.' Calibrar por frecuencia idealmente (curva 250–8000 Hz), no sólo 1 kHz — auriculares no son planos."

### 9.2 Inferidas (código)

1. **Sample rate mixing**: AudioContext a 48 kHz, estímulos grabados resampleados a 44.1 kHz → al reproducir hay resample implícito del navegador. Posible jitter sub-muestra.
2. **Volumen SO**: no se puede leer volumen del sistema operativo desde WebView (limitación del sandbox). Bloqueo depende de instrucción al usuario y del pre-session check. Usuario puede bajar volumen post-calibración y la app no se entera (`docs/ROADMAP_PAC.md:141`).
3. **Resample WAV**: todos los stimuli se fuerzan a 44.1 kHz incluso si vienen a 48k (Sharvard) — pérdida de fidelidad en octava superior.
4. **Device ID**: `deviceId` del navegador cambia entre perfiles browser/sesiones en algunos casos — no es estable 100%. El mismatch detection puede dar falsos positivos.
5. **No hay hash criptográfico** sobre el device; es el string crudo (`device.ts:17`).
6. **`playStimulusBuffer` fija freq=1 kHz para mapear SPL** (`engine.ts:498`). El habla es banda ancha, usar ref@1 kHz es aproximación.
7. **Ruido calibración**: fallback heurístico (-5 white, -15 pink, -20 ssn) es grueso si no hay `noise_calibration_points` (`engine.ts:101-103`).
8. **Denoise** es spectral subtraction básico (gate + smoothing), no ML; musical noise aunque mitigado.
9. **VAD** puede fallar para fonemas muy débiles (fricativas sordas en ambiente ruidoso) — fallback a RMS fijo en ese caso.
10. **MLD** implementado como task de detección presente/ausente, no adaptativo. No reporta MLD en dB sino accuracy en C/A.
11. **Silabificación ES** ~95% correcta; casos borde tipo "idea" fallan (roadmap:584).
12. **Balance fonémico**: frecuencias esperadas hardcoded en componente, no vinculadas explícitamente a CREA/RAE con DOI. Score `100 - Σ|diff|` es heurístico, no chi-cuadrado normalizado (mejora pendiente, roadmap:735-737).
13. **No tests automatizados** — solo typecheck y build en CI.
14. **No validación clínica cruzada** publicada — los umbrales normativos son los de los papers originales, no validados en la implementación AudioPAC.
15. **Navegador/Tauri específico**: el backend WebKitGTK (Linux) vs WebView2 (Windows) puede tener diferencias sutiles en Web Audio precision; no hay tests cross-platform.
16. **Hardware consumer**: auriculares no acústicamente planos; sin acoplador la calibración por frecuencia es solo con el sonómetro en el oído → posición-dependiente.

### 9.3 Comparación honesta con audiómetros certificados ANSI S3.6 / IEC 60645-1

| Aspecto | ANSI S3.6 / IEC 60645-1 | AudioPAC |
|---|---|---|
| Rango frecuencias PTA | 125-8000 Hz con tolerancias ±3 dB | 250-8000 Hz típico, tolerancia no verificada |
| Calibración por acoplador | 6cc (supra) / 2cc (intra), IEC 60318 | **No soporta acoplador**, medición en campo abierto con sonómetro |
| Nivel máximo output | ≥100 dB HL | limitado por hardware consumer (~90 dB HL efectivo) |
| Linealidad | ±0.5 dB en toda la gama | sin verificación formal |
| THD | <2% @ 1 kHz | no medido — depende del DAC/driver |
| Transductores | audiométricos (TDH-39, TDH-50P, ER-3A) | consumer headphones (diferencia 3-5 dB L/R típica) |
| Attenuator | pasos 5 dB, pueden ser 1 o 2 dB | software, resolución arbitraria pero depende de mantisa flotante |
| Masking | generador independiente calibrado | software, contralateral opcional en SRT v2 |
| Certificación clínica | obligatoria, calibración anual | NO — advertencia explícita "uso investigativo / screening" |
| Interferencia electromagnética | EMC/EMI testing | NO aplicable (software en hardware consumer) |

AudioPAC es apropiado para **screening, investigación, docencia y triage**, no para **diagnóstico clínico legal**. README y docs lo explicitan.

---

## 10. Metadatos para cita del software

| Campo | Valor |
|---|---|
| Versión actual | 0.3.0 (`package.json:4`, `src-tauri/Cargo.toml:3`, `src-tauri/tauri.conf.json:4`) |
| Fecha primer commit público | 2026-04-17 10:07:53 -0400 (commit `856494f` "feat: scaffold AudioPAC") |
| Fecha último commit al momento de este documento | 2026-04-18 12:53:57 -0400 (commit `a86da41`) |
| Nº de commits totales | 42 (`git log --oneline \| wc -l`) |
| Nº de contributors | 1 (Nicolás Baier Quezada, 42 commits — `git shortlog -sne`) |
| Licencia | MIT (`LICENSE`, `package.json` no tiene campo license pero `Cargo.toml:7` declara MIT; `README.md:187` confirma) |
| Repositorio principal | https://github.com/Debaq/audiopac |
| Repositorio assets | https://github.com/Debaq/audiopac-assets |
| Identificador app | `com.audiopac.app` (`tauri.conf.json:5`) |
| Ventana default | 1280×800 (min 1024×700, `tauri.conf.json:14-17`) |
| Plataformas build | Linux AppImage, Windows NSIS + MSI (`tauri.conf.json:37`) |
| Node.js required | 20+ (README), pnpm 10+ |
| Rust required | 1.77.2+ (`Cargo.toml:9`) |
| Zenodo DOI | **TO-DO — NO EXISTE aún**. Roadmap no menciona Zenodo DOI del software (solo el DOI del corpus Sharvard externo: Zenodo 3547446). Para paper JOSS debería crearse Zenodo deposit con tag `v0.3.0` → obtener DOI tipo `10.5281/zenodo.XXXXXXX`. |

---

## Resumen ejecutivo

AudioPAC (v0.3.0, Tauri v2 + React 19 + SQLite, MIT) es un software clínico open-source de evaluación del Procesamiento Auditivo Central y logoaudiometría que implementa **17 paquetes instalables** cubriendo FPT, PPS, DPS, DPT, memoria secuencial, limens (DLF/DLD/DLI), procesamiento temporal (GAP/TOJ/FGC), binaural (ILD/Dichotic NV/Fusion), ruido (GIN/RGD/NBN), MLD, SRT LatAm y US-ES, Dichotic Digits ES, HINT, SinB-SSN, Matrix 5-AFC (Hochmuth), PALPA-E pares mínimos, y corpus Sharvard ES (Aubanel 2014, 700 frases). La arquitectura separa **motor + calibración + grabador** del contenido clínico, que vive en el repo hermano `audiopac-assets` y se instala runtime con verificación SHA-256. El motor usa Web Audio API con timing sample-accurate (AudioContext @ 48 kHz), envolventes lineales, ruido rosa Paul Kellet, SSN = rosa + LP 1 kHz Q=0.707, inversión de fase para MLD, pares dicóticos con mismo `startTime`. Grabación: MediaRecorder WebM/Opus sin EC/NS/AGC → resample 44.1 kHz → HP 80 Hz Butterworth 2º orden → denoise STFT spectral-gate (N=1024, hop 256, Hann, noise percentile 20, gate 6 dB, reduction -12 dB, smoothing freq/tiempo 2 bins/frames) → VAD RMS+ZCR con piso adaptativo percentil 10 y asistencia fricativa ZCR percentil 70, cierre 80 ms / apertura 30 ms, márgenes 30/50 ms → fade lineal 10 ms → norma RMS -20 dBFS con clamp peak 0.99 → WAV PCM 16-bit. Calibración multi-frecuencia con interpolación log₂, calibración de ruido por tipo (white/pink/ssn), snapshot inmutable por sesión, device tracking por `deviceId` crudo (no hash), expiración 6 meses. Runners adaptativos SRT/HINT/Matrix comparten bracketing descendente-ascendente con steps y thresholds configurables; Dichotic Digits no-adaptativo con per-pair/per-position/per-digit scoring y catch trials. Análisis fonético ES propio (silabificación, clasificación articulatoria, balance vs RAE/CREA con score 0-100) integrado al editor SRT. **Inconsistencias MD vs código**: (a) README menciona "PIN opcional" y `pin_hash`; código confirma columna SHA-256 pero el hash real se hace en frontend (no verificado en detalle aquí); (b) Roadmap sección 1.1 dice "FPT cabe en esquema actual" y PPS_STD aparece duplicado — el código tiene dos packs: `pac-patterns-v1` (FPT 880/1122) y `pps-pinheiro-v1` (PPS 880/1430), coherente con el texto final de la sección 6.8; (c) README declara 17 packs, index.json confirma 17 packs publicados; (d) Roadmap dice "MLD_STD con Sπ a -10 dB" — código confirma (C.level_db=50 vs A.level_db=60). **Limitaciones críticas para revisores**: no hay tests automatizados (CI solo compila), no hay mediciones empíricas de latencia/jitter, normativas clínicas son las originales sin validación AudioPAC-específica, no cumple ANSI S3.6 / IEC 60645-1, no existe Zenodo DOI aún (obligatorio para JOSS).
