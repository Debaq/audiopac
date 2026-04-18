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
- Biblioteca de listas estándar (PAL, PALPA, HINT-ES)
- ✅ **Dichotic Digits ES** (migración 014). Plantillas `DD_ES_FREE` (recuerdo libre) y `DD_ES_DIRECTED` (recuerdo dirigido alternando oído inicial). Usa `playStimulusPair` en `engine.ts` para disparar dos `AudioBuffer` simultáneos con mismo `startTime` (uno por oído). Lista `DICHOTIC_DIGITS_ES` (mig 012) con dígitos 1–9 excluyendo "siete". Scoring por oído con asimetría (R − L). Pares configurables (default 20 pares · 2 dígitos/oído · 55 dB HL).
- SSW adaptado, SinB-ES (pendiente)

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

## 5. Extensiones menores pendientes al motor (independientes) ✅ cerrado

- ✅ `level_db` por tono
- ✅ `ear` por tono
- ✅ `gain_l` / `gain_r` por tono
- ✅ Dichotic vía sintaxis `"L|R"` en patrón (en lugar de `simultaneousChannels` bool)

Habilitó 9 plantillas PAC nuevas (mig 005 + 006).
