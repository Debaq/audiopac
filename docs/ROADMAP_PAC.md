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

### 1.1 Factibles ya, sin tocar motor (solo plantilla `CUSTOM`)

| Prueba | Descripción | Notas |
|---|---|---|
| **FPT** (Frequency Pattern Test / Pinheiro) | Variante PPS con 3 tonos, 880/1122 Hz, 150 ms | Cabe en esquema actual |
| **DPT** | Duration Pattern Test | Ya soportado como DPS |
| **DLF** | Diferencia Limen de Frecuencia — 2 tonos "¿iguales o diferentes?" | Patrón 2 tokens, uno con variación de freq |
| **DLD** | Diferencia Limen de Duración — 2 tonos misma freq, dur distinta | Idem |
| **Resolución temporal por gap** | 2 tonos con ISI variable (5–50 ms) | ISI ya ajustable |
| **Discriminación patrón tonal largo** | PPS extendido 5–7 tonos para adultos con sospecha leve | |
| **Memoria auditiva secuencial** | Patrones de longitud creciente (2→7), retención | |

### 1.2 Requieren extensión chica del motor

Agregar campos al `ToneSpec` / `TestConfig`:

- `level_db` por tono → habilita **DLI** (Diferencia Limen de Intensidad)
- `ear` por tono en el patrón → habilita **TOJ** (Orden Temporal Binaural: tono L, tono R con ISI corto)
- `gain_l` / `gain_r` por tono → habilita **Lateralización por ILD**

### 1.3 Requieren extensión media (presentación simultánea L≠R)

`simultaneousChannels` en `TestConfig`: generar dos `SequencePlan` paralelos, conectar cada uno a su canal por separado.

- **Escucha dicótica no verbal** (secuencia A a oído L + B a R simultáneas)
- **Fusión binaural tonal** (tono dividido: mitades temporales a oídos opuestos)
- **Detección de gap con cambio de frecuencia**

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

### Fase 1 — Grabación + logoaudiometría básica
- Schema `stimuli`
- UI grabador (record, preview, re-record)
- Normalizador RMS + trim silencios + fade
- Plantilla logoaudiometría simple (SRT con lista fija)

### Fase 2 — Calibración global
- Schema `calibrations`
- UI calibración 1 kHz con offset global
- Lock de volumen OS (advertencia + detección de cambio)

### Fase 3 — Calibración avanzada
- Calibración multi-frecuencia (250/500/1k/2k/4k/8k)
- Separada por oído
- Versionado de calibración en sesiones

### Fase 4 — Procesamiento avanzado + pruebas PAC verbales
- Denoise espectral
- Trim automático robusto
- Biblioteca de listas estándar (PAL, PALPA, HINT-ES)
- Dichotic Digits ES, SSW adaptado, SinB-ES

### Fase 5 — Ruido (bonus)
- Generador de ruido banda ancha / angosta
- Mezcla ruido + tono
- Habilita GIN, Random Gap Detection, MLD

---

## 5. Extensiones menores pendientes al motor (independientes)

Agregar al `ToneSpec`:
- `level_db` (nivel por tono)
- `ear` ('left' | 'right' | 'binaural') por tono
- `gain_l` / `gain_r` (lateralización fina)

Agregar al `TestConfig`:
- `simultaneousChannels`: permite patrones paralelos L/R distintos

Habilita ~6 pruebas PAC sin infraestructura nueva.
