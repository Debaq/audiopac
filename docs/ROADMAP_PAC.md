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
- SSW adaptado (pendiente)

### Fase 5 — Ruido (bonus) ✅ parcial (migración 007)
- ✅ Generador de ruido blanco (buffer random en loop)
- ✅ Generador de ruido rosa (filtro Paul Kellet)
- ✅ Ruido de banda angosta (bandpass `BiquadFilterNode` con `Q = center/bandwidth`)
- ✅ Gap embebido en ruido continuo (carve vía envolvente, ramp 2 ms)
- ✅ Plantillas nuevas: `GIN_STD` (gaps 2–20 ms en 3 s de ruido), `RGD_20/10/5` (Random Gap Detection con bursts de ruido), `NBN_SCREEN` (ruido banda angosta 1 kHz)
- ✅ Mezcla simultánea tono + ruido vía `ToneDefinition.noise_mix` (rama paralela en `playSequence`, misma envolvente de duración)
- ✅ **MLD (Masking Level Difference)** (`MLD_STD`, mig 008). Inversión de fase R vía `phase_invert_right` (gain -1 en `rightNode` del tono; ruido nunca invertido). Tokens A=SoNo+tono, B=SoNo catch, C=SπNo+tono (−10 dB), D=SπNo catch
- ⚠️ Calibración SPL: `ref_db` actual fue medido con tono puro. El ruido blanco/rosa a la misma amplitud digital da ~3–5 dB SPL más que un tono puro. Para clínica estricta, calibrar ruido por separado.

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

**Pendiente:**

- ✅ 6.5 Bootstrap primer arranque: `<BootstrapDialog>` bloqueante tras schema ok si `settings.bootstrap_done != '1'`. Fetch `index.json`, checkboxes pre-marcados para `pac-patterns-v1`/`pac-limens-v1`/`pac-temporal-v1`, botón "Todos/Ninguno", "Omitir e instalar luego" (marca done sin instalar). Progreso por pack. Integrado en `App.tsx`.
- ✅ 6.6 Ficha rica del pack (`<PackDetailDialog>`): modal con markdown render (`src/lib/markdown.tsx`, parser propio sin deps), lista de tests/listas incluidos con códigos y categorías, interpretación, referencias, autor. Botón "Detalle" en `<PacksSection>` abre el modal con install/uninstall integrados.
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

- **Matrix-ES** (Hochmuth 2012) — estructura matriz pública (10×5=50 palabras) + runner 5-AFC. Audios cerrados (HörTech) → solo estructura + descripción + flag `requirements: recording`
- **SSW adaptado** (pendiente diseño)
- ✅ **SinB-ES** publicado (`sinb-es-v1`)
- ✅ **PALPA-E** publicado (`palpa-es-v1`); PAL listas LatAm cubiertas por `logoaud-latam-v1`
- **HINT-ES clínico** (ya existe texto + audios Sharvard, solo falta reempaquetar como pack v2)

#### 6.7 Riesgos y mitigaciones

- **Sesiones huérfanas al desinstalar**: FK `ON DELETE SET NULL` + UI bloquea desinstalar si hay `test_sessions.template_id` apuntando (ofrece "archivar pack" en lugar de borrar)
- **Offline bootstrap**: primer arranque sin red → app funcional pero vacía; cachear último `index.json` para mostrar "ya conocés estos packs aunque no podés instalarlos ahora"
- **Versiones y updates**: diff versión vs instalado → botón "Actualizar" re-INSERT preservando custom de usuario
- **Conflicto codes**: dos packs que quieren el mismo `code` de test → rechaza segundo install con error claro

---

## 5. Extensiones menores pendientes al motor (independientes) ✅ cerrado

- ✅ `level_db` por tono
- ✅ `ear` por tono
- ✅ `gain_l` / `gain_r` por tono
- ✅ Dichotic vía sintaxis `"L|R"` en patrón (en lugar de `simultaneousChannels` bool)

Habilitó 9 plantillas PAC nuevas (mig 005 + 006).
