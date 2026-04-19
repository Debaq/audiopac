# Roadmap — Pruebas de Procesamiento Auditivo Central (PAC) + Logoaudiometría + Calibración

Documento vivo. Agrupa: pruebas PAC factibles, módulo de grabación de estímulos verbales, módulo de calibración con sonómetro.

---

## 1. Pruebas PAC con capacidades actuales

**Capacidades motor audio hoy** (`src/lib/audio/engine.ts`):

- Osciladores sinusoidales, freq/dur/ISI/nivel dB configurables por tono
- Ruteo L/R/binaural independiente
- Envelope lineal (attack/release)
- Patrones como strings (secuencias discretas de tokens)
- Sin ruido, sin habla, sin filtros, sin presentación simultánea L≠R

### 1.1 Factibles ya, sin tocar motor (solo plantilla `CUSTOM`) ✅ hecho (migración 004)

| Prueba | Descripción | Notas | Estado |
|---|---|---|---|
| **FPT** (Frequency Pattern Test / Pinheiro) | Variante PPS con 3 tonos, 880/1122 Hz, 150 ms | Cabe en esquema actual | ✅ `FPT_STD` |
| **DPT** | Duration Pattern Test | Ya soportado como DPS | ✅ `DPT_LONG` |
| **DLF** | Diferencia Limen de Frecuencia — 2 tonos "¿iguales o diferentes?" | Patrón 2 tokens, uno con variación de freq | ✅ `DLF_SCREEN`/`DLF_FINE` |
| **DLD** | Diferencia Limen de Duración — 2 tonos misma freq, dur distinta | Idem | ✅ `DLD_SCREEN`/`DLD_FINE` |
| **Resolución temporal por gap** | 2 tonos con ISI variable (5–50 ms) | ISI ya ajustable | ✅ `GAP_20`/`GAP_10`/`GAP_5` (mig 005) |
| **Discriminación patrón tonal largo** | PPS extendido 5–7 tonos para adultos con sospecha leve | | ✅ `PPS_LONG` |
| **Memoria auditiva secuencial** | Patrones de longitud creciente (2→7), retención | | ✅ `MEM_SEQ_5/6/7` |

### 1.2 Requieren extensión chica del motor ✅ hecho (migración 005)

Agregado a `ToneDefinition`:

- ✅ `level_db` por tono → **DLI** (`DLI_SCREEN`/`DLI_FINE`)
- ✅ `ear` por tono en el patrón → **TOJ** (`TOJ_BIN`/`TOJ_FAST`)
- ✅ `gain_l` / `gain_r` por tono → **Lateralización por ILD** (`ILD_LAT`)

### 1.3 Requieren extensión media (presentación simultánea L≠R) ✅ hecho (migración 006)

Se implementó vía patrón con separador `|`: `"LHL|HLH"` → parte izquierda al oído L, derecha al R, simultáneas. `buildSequencePlan` produce planes paralelos fusionados.

- ✅ **Escucha dicótica no verbal** (`DICHOTIC_NV`)
- ✅ **Fusión binaural tonal** (`FUSION_BIN`)
- ✅ Detección de gap con cambio de frecuencia (`FGC_SCREEN`, mig 009). Micro-splice con ISI=0 + envolvente 2 ms. Patrones FFF (igual) / FGF (+200 Hz) / FHF (+500 Hz)

### 1.4 No factibles sin infraestructura nueva (requieren Fase 1+)

Necesitan grabación/reproducción de buffers de audio o generador de ruido:

- **SSW, Dichotic Digits, SCAN, HINT, SinB, Filtered Speech** → estímulos de habla grabados
- **GIN, Random Gap Detection clásico, MLD** → generador de ruido (banda ancha/angosta) + mezcla con tonos
- **PTA clínica certificada** → calibración real con acoplador + sonómetro (ver sección 3)

---

## 2. Módulo de grabación de estímulos verbales

Objetivo: habilitar **logoaudiometría** (SRT, UCL, discriminación), **listas PAL/PALPA en español**, **dichotic digits ES**, **SSW adaptado**, **SinB-ES**, **frases HINT-ES**.

### 2.1 Stack técnico

- Captura: `navigator.mediaDevices.getUserMedia` + `MediaRecorder` (WebM/Opus) o `AudioWorklet` para PCM crudo
- Almacenamiento: archivos en `app_data_dir` (Tauri `plugin-fs`), path en SQLite. **NO blobs en BD** (infla el archivo).
- Nueva tabla `stimuli`:
  ```
  id, category, token, file_path, duration_ms, rms_dbfs, sample_rate, normalized, created_at
  ```

### 2.2 Procesamiento mínimo viable (Web Audio API, sin deps nativas)

- **Trim silencios**: detección por RMS + umbral
- **Normalización RMS/LUFS**: target -23 LUFS (broadcast) o -20 dBFS (habla clínica)
- **DC offset removal**: filtro HP a 80 Hz
- **Denoise básico**: spectral gating (FFT, umbral desde primeros 200 ms). Sin ML. Suficiente para clínica decente.
- **Fade in/out**: evita clicks en bordes

### 2.3 Fuera de MVP

Noise reduction avanzado (RNNoise), dereverb → requiere WASM o sidecar nativo. Posponer.

---

## 3. Módulo de calibración con sonómetro

Objetivo: que los dB reportados sean dB SPL reales, no pseudo-calibrados.

### 3.1 Flujo de calibración

1. Generar tono patrón 1 kHz a nivel interno conocido (ej. -20 dBFS)
2. Usuario reproduce con auriculares sobre acoplador (6cc supraaurales / 2cc intraaurales — ideal en laboratorio)
3. Mide con sonómetro externo; ingresa valor manual (ej. "leí 74 dB SPL")
4. Sistema calcula offset: `ref_db_real = 74 − (−20) = 94 dB SPL @ 0 dBFS`
5. Guarda por dispositivo de salida + modelo de auriculares en tabla `calibrations`:
   ```
   id, device_id, headphone_model, ear, frequency_hz, ref_db_spl, calibrated_at, valid_until
   ```
6. `dbToGain()` usa ese `ref_db` en vez del 85 hardcoded

### 3.2 Advertencias obligatorias en UI

- Calibración válida sólo para ese par de auriculares + dispositivo + volumen OS fijo. **Bloquear volumen SO al 100% o valor fijo**; si cambia, calibración muere.
- Recalibrar cada 3–6 meses o al cambiar auriculares / tarjeta.
- Sin acoplador el valor es aproximado, no cumple ANSI S3.6 / IEC 60645-1 para uso médico legal.
- Etiqueta en UI: "Uso investigativo / screening. No diagnóstico clínico certificado."
- Calibrar por frecuencia idealmente (curva 250–8000 Hz), no sólo 1 kHz — auriculares no son planos.

### 3.3 Features adicionales

- Detección de dispositivo de salida (`selectAudioOutput`) + aviso si cambia post-calibración
- Test de verificación rápido pre-sesión: "reproduce tono de referencia, ¿escuchas cómodo?" (no reemplaza sonómetro, detecta cambios groseros de volumen OS)
- Versionado por sesión: snapshot de `calibration_id` al iniciar evaluación. Recalibración posterior no altera informes viejos.
- Calibración separada **por oído** (L/R pueden diferir 3–5 dB en auriculares consumer)

---

## 4. Plan por fases

### Fase 1 — Grabación + logoaudiometría básica ✅ hecho (migraciones 012 + 013)
- ✅ Schema `stimulus_lists` + `stimuli` (tokens con audio opcional, file_path, métricas RMS/peak/duración/sample_rate, normalized flag)
- ✅ Setting global `country_code` (LATAM, US, + 19 países) con filtrado de listas por país en UI
- ✅ Listas seed LatAm neutras (SRT bisílabos, Discriminación monosílabos, Dichotic Digits ES) + SRT US-ES
- ✅ UI `/estimulos`: selector país, gestión listas custom, grabador por token (record/detener/cancelar/regrabar/preview/reanalizar/borrar), contador progreso
- ✅ Captura: `MediaRecorder` WebM/Opus sin EC/NS/AGC, decode a `AudioBuffer`
- ✅ Procesado automático: resample mono 44.1 kHz, HP 80 Hz (`OfflineAudioContext` + biquad), trim por RMS ventana 20 ms (umbral −45 dBFS), fade 10 ms, normalización RMS a −20 dBFS con clamp anti-clip 0.99
- ✅ Export a WAV PCM 16-bit mono. Almacenamiento en `appDataDir/stimuli/list{id}_{pos}_{token}.wav` vía `@tauri-apps/plugin-fs`
- ✅ Motor: `playStimulusBuffer(buffer, level_db, {rms_dbfs, ear})` mapea SPL usando curva activa a 1 kHz. Cache de buffers decodificados
- ✅ SRT runner adaptativo (mig 013). Método descendente-ascendente con bracketing: start level configurable, N palabras por nivel, ≥ratio para pasar → desciende `step_down_db`, <ratio → asciende `step_up_db`. SRT = mínimo nivel con pass que tiene fail por debajo. Stop por bracketing / floor / ceiling / max trials / manual. Templates seed: `SRT_LATAM_BISIL`, `SRT_US_ES_BISIL`. Detección automática por `config.srt` en `EvaluationRunPage` → delega a `<SRTRun>`
- ⚠️ Pendiente: denoise espectral (queda para Fase 4)

### Fase 2 — Calibración global ✅ hecho (migraciones 006 + 010)
- ✅ Schema `calibrations` + `calibration_id`/`ref_db_snapshot` en `test_sessions`
- ✅ UI `/calibracion` con tono continuo 1 kHz @ -20 dBFS, captura dB SPL medido, cálculo de `ref_db_spl`
- ✅ `dbToGain()` consume `ref_db` activo (reemplaza 85 hardcoded)
- ✅ Snapshot de calibración al iniciar sesión (reproducible e inmutable por informe)
- ✅ Advertencias clínicas en UI (uso investigativo, lock de volumen, no ANSI S3.6)
- ✅ Captura `device_id`/`device_label` en calibración (mig 010) vía `enumerateDevices`
- ✅ Listener `devicechange` global (store `useCalibrationStore`) → invalida calibración si cambia default output
- ✅ Expiración de calibración: `valid_until` default +6 meses, badge "Vencida" en lista
- ✅ Banner calibración en `AppLayout`: estado `ok`/`expired`/`device_mismatch`/`none`, link a `/calibracion`
- ✅ Modal `PreSessionCheck` pre-sesión: reproduce 2 tonos (ref y −6 dB en orden aleatorio), user elige el más fuerte. Detecta cambios groseros de volumen SO / mute / auriculares.
- ⚠️ Limitación: sin plugin nativo no se puede leer volumen OS directo. Tono de verificación cubre el hueco.

### Fase 3 — Calibración avanzada ✅ hecho (migración 011)
- ✅ Tabla `calibration_points` (freq × oído × ref_db_spl) con FK a `calibrations` + CASCADE
- ✅ Backfill: filas existentes convertidas a punto único
- ✅ `resolveRefDb(freq, ear, curve?)` interpola log-frecuencia entre puntos del mismo oído; fallback binaural → otro oído → escalar
- ✅ `dbToGain(db_spl, ref_db?, freq?, ear?)` consume la curva activa o scalar override
- ✅ `playSequence`/`playTonePreview` toman la curva en `options.curve` + `TestRunner` la pasa desde `calibration_curve_snapshot`
- ✅ Snapshot curva por sesión (`test_sessions.calibration_curve_snapshot` JSON) — reproducible e inmutable
- ✅ Store global (`useCalibrationStore`) carga `setActiveCalibrationCurve` en boot y al activar otra calibración
- ✅ UI `/calibracion`: crear set → agregar puntos por chip de freq + oído, matriz 6 × 2 con contador N/12

### Fase 4 — Procesamiento avanzado + pruebas PAC verbales
- ✅ **Denoise espectral** (`src/lib/audio/denoise.ts`). STFT radix-2 (N=1024, hop 256, Hann), perfil de ruido por percentil 20 de magnitud por bin (robusto sin silencio inicial limpio), gate por bin (bin > `noise * thrMul` → pasa; sino atenúa `reductionDb` = −12 dB default), smoothing en frecuencia y tiempo (half-width 2 bins / 2 frames) contra musical noise, iSTFT con overlap-add y normalización por ∑win². Integrado en `processClip` tras HP y antes de VAD. Flag `denoise: true` default en `ProcessingOptions`
- ✅ **Trim automático robusto (VAD)**. `recording.ts` — ventana 10 ms hop 5 ms, RMS+ZCR, piso de ruido adaptativo (percentil 10 de energías), umbral = `noise_floor + 12 dB` (piso absoluto −50 dBFS), asistencia ZCR para fricativas (umbral adaptativo por percentil 70 de ZCR), cierre morfológico (huecos <80 ms rellenados) y apertura (islas <30 ms descartadas), márgenes pre 30 ms / post 50 ms. Fallback al método RMS fijo si VAD no detecta voz. Seleccionable por `trimMethod: 'vad'|'rms'` en `ProcessingOptions` (default `vad`)
- ✅ **Repo `audiopac-assets` + página `/catalogos`**. Repo GitHub público con manifiesto `index.json` + catálogos JSON (texto+keywords) + GitHub Releases para packs audio tar.gz. App (`src/lib/assets/catalogs.ts` + `CatalogsPage.tsx`): fetch manifiesto, valida SHA-256, instala texto runtime (crea listas+items en DB, idempotente), descarga tarballs audio (con progress stream), gunzip via `fflate`, parse tar POSIX manual, decodifica+procesa+guarda cada WAV. Sharvard v1 publicado: texto (`catalogs/sharvard-es-v1.json`, 211 KB) + audio F (130 MB) + audio M (135 MB) como release `sharvard-audio-v1`. Filosofía: contenido fuera del binario — catálogos nuevos sin rebuild; contribuciones comunitarias vía PR al repo assets. Menu lateral nuevo ítem "Catálogos".
- ~~Importador pack Sharvard local~~ (reemplazado por `/catalogos` → repo remoto). Usuario descarga `sig.zip` de Zenodo, lo descomprime, elige carpeta `sig/F` o `sig/M`, y un único click importa los 700 WAV: busca `shd001..shd700.wav`, mapea a `SHARVARD_ES_L{ceil(n/10)}` posición `((n-1)%10)+1`, procesa con `processClip` (HP 80, trim VAD, norm −20 dBFS, denoise OFF porque audio ya pro), encodea WAV PCM 16-bit y escribe a `appDataDir/stimuli/`. Barra de progreso + lista de errores.
- ✅ **Corpus Sharvard ES** (migración 017). 700 frases peninsular ES (Aubanel et al. 2014, Zenodo 3547446), 70 listas × 10, balanceadas fonémicamente, 5 keywords por frase. Script `scripts/build-sharvard-migration.mjs` parsea `sharvard/lists-phonemic-SAMPA.txt` (formato `code|ortho_uppercase_keys|SAMPA`) — extrae keywords por detección de palabras en mayúsculas, normaliza texto final, emite SQL. Plantilla `HINT_SHARVARD_L01` seed (usuario puede clonar para usar otra lista). Audios Sharvard (265 MB `sig.zip`) NO se empaquetan — usuario descarga pack aparte o graba propios.
- ✅ **HINT-ES adaptativo en ruido** (migraciones 015 + 016). Schema `stimuli.keywords_json` (array palabras clave) + `metadata_json`. `HINTController` (`src/lib/audio/hintRunner.ts`) adapta SNR por bracketing: cada trial es una frase, pasa si ≥`threshold_pass_ratio` de keywords correctos; desciende SNR tras pasar, sube tras fallar. Engine: `playStimulusWithNoise(buffer, voice_db, noise_db, type)` mezcla voz + ruido rosa/blanco con lead-in/out 200 ms. UI `/estimulos` permite marcar keywords por frase clickeando palabras en listas `category=sentence`. Componente `HINTRun.tsx` muestra frase con chips clickables (solo keywords marcables), controles "todas ok" / "ninguna". Plantilla `HINT_ES_CUSTOM` apunta a `HINT_ES_CUSTOM_A` (lista vacía, usuario graba). ⚠️ Pendiente: bundle Sharvard 700 frases (repo `audiopac-assets` aparte, aún no creado). Calibración ruido: usa aproximación `rms_dbfs` por tipo (−15 pink, −5 white). Para clínica estricta, calibrar ruido por separado.
- ✅ **PALPA-E** (pack `palpa-es-v1`). 40 palabras → 20 pares mínimos consonánticos (oclusivas sordas/sonoras, fricativas, nasales, laterales, vibrantes), categoría `discrimination`. Texto-only `requirements:'recording'`. Norma `accuracy_pct` ≥90% adulto sano. Referencias Kay/Lesser/Coltheart 1992 + Valle/Cuetos 1995.
- ✅ **Dichotic Digits ES** (migración 014). Plantillas `DD_ES_FREE` (recuerdo libre) y `DD_ES_DIRECTED` (recuerdo dirigido alternando oído inicial). Usa `playStimulusPair` en `engine.ts` para disparar dos `AudioBuffer` simultáneos con mismo `startTime` (uno por oído). Lista `DICHOTIC_DIGITS_ES` (mig 012) con dígitos 1–9 excluyendo "siete". Scoring por oído con asimetría (R − L). Pares configurables (default 20 pares · 2 dígitos/oído · 55 dB HL).
- ✅ **SinB-ES** (pack `sinb-es-v1`). Variante HINT con ruido **SSN** (Speech-Shaped Noise = rosa filtrado LP 1 kHz Q=0.707, aproxima LTASS habla). Engine: extendido `NoiseType` con `'ssn'`, `playStimulusWithNoise` y `makeNoiseHead` insertan BiquadFilter LP cuando aplica. `noiseRmsDbfs = -20` para SSN. Pack reusa `HINTController` (sin runner nuevo) con `noise_type:'ssn'`. Lista vacía `requirements:'recording'`. Norma `srt_db` por edad (jóvenes -8 a -3, mayores -2 a 8).
- ✅ **Matrix-ES** publicado (`matrix-es-v1`). Nuevo runner `MatrixController` con SNR bracketing 5-AFC por columna. `playStimulusSequenceWithNoise` concatena N buffers en serie con ruido continuo. Grid 5×10 clickeable en `MatrixRun.tsx`. Usuario graba 50 palabras con `metadata.column` 0-4.
- 📝 **SSW adaptado** — plan completo (corpus + motor + runner + editor + informe + pack) en §7. Prioridad baja (overlap con Dichotic Digits, validación ES débil) pero implementación estimada 1–2 sesiones una vez redactado el corpus.

### Fase 5 — Ruido (bonus) ✅ parcial (migración 007)
- ✅ Generador de ruido blanco (buffer random en loop)
- ✅ Generador de ruido rosa (filtro Paul Kellet)
- ✅ Ruido de banda angosta (bandpass `BiquadFilterNode` con `Q = center/bandwidth`)
- ✅ Gap embebido en ruido continuo (carve vía envolvente, ramp 2 ms)
- ✅ Plantillas nuevas: `GIN_STD` (gaps 2–20 ms en 3 s de ruido), `RGD_20/10/5` (Random Gap Detection con bursts de ruido), `NBN_SCREEN` (ruido banda angosta 1 kHz)
- ✅ Mezcla simultánea tono + ruido vía `ToneDefinition.noise_mix` (rama paralela en `playSequence`, misma envolvente de duración)
- ✅ **MLD (Masking Level Difference)** (`MLD_STD`, mig 008). Inversión de fase R vía `phase_invert_right` (gain -1 en `rightNode` del tono; ruido nunca invertido). Tokens A=SoNo+tono, B=SoNo catch, C=SπNo+tono (−10 dB), D=SπNo catch
- ✅ **Calibración SPL del ruido por tipo** (mig 002). Tabla `noise_calibration_points` (calibration_id × noise_type ∈ pink/white/ssn) con `ref_db_spl @ 0 dBFS`. Engine: `playCalibrationNoise(type, dbfs, ear)` para loop continuo + `resolveNoiseRefDb(type)` que usa medición real si existe, fallback heurístico (ref+RMS estimado) si no. `playStimulusWithNoise` y `playStimulusSequenceWithNoise` consumen el ref real. UI `/calibracion` sección 4: reproducir ruido al nivel interno, medir con sonómetro, guardar. Carga vía `useCalibrationStore` en boot.

---

### Fase 6 — Sistema de paquetes (arquitectura extensible) ✅ hecho

**Hecho (6.1–6.4 parcial):**
- ✅ Schema colapsado: migraciones 002–018 fusionadas en `001_initial.sql`. App arranca con schema único v2 (settings.schema_era='v2-packs') sin seeds. Tabla `packs` + FK `pack_id` en `test_templates`/`stimulus_lists` (ON DELETE SET NULL para preservar sesiones).
- ✅ Detección DB pre-v2: al boot, `checkSchemaEra()` (`src/lib/db/client.ts`) verifica `settings.schema_era`. Falla por checksum mismatch o ausencia → modal `<SchemaIncompatibleDialog>` bloqueante con dos botones: **Salir** (cierra ventana, vuelve a aparecer al reabrir) y **Aceptar y regenerar** (invoca comando Tauri `reset_database` → borra `audiopac.db`+sidecars+carpeta `stimuli` → `app.restart()`).
- ✅ Plugin `tauri-plugin-process` agregado para reinicio. Permiso `process:allow-restart`.
- ✅ Tipos canónicos en `src/lib/packs/types.ts` (PackManifest, PackTest, PackStimulusList, PackInterpretation).
- ✅ Installer `src/lib/packs/installer.ts`: `fetchPacksIndex`/`fetchPackManifest` (fetch + verificación SHA-256), `installPack` idempotente (upsert por code, preserva `file_path`/audios grabados), `uninstallPack` (bloquea si hay sesiones referenciando).
- ✅ Repo `audiopac-assets` extendido: 11 packs publicados en `packs/*.json` + `index.json` con clave `packs` (id/version/name/category/requirements/license/url/sha256/bytes).
- ✅ UI `/catalogos` extendida con sección **Paquetes de pruebas** (`<PacksSection>`): grid con install/reinstalar/desinstalar, badges versión + requirements (ninguno/recording/audio_pack), detección de updates por diff de versión.

**Packs publicados:**

| Pack | Tests | Listas | Requirements |
|---|---|---|---|
| `pac-patterns-v1` | FPT_STD, PPS_LONG, DPT_LONG, MEM_SEQ_5/6/7 | — | ninguno |
| `pac-limens-v1` | DLF_SCREEN/FINE, DLD_SCREEN/FINE, DLI_SCREEN/FINE | — | ninguno |
| `pac-temporal-v1` | GAP_20/10/5, TOJ_BIN/FAST, FGC_SCREEN | — | ninguno |
| `pac-binaural-v1` | ILD_LAT, DICHOTIC_NV, FUSION_BIN | — | ninguno |
| `pac-noise-v1` | GIN_STD, RGD_20/10/5, NBN_SCREEN | — | ninguno |
| `pac-mld-v1` | MLD_STD | — | ninguno |
| `logoaud-latam-v1` | SRT_LATAM_BISIL | SRT_LATAM_BISIL_A (20), DISC_LATAM_MONO_A (25) | recording |
| `logoaud-us-es-v1` | SRT_US_ES_BISIL | SRT_US_ES_BISIL_A (20) | recording |
| `dichotic-digits-es-v1` | DD_ES_FREE, DD_ES_DIRECTED | DICHOTIC_DIGITS_ES (8 dígitos) | recording |
| `hint-es-v1` | HINT_ES_CUSTOM | HINT_ES_CUSTOM_A (vacía) | recording |
| `sharvard-es-v1` | HINT_SHARVARD_L01 | (referencia a `catalogs/sharvard-es-v1.json`, 70 listas × 10) | audio_pack |
| `sinb-es-v1` | SINB_ES_CUSTOM | SINB_ES_CUSTOM_A (vacía) | recording |
| `palpa-es-v1` | — | PALPA_PARES_MIN_ES_A (40 palabras) | recording |
| `matrix-es-v1` | MATRIX_ES | MATRIX_ES_A (50 palabras, 5 cols × 10) | recording |
| `hint-es-clinico-v1` | HINT_SHARVARD_L01..L70 (70 tests) | (referencia `catalogs/sharvard-es-v1.json`) | audio_pack |

**Pendiente:**

- ✅ 6.5 Bootstrap primer arranque: `<BootstrapDialog>` bloqueante tras schema ok si `settings.bootstrap_done != '1'`. Fetch `index.json`, checkboxes pre-marcados para `pac-patterns-v1`/`pac-limens-v1`/`pac-temporal-v1`, botón "Todos/Ninguno", "Omitir e instalar luego" (marca done sin instalar). Progreso por pack. Integrado en `App.tsx`.
- ✅ 6.6 Ficha rica del pack (`<PackDetailDialog>`): modal con markdown render (`src/lib/markdown.tsx`, parser propio sin deps), lista de tests/listas incluidos con códigos y categorías, interpretación, referencias, autor. Botón "Detalle" en `<PacksSection>` abre el modal con install/uninstall integrados.
- ✅ **Referencias enriquecidas**: `PackReference` extendido con `doi` y `year` (`src/lib/packs/types.ts`). `PackDetailDialog`, `TestDetailPanel` y `SessionReportPage` renderizan año entre paréntesis + DOI clicable (`https://doi.org/{doi}`) + link externo. `renderInline` exportado desde `markdown.tsx` y autolinkea DOIs sueltos en texto (patrón `10.xxxx/...` con o sin prefijo `doi:`).
- ✅ **Secciones nuevas en ficha clínica por test**: `neural_basis_md` (ícono cerebro) y `scoring_md` (ícono calculadora) agregados a `PackTest`/`PackTestMeta` y renderizados en `<TestDetailPanel>`. Packs pueden documentar base neural del paradigma y cómo se computa el score sin colarlos en `how_it_works_md`.
- ✅ 6.7 Interpretación dinámica en `SessionReportPage`: `getPackForTemplate(template_id)` via JOIN packs, `pickNormBand(age)`, `evaluateNorm(metric, value, band)` con direcciones correctas (higher-better para `accuracy_pct`/`asymmetry_pct`, lower-better para `srt_db`/`gap_ms`). Card "Normativa clínica" con banda matched, umbrales legibles, verdict badge, `description_md` y referencias colapsables. Auto-verdict solo cuando el valor es derivable de `test_score` (accuracy/asymmetry); otras métricas muestran tabla para interpretación manual.
- ✅ 6.8 PPS_STD (Pinheiro 880/1430) y DPS_STD (Musiek, 60 secuencias) publicados como packs independientes `pps-pinheiro-v1` y `dps-musiek-v1` en el repo assets (alternativa más limpia que pac-patterns-v2 — cada test estándar histórico en su propio pack).
- ✅ 6.9 Plantillas reporte custom por pack. Campo opcional `report_template_md` en `PackManifest` → almacenado dentro de `packs.metadata_json` (sin nueva migración). Placeholders soportados: `{{patient_name}}`, `{{patient_age}}`, `{{test_name}}`, `{{test_code}}`, `{{date}}`, `{{ear}}`, `{{examiner}}`, `{{accuracy_pct}}`, `{{correct}}`, `{{total}}`, `{{verdict}}`, `{{rt_mean_ms}}`, `{{rt_median_ms}}`, `{{asymmetry_pct}}`, `{{metric_value}}`, `{{norm_band}}`, `{{pack_name}}`, `{{pack_version}}`. `fillReportTemplate()` resuelve placeholders; faltantes → `—`. `<PackReportTemplateCard>` en `SessionReportPage` renderiza markdown narrativo. Ejemplo publicado en `pac-patterns-v1` v1.1.0.

#### 6.X (propuesta original — para referencia)

Refactor filosófico: la app arranca **vacía** (solo motor, grabador, calibración). Tests, listas y audios vienen como **paquetes instalables/desinstalables** desde `audiopac-assets`. Migraciones = solo schema de BD; contenido = runtime.

#### 6.1 Visión

App = motor audio + engine de pruebas. No viene con tests pre-cargados. Usuario puede:
- Crear sus propios tests desde `/tests/nuevo` (capacidad ya existe)
- Ir a `/catalogos` → instalar packs oficiales/comunitarios → tests aparecen en `/tests`
- Desinstalar packs que no usa → tests desaparecen (con protección si hay sesiones que los referencian)

#### 6.2 Formato paquete

Cada pack es un JSON autocontenido (en repo assets) con:

```jsonc
{
  "id": "dlf-adults-v1",
  "version": "1.0.0",
  "name": "Diferencia Limen de Frecuencia (adultos)",
  "category": "pac.temporal",
  "description_md": "# DLF\n\nEvalúa discriminación fina de frecuencia…",
  "requirements": "ninguno",        // ninguno | recording | audio_pack
  "license": "CC-BY",
  "author": { "name": "…", "url": "…" },
  "references": [
    { "citation": "Moore 1973 J Acoust Soc Am", "url": "…" }
  ],
  "tests": [
    { "code": "DLF_SCREEN", "name": "DLF screening",   "config": { … } },
    { "code": "DLF_FINE",   "name": "DLF fino",        "config": { … } }
  ],
  "lists": [],                       // vacío si no requiere estímulos grabados
  "audio_packs": [],                 // release tarballs si aplica
  "interpretation": {
    "metric": "threshold_hz",
    "norms_by_age": [
      { "age_min": 18, "age_max": 60, "normal_max": 3, "mild_max": 6, "severe_min": 10 }
    ],
    "description_md": "Umbrales >6 Hz sugieren compromiso temporal…"
  },
  "report_template": "dlf-report.md"  // opcional: sección dinámica del informe
}
```

#### 6.3 Schema BD nuevo (mig chica, no breaking)

- `packs` (`id`, `code UNIQUE`, `version`, `name`, `metadata_json`, `installed_at`, `source_url`)
- `test_templates.pack_id` FK nullable → `packs(id)` ON DELETE SET NULL
- `stimulus_lists.pack_id` FK nullable idem

Tests/lists con `pack_id = NULL` = creados por el usuario, intocables al desinstalar packs.

#### 6.4 Ficha UI por pack en `/catalogos`

| Estado requirement | Icono + mensaje |
|---|---|
| `ninguno` (tonos puros) | ✓ "Listo para usar tras instalar" |
| `recording` | 🎤 "Requiere grabar N palabras/frases en `/estimulos`" |
| `audio_pack` | 📦 "Incluye audios" o bien "⚠ Audios por copyright — grabá los tuyos" |

Ficha muestra: descripción, licencia, referencias, cantidad de tests/listas, tamaño audio (si aplica), botones Instalar/Desinstalar/Actualizar.

#### 6.5 Plan por fases

1. **6.1** Mig BD nueva: `packs` + FK en `test_templates`/`stimulus_lists`
2. **6.2** Schema JSON pack definido + publicar pack ejemplo (`packs/pac-tonal-core-v1.json`)
3. **6.3** Installer/uninstaller runtime (fetch pack JSON, INSERT tests+lists con pack_id; DELETE bloqueado si hay sesiones referenciando)
4. **6.4** UI `/catalogos` extendida con fichas ricas (markdown render, badges requirements, desinstalar)
5. **6.5** Empaquetar los seeds actuales en packs: desagregar migraciones 002/004/005/006/007/008/009/013/014/016/017 en JSONs del repo assets
6. **6.6** Remover INSERTs de esas migraciones (solo dejan schema). App arranca vacía
7. **6.7** Bootstrap primer arranque: modal "¿Instalar packs recomendados?" (tonal core, ruido core, Sharvard texto) — opt-in
8. **6.8** Interpretación dinámica en `SessionReportPage`: leer `pack.interpretation.norms_by_age` → semáforo automático + referencias en footer
9. **6.9** Plantillas de reporte custom por pack (markdown con placeholders tipo `{{srt_db}}`, `{{asimetría}}`)

#### 6.6 Paquetes pendientes de crear (cuando el sistema esté listo)

- ✅ **Matrix-ES** (Hochmuth 2012) publicado (`matrix-es-v1`). Estructura 5 columnas × 10 palabras. Nuevo runner `MatrixController` (`src/lib/audio/matrixRunner.ts`) con SNR bracketing 5-AFC por columna. UI `MatrixRun.tsx` con grid clickeable 5×10. Engine: `playStimulusSequenceWithNoise` concatena N buffers con gap inter-palabra y ruido continuo. Metadata `column` (0-4) por stimulus asigna a qué columna pertenece. Audios HörTech cerrados → pack solo trae estructura; usuario graba sus 50 palabras.
- **SSW adaptado** — ver §7 (plan completo con corpus, motor `playSSWItem`, runner, editor, informe y pack)
- ✅ **SinB-ES** publicado (`sinb-es-v1`)
- ✅ **PALPA-E** publicado (`palpa-es-v1`); PAL listas LatAm cubiertas por `logoaud-latam-v1`
- ✅ **HINT-ES clínico v2** publicado (`hint-es-clinico-v1`). 70 tests `HINT_SHARVARD_L01..L70` predefinidos apuntando a las listas Sharvard (generado por `scripts/build-hint-es-clinico-pack.mjs`). A diferencia de `sharvard-es-v1` (sólo L01 como template a clonar), este pack expone cada lista como test seleccionable directamente desde `/tests`. `requirements: audio_pack` — requiere catálogo Sharvard ES + pack audio instalados.

#### 6.7 Riesgos y mitigaciones

- **Sesiones huérfanas al desinstalar**: FK `ON DELETE SET NULL` + UI bloquea desinstalar si hay `test_sessions.template_id` apuntando (ofrece "archivar pack" en lugar de borrar)
- **Offline bootstrap**: primer arranque sin red → app funcional pero vacía; cachear último `index.json` para mostrar "ya conocés estos packs aunque no podés instalarlos ahora"
- **Versiones y updates**: diff versión vs instalado → botón "Actualizar" re-INSERT preservando custom de usuario
- **Conflicto codes**: dos packs que quieren el mismo `code` de test → rechaza segundo install con error claro

---

---

## 7. SSW adaptado ES — plan completo de implementación ✅ hecho (v1.0.0-beta)

**Estado (2026-04-19):** pack `ssw-es-v1` publicado en `audiopac-assets`. Motor `playSSWItem`, `SSWController` runner, `SSWConfigEditor`, `SSWRun`, `SSWReportCard` y placeholders `ssw_*` en `fillReportTemplate` integrados. Migración 003 agrega `category='ssw'` y `test_type='SSW'` al schema. Corpus beta (40 ítems × 4 hemispondees = 160 tokens) pseudo-compuestos bisílabos llanos — requiere validación clínica y grabación por usuario.

**Mejoras hardening (2026-04-19):**
- ✅ **Badge "Uso investigativo"** en `<TestDetailPanel>` (banner del test). Se dispara por `meta.investigative === true` en el pack o por fallback cuando el engine es `ssw`. Tooltip: "Adaptación no validada clínicamente en ES". Flag nuevo `investigative?: boolean` + `investigative_reason_md?` en `PackTest`/`PackTestMeta` → se persiste en `tests_meta` del pack (TEST_META_FIELDS en `installer.ts`). Cualquier pack puede marcarse investigativo sin tocar app.
- ✅ **Warning de durations** en `SSWConfigEditor`: banner ámbar con conteo global de hemispondees fuera de 450–650 ms + ícono `AlertTriangle` por celda del grid con tooltip mostrando la duración real. Estilo ámbar en lugar de verde para celdas fuera de rango. Previene desalineación RC/LC del solape dicótico.
- ✅ **Catch trials de atención**: nuevo campo `SSWParams.catch_trials = { enabled, every_n }`. Cada `every_n` ítems (default 10) el runner intercala una pregunta "¿qué oído escuchaste primero en el ítem anterior?" — sin audio extra, valida lateralización + atención. Controller: `pendingCatch` bloquea `next()` hasta que el usuario responde vía `answerCatch('R'|'L')`. Score extendido con `catch_correct/catch_total/catch_accuracy_pct`. Qualifier `atencion_dudosa` si <80%. UI `SSWRun`: card ámbar dedicada con shortcuts `R`/`L` + stats en vivo + bloque en resultado final. Editor SSW: acordeón con toggle + `every_n`.
- ✅ **Persistencia catch** (migración 004): extiende `test_responses.phase` CHECK con `'catch'`. `Phase` type en TS suma `'catch'`. `SSWRun.handleCatchAnswer` llama `saveResponse({phase:'catch', expected_pattern: askedEar, given_pattern: answeredEar, is_correct})`. `SSWController.hydrate` reconstruye `catchResponses` al reanudar sesión. `scoreFromResponses` en runner y `<SSWReportCard>` contemplan catch rows — el informe ahora muestra precisión de catch con semáforo verde/ámbar según <80%. Placeholders de template `{{ssw_catch_correct}}`, `{{ssw_catch_total}}`, `{{ssw_catch_accuracy}}`.

**SSW** (Staggered Spondaic Word Test — Katz 1962, rev. 1998) evalúa procesamiento auditivo central adulto/pediátrico con **pares spondee dicóticos parcialmente solapados**. Cuatro condiciones por ítem:

```
   oído →   DERECHO            IZQUIERDO
   tiempo   [RNC ][  RC  ]
                   [  LC  ][ LNC ]
```

- **RNC** (Right Non-Competing): primer hemispondee derecho, aislado (sólo R).
- **RC** (Right Competing): segundo hemispondee derecho, simultáneo con LC.
- **LC** (Left Competing): primer hemispondee izquierdo, simultáneo con RC.
- **LNC** (Left Non-Competing): segundo hemispondee izquierdo, aislado (sólo L).

Ejemplo EN clásico: R="SUN-up", L="dayLIGHT" → `"SUN"`[RNC] + (`"up"` ∥ `"day"`)[RC/LC] + `"LIGHT"`[LNC]. 40 ítems × 4 palabras = 160 respuestas por sesión.

El protocolo alterna **ear-first** (R-first / L-first) mitad y mitad para medir efectos de orden. Presentación ~50 dB HL sobre SRT. Requiere SRT previo o asumido.

### 7.1 Corpus ES (160 hemispondees)

**Estrategia**: armar 40 pares spondee donde cada mitad (hemispondee) sea palabra ES autónoma bisílaba acentuada en primera sílaba (tensionada), con solape semántico-acústico suficiente para evocar el spondee compuesto.

Pool candidato:
- Compuestos lexicalizados: `buen|día`, `sol|rey`, `luz|mar`, `pan|sal`, `mal|tiempo`, `medio|día`, `casa|grande`, `papel|blanco`, `agua|fría`, `pelo|negro`.
- Pares tipo adjetivo+sustantivo / sustantivo+sustantivo balanceados por clase articulatoria (usar `PhonemeBalanceChart` para verificar).
- Evitar: hiatos ambiguos, sinalefa que fusione hemis, palabras > 2 sílabas, pares con fricativas largas que invaden el siguiente slot.

**Validación acústica**: duración de cada hemispondee 400–650 ms; onset alignment post-VAD; fade 10 ms; nivel RMS −20 dBFS por ítem. `processClip` ya cubre esto (ver Fase 1).

**Listas**: `SSW_ES_FORM_A` (40 pares) + opcional `SSW_ES_FORM_B` retest. 160 grabaciones por forma.

### 7.2 Schema — stimuli + metadata

Reutilizar `stimuli.metadata_json` para marcar rol:

```jsonc
{
  "ssw_item": 1,        // 1..40
  "side": "R",          // 'R' | 'L'
  "position": 1,        // 1 = first hemispondee, 2 = second
  "pair_label": "buen-día"   // opcional, texto canónico del spondee
}
```

Nueva categoría: `StimulusCategory = 'ssw'` (agregar al CHECK de `001_initial.sql` vía migración aditiva 002, o aceptar `'custom'` + filtrar por metadata — preferir categoría explícita para filtrado en UI).

160 grabaciones = 40 × 2 lados × 2 posiciones. Cada una con metadata completo.

### 7.3 Motor — `playSSWItem`

Nueva función en `src/lib/audio/engine.ts`:

```ts
interface SSWItemSpec {
  rnc: AudioBuffer           // R, pos 1
  rc:  AudioBuffer           // R, pos 2
  lc:  AudioBuffer           // L, pos 1
  lnc: AudioBuffer           // L, pos 2
  level_db: number           // SPL por canal (ambos oídos mismo nivel)
  ear_first: 'R' | 'L'       // si 'L', swap RNC↔LNC y RC↔LC para inversión temporal
  ref_db?: number
  curve?: CalibCurvePoint[]
}

export function playSSWItem(spec: SSWItemSpec): { stop: () => void; finished: Promise<void> }
```

Scheduling en un único `AudioContext`:
1. `t=0`: start RNC en canal R (gain_l=0, gain_r=1).
2. `t = dur(RNC)`: start RC en R **y** LC en L con `startTime` idéntico (`ctx.currentTime + dur(rnc)` en el mismo scheduling pass para onset alignment).
3. `t = dur(RNC) + max(dur(RC), dur(LC))`: start LNC en L.

Usar `BufferSource` + `ChannelMerger` (2 canales) + `Gain` por canal para routing estricto. Aplicar `dbToGain(level_db, ref_db, 1000, ear_from_channel, curve)` por source. Ramp-in/out 10 ms.

Si `ear_first='L'`: swap — la secuencia empieza por LNC en L, etc.

Retornar `finished` Promise que resuelve tras `dur(RNC)+dur(RC|LC)+dur(LNC)`.

**No crear** runner adaptativo: SSW no adapta nivel, es 40 ítems a nivel fijo.

### 7.4 Tipos + plantilla

`src/types/index.ts`:

```ts
export interface SSWParams {
  /** Lista SSW con 160 hemispondees marcados en metadata. */
  stimulus_list_code: string
  /** Nivel presentación por canal, dB HL. */
  level_db: number
  /** Items a presentar (default 40). */
  num_items?: number
  /** Cómo alternar ear-first por ítem. */
  ear_first_order?: 'RLRL' | 'LRLR' | 'RRLL' | 'random' | 'fixed_R' | 'fixed_L'
  /** Mostrar pair_label al paciente (raro — sólo ensayo). */
  show_pair_label?: boolean
  /** ISI entre ítems, ms. */
  iri_ms?: number
}
```

Extender `TestConfig`:

```ts
interface TestConfig {
  // ...
  ssw?: SSWParams
}
```

`TestType` se extiende con `'SSW'` (pack trae `test_type: 'SSW'`).

### 7.5 Runner — `SSWController`

`src/lib/audio/sswRunner.ts`:

```ts
interface SSWTrial {
  index: number                 // 0..num_items-1
  item_id: number               // 1..40
  ear_first: 'R' | 'L'
  spec: SSWItemSpec             // buffers + nivel resueltos
  expected: {                   // ground truth
    RNC: string; RC: string; LC: string; LNC: string
  }
  given?: {                     // respuesta
    RNC: string | null; RC: string | null; LC: string | null; LNC: string | null
  }
  correct?: { RNC: boolean; RC: boolean; LC: boolean; LNC: boolean }
  reversal?: boolean            // orden de reporte invertido
  presented_at?: number
  answered_at?: number
}

interface SSWState {
  trials: SSWTrial[]
  currentIndex: number
  isPlaying: boolean
  finished: boolean
}

class SSWController {
  constructor(params: SSWParams, stimuli: Stimulus[], refDb?: number, curve?: CalibCurvePoint[])
  subscribe(fn: (s: SSWState) => void): () => void
  hydrate(prev: PrevResponse[]): void
  async playCurrent(): Promise<void>
  answer(resp: SSWTrial['given']): void
  next(): void
  finalize(): SSWScore
  stop(): void
}
```

Persistencia por trial en `responses`:

- `expected_pattern`: `"RNC:buen|RC:día|LC:sol|LNC:rey|first:R"`
- `given_pattern`: `"RNC:buen|RC:dia|LC:so|LNC:rey"`
- `is_correct`: `1` si las 4 correctas, `0` sino (uso informativo; scoring real por condición).

### 7.6 Scoring clínico — `SSWScore`

```ts
interface SSWScore {
  total_errors: number                 // 0..160
  raw_score_pct: number                // 100 * errors/160
  by_condition: Record<'RNC'|'RC'|'LC'|'LNC', { correct: number; total: number; error_pct: number }>
  by_ear: { R: { errors: number; total: 80 }; L: { errors: number; total: 80 } }
  ear_effect_pct: number               // (L_err − R_err) — positivo = peor L
  order_effect_pct: number             // ((RNC+LC) − (RC+LNC)) según orden temporal
  reversals: number                    // nº de trials donde el paciente reportó en orden L→R cuando ear_first=R (o viceversa)
  corrected_score_pct?: number         // ajuste por edad (si SSWParams trae age o lo toma del patient)
  response_bias: 'none'|'left'|'right' // >15% asimetría según Katz
  qualifiers: string[]                 // flags tipo 'significant ear_effect', 'high reversals', etc
}
```

Tabla de norms por edad (Katz 1998, ajuste estándar):

| Edad   | Raw errors normal | Leve   | Moderado | Severo |
|--------|------------------:|-------:|---------:|-------:|
| 11–60  | 0–15              | 16–25  | 26–40    | >40    |
| 61–70  | 0–20              | 21–30  | 31–45    | >45    |
| 71+    | 0–25              | 26–35  | 36–50    | >50    |

Poblar en `pack.interpretation.norms_by_age`.

### 7.7 Editor — `SSWConfigEditor`

`src/components/editors/SSWConfigEditor.tsx`. Layout 2-cols (como SRT/Matrix):

**Columna izquierda (params)**:
- Selector lista `category='ssw'` + `+ Nueva` con seed de 160 tokens vacíos y metadata pre-asignado.
- `level_db`, `num_items`, `iri_ms`.
- Selector `ear_first_order` (RLRL / LRLR / RRLL / random / fixed_R / fixed_L).
- Toggle `show_pair_label` (práctica).
- Box explicativo Katz 1962/1998.

**Columna derecha (corpus)**:
- Grid 40 filas × 4 columnas (RNC, RC, LC, LNC) mostrando tokens + estado de grabación + pair_label.
- Click en celda → `TokenInfoDialog` (reusa análisis fonético).
- Botón "Auto-asignar metadata" que lee 160 tokens en orden y completa `ssw_item/side/position` secuencialmente (item 1 = pos 1–4, item 2 = 5–8, …).
- Readiness: 160/160 grabados para habilitar iniciar.
- Link "Guardar y grabar" → `/estímulos?list=CODE&returnTo=`.

Usar el mismo patrón `SharedConfigSection` + `AdvancedJsonEditor`.

Helper `updateStimulusMetadata` ya existe (se agregó para Matrix) — reusar.

### 7.8 UI de ejecución — `SSWRun.tsx`

Pantalla por trial:

```
Trial 12/40      ear-first: R     nivel: 50 dB HL

   [  Reproducir spondee  ]

   Paciente dijo:
   ┌─────────────┬─────────────┬─────────────┬─────────────┐
   │ RNC (R-1)   │ RC (R-2)    │ LC (L-1)    │ LNC (L-2)   │
   │ [input    ] │ [input    ] │ [input    ] │ [input    ] │
   │ esperado:   │ esperado:   │ esperado:   │ esperado:   │
   │  "buen"     │  "día"      │  "sol"      │  "rey"      │
   └─────────────┴─────────────┴─────────────┴─────────────┘
   [ ✓ Correcto las 4 ]  [ Avanzar ]
```

- Botón "Reproducir" dispara `playSSWItem` via `SSWController`.
- 4 inputs de texto (o toggle correct/incorrect con shortcut tecla 1/2/3/4).
- Auto-scoring por comparación normalizada (lowercase, sin tildes, sin espacios). Override manual.
- Reversal flag: se activa si el orden en que el paciente respondió difiere del orden temporal (`reversals`++).
- Progreso chip por condición: RNC ✓8/12, RC ✓6/12, …
- Atajos teclado: `1–4` toggle correct por slot, `Enter` siguiente, `R` repetir.

Modal pre-start con consigna (de `patient_instructions_md`). Modal post-sesión con puntuación cruda y link al informe.

### 7.9 Informe — card SSW en `SessionReportPage`

Nueva tarjeta `<SSWReportCard score={SSWScore} age={patient.age} />`:

- Tabla 4 condiciones (RNC/RC/LC/LNC) con errores, %, barra horizontal. Esperado: RC y LC >> RNC y LNC.
- Desglose por oído: R errors vs L errors + badge asimetría.
- Ear effect: valor absoluto + semáforo (≤5% normal, 5–15% leve, >15% significativo).
- Order effect, reversals, response_bias.
- Veredicto automático leyendo `pack.interpretation.norms_by_age` (usa infra existente de Fase 6.7).
- Narrativa con `fillReportTemplate` (6.9) consumiendo placeholders SSW:
  - `{{ssw_raw_pct}}`, `{{ssw_rnc_err}}`, `{{ssw_rc_err}}`, `{{ssw_lc_err}}`, `{{ssw_lnc_err}}`
  - `{{ssw_ear_effect}}`, `{{ssw_order_effect}}`, `{{ssw_reversals}}`
  - `{{ssw_verdict}}`

Extender `TestScore` union para SSW y `test_sessions.test_score` tipado con `SSWScore`. Ya existe patrón similar (SRT/HINT/Matrix) — replicar.

### 7.10 Pack `ssw-es-v1`

`audiopac-assets/packs/ssw-es-v1.json`:

```jsonc
{
  "id": "ssw-es-v1",
  "version": "1.0.0",
  "name": "SSW — Staggered Spondaic Word (ES)",
  "category": "pac.dichotic",
  "requirements": "recording",
  "license": "CC-BY",
  "description_md": "# SSW...\n40 pares spondee dicóticos solapados (Katz 1962/1998).",
  "author": { "name": "audiopac" },
  "references": [
    { "citation": "Katz J. The use of staggered spondaic words for assessing the integrity of the central auditory nervous system. J Audit Res. 1962", "year": 1962 },
    { "citation": "Katz J. SSW Test Manual. 5th ed. 1998", "year": 1998 },
    { "citation": "Brunt M. The Staggered Spondaic Word Test. In Katz Handbook of Clinical Audiology 2015", "year": 2015 }
  ],
  "tests": [{
    "code": "SSW_ES_FORM_A",
    "name": "SSW español — Forma A",
    "family": "pac.dichotic",
    "purpose_md": "Evalúa procesamiento auditivo central...",
    "how_it_works_md": "Pares spondee solapados con condiciones RNC/RC/LC/LNC...",
    "protocol_md": "1. SRT previo. 2. Presentar a SRT+50 dB HL. 3. 40 ítems alternando ear-first...",
    "target_population_md": "11+ años, sospecha TPAC...",
    "contraindications_md": "Pérdida auditiva asimétrica >10 dB, cooperación limitada...",
    "estimated_duration_min": 15,
    "min_age_years": 11,
    "config": {
      "tones": {}, "isi_ms": 0, "iri_ms": 2000, "envelope_ms": 10, "pattern_length": 0,
      "practice_sequences": [], "test_sequences": [], "channel": "binaural", "level_db": 50,
      "ssw": {
        "stimulus_list_code": "SSW_ES_FORM_A",
        "level_db": 50,
        "num_items": 40,
        "ear_first_order": "RLRL",
        "iri_ms": 2000
      }
    }
  }],
  "lists": [{
    "code": "SSW_ES_FORM_A",
    "name": "SSW ES — Forma A (160 hemispondees)",
    "category": "ssw",
    "country_code": "LATAM",
    "items": [
      /* 160 entries con { token, position, metadata_json: {ssw_item,side,position,pair_label} } */
    ]
  }],
  "interpretation": {
    "metric": "raw_score_pct",
    "norms_by_age": [
      { "age_min": 11, "age_max": 60, "normal_max": 9.4, "mild_max": 15.6, "severe_min": 25 },
      { "age_min": 61, "age_max": 70, "normal_max": 12.5, "mild_max": 18.75, "severe_min": 28 },
      { "age_min": 71, "age_max": 120, "normal_max": 15.6, "mild_max": 21.9, "severe_min": 31 }
    ],
    "description_md": "Raw score > normal sugiere compromiso PAC. Ear effect >15% indica asimetría interaural relevante. Reversals elevados = problema de ordenamiento temporal."
  },
  "report_template_md": "# {{test_name}}\n\nPaciente {{patient_name}} ({{patient_age}} años)...\n\nPuntuación cruda: {{ssw_raw_pct}}% errores (veredicto: {{ssw_verdict}})."
}
```

### 7.11 Migración / DB

- **Migración 002 aditiva**: `ALTER TABLE stimulus_lists` no necesario; agregar `'ssw'` al CHECK de `stimuli_lists.category` mediante recreación (SQLite no soporta ALTER CHECK). Alternativa: usar `'custom'` y filtrar en UI por metadata → más limpio evitar migración.
- `TestType` en app: agregar `'SSW'` al union (`src/types/index.ts`).
- Sin columnas nuevas — todo va en `metadata_json`.

**Decisión sugerida**: usar `category = 'ssw'` con migración aditiva porque facilita filtrado y el UX del editor. Migración mínima (recrea tabla preservando filas).

### 7.12 Plan de fases

1. **7.12.1 Corpus** — armar y validar 40 pares ES. Publicar como `ssw-es-v1` texto-only (sin audio; requirements:'recording'). Balance fonémico validado con `PhonemeBalanceChart`.
2. **7.12.2 Schema + tipos** — `SSWParams`, `TestConfig.ssw`, `TestType: 'SSW'`, migración 002 con `category='ssw'`.
3. **7.12.3 Motor** — `playSSWItem` en `engine.ts` con scheduling dual-channel preciso.
4. **7.12.4 Runner** — `SSWController` + persistencia trials + hydrate.
5. **7.12.5 Editor** — `SSWConfigEditor` con grid 40×4 + auto-asignación metadata + readiness 160.
6. **7.12.6 UI ejecución** — `SSWRun.tsx` con 4 inputs + atajos + reversal detection.
7. **7.12.7 Scoring** — `computeSSWScore` con todas las métricas + normativa.
8. **7.12.8 Informe** — `<SSWReportCard>` en `SessionReportPage` + extensión `fillReportTemplate` con placeholders SSW.
9. **7.12.9 Pack** — publicar `ssw-es-v1` en `audiopac-assets` con ficha clínica completa (purpose/how/protocol/target/contraindic + refs Katz/Brunt/Musiek).
10. **7.12.10 QA clínico** — validar con 5 sujetos normales y 5 con TPAC conocido; comparar contra norms. Ajustar corte normativo si difiere significativamente de Katz US-EN.

### 7.13 Riesgos y decisiones abiertas

- **Validación ES**: Katz 1998 norma sobre corpus EN. Cualquier adaptación ES inherentemente carece de validación publicada — pack se presenta como **investigativo**, no diagnóstico. Badge "uso investigativo" en banner del test.
- **Solape acústico**: si hemispondees tienen durations muy distintas, RC y LC no alinean bien. Normalizar durations a rango 450–550 ms post-grabación (warning en editor si sale de ese rango).
- **Response bias vs real pathology**: paciente con sesgo atencional puede inflar ear_effect. Mitigación: catch trials tipo "¿cuál oído fue primero?" cada 10 ítems (pendiente decidir si agregar).
- **Reversals detection**: requiere que el paciente reporte en un orden específico. Si se ingresa correct/incorrect sin orden, reversal=null. Exponer ambos modos.
- **Overlap con Dichotic Digits**: SSW cubre procesamiento temporal+atencional dicótico, Dichotic cubre integración binaural pura. No son redundantes; ofrecer ambos.
- **Prioridad real**: baja por validación ES débil, pero viable de implementar en 1–2 sesiones de trabajo una vez redactado el corpus.

---

## 5. Extensiones menores pendientes al motor (independientes) ✅ cerrado

- ✅ `level_db` por tono
- ✅ `ear` por tono
- ✅ `gain_l` / `gain_r` por tono
- ✅ Dichotic vía sintaxis `"L|R"` en patrón (en lugar de `simultaneousChannels` bool)

Habilitó 9 plantillas PAC nuevas (mig 005 + 006).

---

## 8. Fase UX — Búsqueda y dinámica de listados ✅ hecho

Objetivo: unificar búsqueda/filtrado en páginas con listas acumulativas. Inspirado en flujo "nuevo reporte" de OtoReport (combobox paciente con creación inline).

### 8.1 Componentes reusables nuevos

- ✅ `src/components/ui/SearchBar.tsx` — input con icono `Search`, botón clear, debounce opcional. Reemplaza el patrón ad-hoc que sólo tenía `PatientsPage`.
- ✅ `src/components/ui/FilterChips.tsx` — chips togglables con etiqueta y conteo por opción. Activo = primario, inactivo = outline. Genérico sobre `T extends string`.
- ✅ `src/components/PatientCombobox.tsx` — input + dropdown flotante. Busca por `first_name`/`last_name`/`document_id`/`id`. Normaliza acentos (NFD). Navegación por teclado (↑↓ Enter Esc). Render: avatar iniciales + nombre + doc + edad + `#id`. **Creación inline**: si no hay match, botón "Crear paciente \"{query}\" como nuevo" abre `PatientForm` prellenado (ruta numérica → documento; ruta texto → first_name + last_name). Tras guardar, selecciona al paciente recién creado automáticamente.
- ✅ `src/components/TestCombobox.tsx` — igual patrón que PatientCombobox pero para `TestTemplateParsed`. Busca por nombre/código/descripción/tipo. Muestra badge `test_type` + código monoespaciado.
- ✅ `PatientForm` — extendido con prop `defaults?: Partial<Patient>` para prefill sin gatillar modo edit. `onSaved(id?)` devuelve id recién creado.

### 8.2 Páginas migradas

| Página | Antes | Después |
|---|---|---|
| `EvaluationHomePage` | `<select>` plano paciente + test | `<PatientCombobox>` con creación inline + `<TestCombobox>` con búsqueda |
| `TestsPage` | Sin filtros ni búsqueda | `SearchBar` (nombre/código/descripción) + `FilterChips` tipo (DPS/PPS/CUSTOM) + origen (estándar/custom). Muestra código monoespaciado junto al nombre |
| `ReportsPage` | 500 sesiones sin filtro | `SearchBar` (paciente/test/evaluador/ID) + `FilterChips` estado (completados/en curso/cancelados) con conteos |
| `PacksSection` (en `/catalogos`) | Grid sin filtros | `SearchBar` (nombre/id/categoría) + `FilterChips` estado (instalados/disponibles/updates) + requirements (ninguno/recording/audio_pack) |
| `StimuliPage` | Select país + lista sin filtro | Mantiene selector país + agrega `SearchBar` lista (nombre/código/descripción) + `FilterChips` categoría con conteos |

### 8.3 Dinámica de creación inline (patrón OtoReport)

Antes el flujo "nueva evaluación sin paciente pre-existente" requería: `/evaluacion` → "ah no está" → ir a `/pacientes` → "nuevo paciente" → llenar → volver a `/evaluacion` → buscar en select → continuar. Ahora: se tipea el nombre en el combobox, el dropdown ofrece "crear con este nombre", modal inline, al guardar queda seleccionado automáticamente y el flujo sigue. Cero navegación lateral.

### 8.4 UX complementaria ✅ hecho

- ✅ **Ordenamiento en `ReportsPage`**: selector con `date_desc` / `date_asc` / `patient_asc` / `test_asc` / `score_desc`. Reset a página 1 al cambiar.
- ✅ **Paginación en `ReportsPage`**: page size 25, navegación Anterior/Siguiente, contador "Página X de Y · mostrando N de M". Load limit 2000 (aviso si se alcanza).
- ✅ **Búsqueda y filtros en `/pacientes/:id`**: `SearchBar` por test/evaluador + `FilterChips` estado (todos/completados/en curso/cancelados) sobre el histórico del paciente.
- ✅ **Spotlight global `Ctrl+K`** (`src/components/CommandPalette.tsx`): modal con backdrop blur, busca en paralelo pacientes + tests + últimos 200 informes + paquetes instalados. Normaliza acentos (NFD). Navegación teclado (↑↓ Enter Esc), hover-to-select, grupo visible por ítem (ícono + badge). Montado en `AppLayout`, listener global `keydown` con `Ctrl+K` / `Cmd+K`. Enter navega a `/pacientes/:id`, `/tests/:id`, `/informes/:id` o `/catalogos` según tipo.

### 8.5 Mejoras profundas en `/tests` ✅ hecho (infra; contenido clínico diferido)

Refactor de la página de tests para ir **más allá** de buscador+chips: organización jerárquica y fichas clínicas ricas por test.

**Implementado:**

- ✅ **Tipo extendido `PackTest`** (`src/lib/packs/types.ts`): campos opcionales `family`, `purpose_md`, `how_it_works_md`, `protocol_md`, `target_population_md`, `contraindications_md`, `estimated_duration_min`, `min_age_years`, `max_age_years`, `references[]`, `attachments[]`. Backwards compatible — packs antiguos siguen funcionando sin cambios.
- ✅ **Storage sin migración**: installer extrae esos campos de cada `PackTest` y los guarda dentro de `packs.metadata_json.tests_meta[code]`. No hace falta columna nueva en `test_templates`.
- ✅ **Helpers** (`src/lib/packs/interpretation.ts`): `getTemplateRichMeta(templateId)` lee JOIN template↔pack y parsea `tests_meta` por código; `listTemplateTreeInfo()` devuelve `Map<templateId, { pack, family, pack_category }>` para armar árbol.
- ✅ **`<TestDetailPanel>`** (`src/components/TestDetailPanel.tsx`): ficha rica con markdown render (reusa `Markdown` de `src/lib/markdown.tsx`). Renderiza secciones "Para qué sirve / Cómo funciona / Cómo se realiza / Qué paciente lo necesita / Contraindicaciones / Referencias (con DOI+link) / Material relacionado (pdf/video/link)". Badges: tipo, estándar/custom, pack (clicable abre `PackDetailDialog`), familia, rango etario, duración estimada. Botones: **Iniciar evaluación** (→ `/evaluacion?template={id}`), **Editar** (→ `/tests/{id}`), **Eliminar** (solo custom).
- ✅ **`TestsPage` refactorizada**: layout 2-columnas (340px árbol + panel detalle), 78vh max-height con scroll independiente. Switch de vista (`FilterChips`): **Plano / Por pack / Por familia**. Selector de orden (nombre / código / más recientes / tipo). Filtros tipo + origen preservados. Grupos colapsables con chevron. Personalizados siempre como grupo separado al final. Selección persistida en URL via `?id=`.
- ✅ **Param `?template=` en `EvaluationHomePage`**: al hacer click en "Iniciar evaluación" desde la ficha, se prellena el selector de test.

**Pendiente (contenido clínico por pack):**

Redactar `purpose_md` / `how_it_works_md` / `protocol_md` / `target_population_md` / `contraindications_md` / `family` / `min_age_years` / `max_age_years` / `estimated_duration_min` / `references` para cada test y re-publicar en `audiopac-assets`. Cada pack sube de versión independiente; al reinstalar en app, la ficha se completa sola.

| Pack | Tests | Estado |
|---|---:|---|
| `pac-patterns-v1` | 6 | ✅ v1.2.0 (FPT_STD, PPS_LONG, DPT_LONG, MEM_SEQ_5/6/7) |
| `pac-limens-v1` | 6 | ✅ v1.1.0 (DLF/DLD/DLI screening+fine con refs Moore/Abel/Jesteadt/Tallal) |
| `pac-temporal-v1` | 5 | ✅ v1.1.0 (GAP 20/10/5, TOJ 100/40, FGC con refs Plomp/Hirsh/Musiek/Tallal) |
| `pac-binaural-v1` | 3 | ✅ v1.1.0 (ILD_LAT, DICHOTIC_NV, FUSION_BIN con refs Kimura/Matzker/Musiek/Blauert/Mills) |
| `pac-noise-v1` | 5 | ✅ v1.1.0 (GIN, RGD 20/10/5, NBN con refs Musiek/Keith/Shinn/Bamiou) |
| `pac-mld-v1` | 1 | ✅ v1.1.0 (MLD 500 Hz con refs Hirsh/Licklider/Durlach/Wilson/Noffsinger, marcador tronco bajo/EM) |
| `logoaud-latam-v1` | 1 | ✅ v1.1.0 (SRT bisílabos con método Hughson-Westlake/Carhart-Jerger, refs Tato/ASHA/Wilson) |
| `logoaud-us-es-v1` | 1 | ✅ v1.1.0 (SRT español US con léxico Lipski/Corpus del Español, refs McCullough/Wilson) |
| `dichotic-digits-es-v1` | 2 | ✅ v1.1.0 (FREE/DIRECTED con refs Musiek 1983/1991, Kimura, Strouse-Wilson, Jerger-Martin) |
| `hint-es-v1` | 1 | ✅ v1.1.0 (HINT SRT-SNR con refs Nilsson/Killion/Humes/Huarte, ruido rosa) |
| `sharvard-es-v1` | 1 | ✅ v1.1.0 (HINT Sharvard L01 con refs Aubanel/Nilsson/IEEE, balance fonémico) |
| `sinb-es-v1` | 1 | ✅ v1.1.0 (SRT en SSN con refs Killion/Byrne/Hochmuth, figura-fondo) |
| `palpa-es-v1` | — | ✅ v1.1.0 (pack listas con refs Kay-Lesser-Coltheart/Valle-Cuetos/Ellis-Young/Franklin) |
| `matrix-es-v1` | 1 | ✅ v1.1.0 (Matrix 5-AFC con refs Hochmuth/Kollmeier, test-retest ±1 dB) |
| `hint-es-clinico-v1` | 70 | ✅ v1.2.0 (ficha clínica por lista: purpose/how/protocol/target/contraindic + refs Aubanel/Nilsson/Soli-Wong/Hall en cada uno de los 70 tests) |
| `pps-pinheiro-v1` | 1 | ✅ v1.1.0 (PPS estándar 880/1430 Hz con refs Pinheiro/Musiek) |
| `dps-musiek-v1` | 1 | ✅ v1.1.0 (DPS estándar 500/250 ms con refs Musiek-Baran-Pinheiro/Bellis) |

**Otros pendientes UX:**

- Sugerencias de tests relacionados por familia (requiere contenido clínico primero).
- Persistir preferencia de vista/orden en `settings` (hoy reset al recargar; selección de test sí persiste via URL).
- Stats "último uso" / "frecuencia" (requieren JOIN con `test_sessions`).

#### 8.5.1 Diseño original (referencia)

**Organización jerárquica (carpetas/familias)**
- Agrupar visualmente por **pack de origen** (`packs.name`) o por **familia funcional** (PAC patrones / PAC temporal / PAC binaural / PAC ruido / Logoaudiometría / Dichotic / HINT / Matrix / Custom).
- Vista árbol o acordeón colapsable: cada familia como carpeta con conteo, expandir → lista de tests del grupo.
- Switch de vista: `Plano | Por pack | Por familia | Por uso clínico` (pediátrico, adulto, screening, diagnóstico).
- Tests creados por usuario (`pack_id = NULL`) van a carpeta "Personalizados" independiente.

**Ordenamiento configurable**
- Orden por: nombre, código, fecha de creación, último uso (requiere JOIN con `test_sessions` para `MAX(started_at)`), frecuencia de uso (`COUNT(sessions)`), dificultad estimada.
- Orden ascendente/descendente.
- Persistir preferencia en `settings` (última vista + orden + filtros).

**Ficha rica por test** (reemplaza card mínima actual)
Cada test al clickearlo abre vista/modal tipo `PackDetailDialog` pero a nivel test. Campos:
- **Para qué sirve**: objetivo clínico (ej: "evaluar discriminación fina de frecuencia en el dominio temporal").
- **Cómo funciona**: explicación del paradigma (2 tonos, "¿iguales o diferentes?", umbral adaptativo, etc).
- **Cómo se realiza**: protocolo paso-a-paso para el evaluador (posición del paciente, instrucción exacta, duración estimada, oído).
- **Qué paciente lo necesita**: población diana (edad mínima/máxima, indicaciones: sospecha de TPAC, seguimiento TDAH, post-trauma, dislexia, etc). Contraindicaciones si aplica.
- **Interpretación**: bandas normativas por edad (ya parcialmente en `packs.interpretation`, falta extender), verdict automático, límites clínicos.
- **Referencias**: citas bibliográficas con DOI/link, autor del paradigma, año, validación en ES si existe.
- **Material relacionado**: PDFs de instructivo, videos demo (opcional), lista de estímulos usados (link a `/estimulos`).

**Schema implicado**
Extender `PackManifest.tests[]` con campos nuevos (backwards compatible, opcionales):
```ts
interface PackTest {
  code: string
  name: string
  config: TestConfig
  // nuevos:
  family?: string                    // "pac.temporal", "logoaud", etc (reutilizar `pack.category`)
  purpose_md?: string                // para qué sirve
  how_it_works_md?: string           // cómo funciona (paradigma)
  protocol_md?: string               // cómo se realiza (procedimiento)
  target_population_md?: string      // qué paciente
  contraindications_md?: string      // contraindicaciones
  estimated_duration_min?: number
  min_age_years?: number
  max_age_years?: number
  references?: Array<{ citation: string; url?: string; doi?: string; year?: number }>
  attachments?: Array<{ label: string; url: string; kind: 'pdf' | 'video' | 'link' }>
}
```
Almacenado dentro de `test_templates.metadata_json` (columna nueva o reutilizar `description` → migrar). Todo viene del pack JSON en `audiopac-assets`, sin tocar la app salvo renderer markdown (ya existe `lib/markdown.tsx`).

**UI concreta**
- `/tests` → layout 2-columnas: izquierda árbol familias/packs con búsqueda, derecha detalle del test seleccionado.
- Botón "Iniciar evaluación con este test" directo desde la ficha (prefill `templateId` al navegar a `/evaluacion`).
- Botón "Ver en contexto del pack" abre `PackDetailDialog`.
- Mobile: stack vertical, árbol colapsado arriba.

**Scope**
Es un refactor medio-grande: UI + schema pack + backfill de contenido clínico (tarea de redacción) en los 14 packs existentes. Recomendable por fases:
1. Extender tipo `PackTest` + parser (backwards compat).
2. Vista árbol + ordenamiento configurable (sin contenido rico todavía).
3. Ficha rica vacía + render markdown de campos opcionales.
4. Redactar contenido clínico pack por pack y re-publicar en `audiopac-assets`.
5. Referencias cruzadas (sugerir tests relacionados por familia).

### 8.6 Editores por motor

**Estado actual (MVP v2):** SRT, Dichotic Digits, HINT/SinB y Matrix 5-AFC tienen editores nativos. Los 5 motores cubiertos.

#### 8.6.1 Infraestructura común ✅ hecho

- ✅ `TestEditorPage` lee `?engine=` y branchea secciones. `detectEngine(config)` también sirve para templates existentes.
- ✅ `blankForEngine(engine)` devuelve `TestConfig` base por motor (tonos vacíos + params del engine seteados).
- ✅ Layout adaptativo: `max-w-4xl` para patterns, `max-w-[1400px]` + grid 2-cols para SRT/Dichotic/HINT/Matrix (izq params, der listado/análisis).
- ✅ `ENGINES_WITH_EDITOR` en `TestsPage.tsx` y `TestDetailPanel.tsx` controla qué motores habilitan "+ Crear nuevo" / botón Editar.
- ✅ **Readiness + gating universal** (`src/lib/packs/readiness.ts`): `getListReadiness(code)` devuelve `{total, recorded, missing}`. `readinessFromConfig` extrae el `stimulus_list_code` del engine activo. Se usa en:
  - `TestDetailPanel`: banner rojo + botón "Iniciar" disabled si faltan grabaciones.
  - `EvaluationHomePage`: banner pre-run + bloqueo del botón principal.
  - Editores: chip de estado inline.
- ✅ **Acceso a grabación integrado**: handler `goToRecord(listCode)` en `TestEditorPage` → guarda el test (crea o update) y navega a `/estimulos?list=CODE&returnTo=/tests/<id>`. `StimuliPage` lee `?list` (fuerza `ignoreCountry` para mostrar Sharvard ES u otros), `?returnTo` muestra botón **← Volver al editor**.
- ✅ **Descarga pack audio**: `TestDetailPanel` detecta `pack.requirements === 'audio_pack'` y ofrece doble botón "Descargar del pack" (→ `/catalogos`) + "Grabar yo mismo" (→ `/estimulos`).
- ✅ `<InlineListCreator>` (`src/components/editors/InlineListCreator.tsx`): modal genérico para crear `stimulus_list` desde el editor (nombre, país, seed tokens opcional). Reutilizado por SRT + Dichotic.
- ✅ `<StimulusEditDialog>` (`src/components/StimulusEditDialog.tsx`): modal con waveform canvas + sliders inicio/fin + preview recortado → re-encode WAV + `updateStimulusRecording`. Accesible desde `/estimulos` por token. **Auto-detect VAD** (botón "Auto"): llama `detectVadBoundsMs(buffer)` al abrir y como acción manual, fija cursores al rango de voz detectado (fallback al rango completo si no hay voz).
- ✅ `<BatchRecordDialog>` (`src/components/BatchRecordDialog.tsx`): graba N tokens de una lista en **una sola toma continua**, auto-segmenta con `detectVadSegmentsMs` (pausas ≥350 ms separan ítems), waveform con overlays de segmentos (azul=actual / verde=conservar / rojo=descartar), edición de rangos por fila + toggle keep, guardado batch vía `saveStimulusWav` + `updateStimulusRecording`. Accesible desde `/estimulos` botón "Grabar todos".
- ✅ Helpers VAD reutilizables en `src/lib/audio/recording.ts`: `detectVadBoundsMs(buf)` (rango único) y `detectVadSegmentsMs(buf, {segmentGapMs})` (múltiples segmentos separados por silencio). Misma lógica que `findVadBounds` (ventana 10/5 ms, piso ruido percentil 10, +12 dB, ZCR assist, cierre morfológico), expuesta como API pública.
- ✅ `<TokenInfoDialog>` (`src/components/TokenInfoDialog.tsx`): modal al clickear un chip de token, muestra análisis fonético completo (ver §8.6.5).

#### 8.6.2 Editor SRT ✅ hecho (v1 básico)

`src/components/editors/SRTConfigEditor.tsx` — layout 2 columnas.

**Columna izquierda (params):**
- Selector de lista filtrada `category='srt'` + botón **+ Nueva** abre `InlineListCreator`.
- Grid 2×4: nivel inicial, palabras/nivel, pass ratio, max trials, paso ↑/↓, piso, techo.
- Caja explicativa Hughson-Westlake modificado (Carhart-Jerger 1959).

**Columna derecha (contenido de la lista):**
- Badge estándar (bloqueada) / editable según `is_standard`.
- Input con separador **coma / punto y coma / newline** → agrega múltiples tokens de un saque (`casa, mesa, perro` → 3 items).
- Resumen del set (sílabas, acentuación, flags, conteos C/V).
- Listado de chips clickables con color por estado (grabado / no-bisílabo / neutro) → clic abre `TokenInfoDialog`.
- Gating integrado + link "Guardar y grabar".

#### 8.6.3 Editor Dichotic Digits ✅ hecho (v1 básico + secuencia fija)

`src/components/editors/DichoticConfigEditor.tsx`.

- Selector lista + **+ Nueva** con seed de **8 dígitos ES sin "siete"** (bisílabo — rompe onset alignment).
- Params: modo (free/directed), pares, dígitos/oído, ISI, nivel dB HL.
- **Toggle secuencia de pares** ✅:
  - **Aleatoria (runtime)**: `generatePairs()` clásico — cada sesión distinto.
  - **Fija (investigador)**: editor grid — N filas, slots L/R con `<select>` por posición desde pool de tokens grabados, botón "Rellenar fila al azar" y "Rellenar N al azar". Runtime usa `buildFixedPairs()` en `dichoticDigitsRunner.ts` mapeando token→stimulus_id.
- Explicación **modos** en UI: libre (Musiek 1983, sensibilidad cortical temporal/callosa) vs dirigido (Strouse-Wilson 1999, atención selectiva top-down).
- Readiness con link "Guardar y grabar".

#### 8.6.4 Editores HINT y Matrix ✅ hecho

- ✅ **HINT / SinB** (`src/components/editors/HINTConfigEditor.tsx`). Layout 2-cols: params (SNR inicial, pasos ↑/↓, pass ratio, bounds, frases/nivel, max trials, tipo ruido pink/ssn/white, nivel ruido SPL) + panel derecho con frases, badges de audio y keywords, readiness gating y `PhonemeBalanceChart`. Crea listas `category='sentence'` inline.
- ✅ **Matrix 5-AFC** (`src/components/editors/MatrixConfigEditor.tsx`). Layout 2-cols: params (columnas, gap inter-palabra, SNR adaptativo, ruido SSN/pink/white, bounds) + grid de asignación de columnas donde cada token tiene un `<select>` de columna (`metadata.column`). Botón "Asignar en secuencia" cicla 0,1,…,N-1 sobre el orden actual. Panel "sin columna" resalta tokens huérfanos. Helper nuevo `updateStimulusMetadata()` en `src/lib/db/stimuli.ts` persiste `metadata.column`.

#### 8.6.5 Análisis fonético español ✅ hecho

`src/lib/es/phonetics.ts` — utilidades pragmáticas para listas ES (no IPA estricto).

- `syllabify(word)`: segmentación silábica con reglas ES — digrafos `ch/ll/rr/qu` como consonante única, clusters inseparables (`pr/pl/br/bl/tr/dr/fr/fl/gr/gl/cr/cl`), diptongo si débil+fuerte sin tilde / dos débiles distintas, hiato si dos fuertes o débil tildada. ~95% correcto; casos borde tipo "idea" (3 síl reales vs 2 calculadas) fallan.
- `classifyStress(count, stressedIdx)`: aguda / llana-grave / esdrújula / sobresdrújula. Regla ES: tilde manda; sino penúltima si termina en vocal/n/s, última otherwise.
- `analyze(word) → PhonemeAnalysis`: syllables, syllable_count, stressed_index, stress_type + label, has_written_accent, vowels[], consonants[] (con digrafos agrupados), has_diphthong, has_hiato, disilabo, issues[].
- `classifyConsonant(letter, nextChar?)`: manner (oclusiva / fricativa / africada / nasal / lateral / vibrante_simple / vibrante_multiple / aproximante) + place (bilabial / labiodental / dental_alveolar / palatal / velar / glotal) + voiced. Desambigua `c`/`g` según vocal siguiente.
- `splitOnsetCoda(syllable)`: consonantes antes/después de la vocal.
- `articulatoryStats(tokens)`: agrega por manner/place/voiced, cuenta onset/coda/abiertas/cerradas.

`src/components/PhonemeBalanceChart.tsx` — chart visible en SRT (toggle "Ver balance fonémico"):

- **Consonantes**: barras horizontales por letra; largo=observado%, línea vertical=esperado ES (RAE/CREA). 14 consonantes top + extras observadas.
- **Vocales**: mismas 5 barras (a/e/i/o/u).
- **Balance articulatorio**: barras por modo (oclusiva/fricativa/nasal/…), por punto (dental-alveolar/bilabial/…), mini-cards de estructura silábica (% abiertas CV vs cerradas CVC+; ES esperado ~70% abiertas) y sonoridad (voiced/voiceless %).
- **Balance score** 0–100 por grupo: `100 − Σ|obs−esperado|`. Etiqueta: balanceado (≥85) / aceptable (70–85) / desbalanceado (50–70) / muy desbalanceado (<50).
- Layout 2 columnas (cons ancha + vocales/articulatorio compacto) para ahorrar vertical.

`<TokenInfoDialog>` reusa `analyze()` para modal de detalle por palabra: división silábica con tónica resaltada, badges (sílabas, acentuación, tilde, diptongo, hiato), grids Consonantes/Vocales con letras en cajitas color, audio info si grabado, issues.

#### 8.6.6 Personalización real — knobs clínicos por motor (pendiente)

El estado actual de los editores expone los params canónicos de cada runner, pero **no basta para personalizar protocolos clínicos**. Un investigador que quiere replicar un paper o armar su propio protocolo necesita knobs que hoy están hardcoded o ausentes. La ruta elegida es **A — expandir schemas**: agregar los knobs a los tipos + runner + UI.

##### 8.6.6.1 SRT — knobs por agregar

Extender `SRTParams` con:

```ts
interface SRTParams {
  // existentes...

  /** Método adaptativo. Default 'hughson_westlake_mod'. */
  method?: 'hughson_westlake_mod' | 'chaiklin_ventry' | 'descending_simple'
  /** Frase portadora. Si presente, se reproduce antes de cada palabra. */
  carrier_phrase?: { audio_token: string; lead_in_ms: number } | null
  /** Familiarización pre-test. */
  familiarization?: {
    enabled: boolean
    level_db: number               // típicamente SRT+30 o 40 dB HL
    show_list: boolean             // mostrar palabras al paciente
  } | null
  /** Enmascaramiento contralateral. */
  masking?: {
    enabled: boolean
    noise_type: 'pink' | 'nbn' | 'white' | 'ssn'
    offset_db: number              // dB bajo el nivel de presentación
    follow_level: boolean          // si true, máscara sigue al signal
  } | null
  /** Criterio de corte custom (override del bracketing por defecto). */
  cutoff_rule?:
    | { kind: 'bracketing' }  // default
    | { kind: 'fixed_trials'; trials: number }
    | { kind: 'plateau'; consecutive_levels: number; delta_db: number }
}
```

Runner `SRTController` y `SRTRun` deben:
- Cargar `carrier_phrase.audio_token` de la lista y concatenar antes del target.
- Respetar `familiarization`: modo demo previo al test (sin scoring).
- Reproducir máscara en canal contralateral durante cada presentación, nivel relativo al target.
- Cambiar lógica de fin de sesión según `cutoff_rule.kind`.

Editor UI:
- Selector método.
- Acordeón "Frase portadora" con token picker.
- Acordeón "Familiarización" con nivel + checkbox mostrar lista.
- Acordeón "Enmascaramiento contralateral" con tipo/offset/follow toggle.
- Tabs para `cutoff_rule`.

##### 8.6.6.2 Dichotic Digits — knobs por agregar

Extender `DichoticDigitsParams`:

```ts
interface DichoticDigitsParams {
  // existentes...

  /** Orden de bloques en modo dirigido. */
  directed_block_order?: 'lrlr' | 'llrr' | 'interleaved'
  /** Catch trials (pares mono) para validar atención. */
  catch_trials?: {
    enabled: boolean
    count: number
    placement: 'random' | 'every_n' | 'start_end'
  } | null
  /** Granularidad de scoring. */
  scoring_granularity?: 'per_pair' | 'per_position' | 'per_digit'
  /** Texto custom para la instrucción de práctica. */
  practice_instructions_md?: string
}
```

Runner:
- `directed_block_order='interleaved'` alterna L/R por trial; `lrlr` 10+10 con L primero; `llrr` 10+10 agrupado.
- Catch trials insertan un par con solo un oído activo en posiciones según `placement`.
- `scoring_granularity='per_digit'` registra cada dígito por separado (expande `expected_pattern` y permite scoring posicional en `SessionReportPage`).

Editor UI:
- Selector orden bloques (solo visible si `mode='directed'`).
- Input catch_trials count + placement.
- Radio scoring_granularity.
- Textarea markdown para practice_instructions_md.

##### 8.6.6.3 Knobs generalizables (todos los engines)

Agregar campos opcionales a `TestConfig` (shared, no por engine):

```ts
interface TestConfig {
  // existentes...

  /** Consigna al paciente, mostrada pre-start. Markdown. */
  patient_instructions_md?: string
  /** Feedback durante el test. */
  feedback?: {
    practice: 'off' | 'correct_incorrect' | 'with_text'
    test: 'off' | 'correct_incorrect'
    practice_text_md?: string
  }
  /** Timeout de respuesta (ms). Si paciente no responde, cuenta como error. */
  response_timeout_ms?: number
  /** Notas libres del investigador. Visible en ficha del test. */
  examiner_notes_md?: string
  /** Escape hatch: overrides arbitrarios que el runner lee. */
  advanced_json?: Record<string, unknown>
}
```

Runner base (todos): leer `patient_instructions_md` y mostrarlo en el modal pre-start antes del primer trial. Aplicar `response_timeout_ms` al botón/keypress handler. `feedback` condiciona render de "✓/✗" post-trial.

Editor: sección común "Consigna & feedback" en todos los editores no-patterns (acordeón colapsable). Textarea con preview markdown. Switch feedback por fase.

##### 8.6.6.4 Escape hatch JSON

Acordeón "⚙ Configuración avanzada (JSON)" al final del editor (todos los engines) con:
- Textarea monoespaciada editando `JSON.stringify(config, null, 2)`.
- Validación en vivo (parse OK / error).
- Preserva campos no expuestos por la UI (`advanced_json` u otros que el runner de futuro agregue).
- Warning: "Uso experimental — cambios no validados pueden romper el test".

##### 8.6.6.5 Plan de implementación

Prioridad (ruta C mixta ya definida en §8.6.6 — primero expandir schemas, escape hatch como cola):

1. ✅ **SRT v2** — `method` + `masking` + `familiarization` + `carrier_phrase` + `cutoff_rule`. Runner (`playStimulusWithCarrierAndMasking` en engine, lógica de corte fixed_trials/plateau/bracketing) + editor con acordeones + `SRTRun` fase familiarización con demo sin scoring. Pack `logoaud-latam-v1` puede exponer ejemplos en updates futuros.
2. ✅ **Generalizables v1** — `TestConfig.patient_instructions_md` + `feedback` + `response_timeout_ms` + `examiner_notes_md`. Componente `<PatientInstructionsModal>` reusable. `<SharedConfigSection>` acordeón común. Wired en `SRTRun` y `DichoticDigitsRun`: modal pre-start, feedback opcional practice/test, auto-fail por timeout.
3. ✅ **Dichotic v2** — `directed_block_order` (lrlr/llrr/interleaved) + `catch_trials` (count/placement random/every_n/start_end) + `scoring_granularity` (per_pair/per_position/per_digit) + `practice_instructions_md`. Runner inserta catch trials mono, `firstEarFor()` para block order, `answerDigit()` per-digit. UI con badge catch + modal práctica.
4. ✅ **SRT cutoff_rule** y Dichotic `examiner_notes_md` (compartido en `SharedConfigSection`).
5. ✅ **Escape hatch JSON** — `<AdvancedJsonEditor>` acordeón genérico con validación en vivo, aplicar/revertir, preserva `advanced_json` y campos fuera de UI. Integrado en editores SRT y Dichotic.
6. ✅ **HINT editor** (§8.6.4) — knobs básicos de `HINTParams` + 2 cols + SharedConfigSection + AdvancedJsonEditor + balance fonémico.
7. ✅ **Matrix editor** (§8.6.4) — grid de asignación `metadata.column` por token + auto-asignación en secuencia.

##### 8.6.6.6 Ampliaciones del análisis fonético ✅ hecho

- ✅ **Score chi-square normalizado** (`chiSquareScore` en `src/lib/es/phonetics.ts`): reemplaza `100 − Σ|diff|` por `100·e^(-χ²/df)`. Penaliza relativamente (celdas con esperado bajo + muchos observados pesan más). Umbrales UI: ≥70 balanceado, ≥45 aceptable, <20 muy desbalanceado.
- ✅ **Sugerencias automáticas** (`src/lib/es/suggestions.ts` + `generateSuggestions`): detecta desvíos por modo/punto articulatorio, estructura silábica y sonoridad. Devuelve mensajes con ejemplos léxicos concretos (ej. "faltan fricativas velares → jota, joya, jugo"). Renderizadas como lista con bullet warn/info en `ArticulatorySection`.
- ✅ **Pares mínimos** (`findMinimalPairs` en `phonetics.ts`): detecta tokens a edit-distance 1 y clasifica contraste (`voicing`/`manner`/`place`/`nasal_oral`/`vowel`/`rhotic`). Prop `showMinimalPairs` en `PhonemeBalanceChart` activa sección colapsable agrupada por tipo de contraste (activada en SRT editor para listas tipo PALPA/discriminación).
- ✅ **Cross-engine**:
  - Dichotic (`DichoticConfigEditor`): chart con prop `expectMonosyllabic` — banner verde/ámbar validando monosilabicidad de todos los tokens.
  - HINT (`HINTConfigEditor`): chart con prop `mode='sentence'` — tokeniza frases en palabras antes de analizar, muestra conteo (N palabras de M frases).
  - Matrix (`MatrixConfigEditor`): chart global + `MatrixPerColumnStats` (longitud min-max, iniciales distintas por columna).
- ✅ **Preview TTS** en `TokenInfoDialog`: dropdown de locale (ES-ES/ES-MX/ES-US/ES-AR + detección de voces instaladas via `getVoices()`), botón "Pronunciar" con `speechSynthesis` rate 0.9. Locale persistido en `localStorage` (`audiopac.tts.locale`). Disclaimer: preview sintético, no reemplaza la grabación.

---

## 9. Vista previa de motores e informe ✅ hecho

Modo preview sin paciente y sin persistencia (commit `1c4fe5d`):

- Flag `preview` en los runners (`SRTController`, `HINTController`, `MatrixController`, `DichoticDigitsController`, `SSWController`): no filtra estímulos por `file_path`, permite recorrer toda la UI + informe sin grabaciones.
- ✅ **Reproducción híbrida**: los runners ya no silencian todo en preview. Si el estímulo tiene audio real (`file_path`), se reproduce normalmente; si falta, se simula con `PREVIEW_PLAY_MS` de retardo silencioso. Aplica a SRT, HINT, Matrix, Dichotic Digits (por par, catch o normal) y SSW (por ítem: necesita las 4 piezas RNC/RC/LC/LNC presentes para audio real).
- `<PreviewBanner>` actualizado reflejando el comportamiento híbrido.

---

## 10. Ficha clínica — base neural + cálculo de resultados ✅ hecho

Cada test muestra ahora el **sustrato neurofisiológico** que respalda la prueba y el **algoritmo explícito** con el que se calcula el resultado. Antes la UI solo mostraba `purpose_md` / `how_it_works_md` / `protocol_md`, dejando implícitos el *por qué* fisiológico y el *cómo* matemático.

- ✅ **Schema extendido** (`src/lib/packs/types.ts`): nuevos campos opcionales `neural_basis_md` y `scoring_md` en `PackTest` y `PackTestMeta`. Backwards compatible — packs antiguos siguen funcionando sin cambios.
- ✅ **Installer** (`src/lib/packs/installer.ts`): `TEST_META_FIELDS` extendido para persistir los nuevos campos dentro de `packs.metadata_json.tests_meta[code]`. No requiere migración de DB.
- ✅ **UI** (`src/components/TestDetailPanel.tsx`): dos secciones nuevas entre "Cómo funciona" y "Cómo se realiza":
  - **Base neural** (icono `Brain`): estructuras y vías evaluadas (cóclea → tronco → corteza), con el principio fisiológico que justifica la prueba (modelo Kimura dicótico, banda crítica coclear, unmasking binaural en oliva superior medial, span de Miller, etc.).
  - **Cómo se calcula el resultado** (icono `Calculator`): algoritmo paso a paso (bracketing Hughson-Westlake, step-down/up, promedios finales), métricas derivadas (REA, Ear Effect, Order Effect, SRT-SNR, MLD) y normas numéricas por edad.
- ✅ **Contenido clínico poblado en 108 tests** de los 18 packs de `audiopac-assets`:
  - 35 tests únicos: SSW, DD (free / directed), DPS, HINT, SRT (latam / us-es), Matrix, ILD, DICHOTIC_NV, FUSION_BIN, DLF / DLD / DLI (screen+fine), MLD, GIN, RGD 20/10/5, NBN, FPT, PPS (long/std), DPT, MEM_SEQ 5/6/7, GAP 20/10/5, TOJ (bin/fast), FGC, SINB.
  - 70 listas HINT-Sharvard con texto compartido (mismas bases neurales que HINT, diferencia léxica).
- ✅ **Index regenerado** (`assets/index.json`): sha256 y bytes recomputados para los 18 packs editados.

Acción usuario: reinstalar / re-sync packs para que los nuevos campos aparezcan en la ficha clínica.
