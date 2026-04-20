# AudioPAC

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-v2-24C8D8.svg)](https://tauri.app)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows-lightgrey)](https://github.com/Debaq/audiopac/releases)
[![DOI](https://zenodo.org/badge/1213560537.svg)](https://doi.org/10.5281/zenodo.19663724)

**Software open-source multiplataforma para evaluación del Procesamiento Auditivo Central (PAC) y logoaudiometría.**

AudioPAC arranca como **motor + grabador + calibración**. Tests, listas de estímulos y contenido clínico se instalan como **paquetes** desde el repositorio [`audiopac-assets`](https://github.com/Debaq/audiopac-assets). App vacía al primer arranque; usuario elige qué baterías usar.

## Paquetes disponibles

17 packs oficiales publicados. Se instalan/actualizan/desinstalan desde **/catalogos** dentro de la app.

### PAC no verbal (tonos puros, sin grabación)

| Pack | Tests |
|---|---|
| `pac-patterns-v1` | FPT (Pinheiro), PPS largo, DPS/DPT, memoria secuencial 5/6/7 |
| `pac-limens-v1` | DLF / DLD / DLI (screening + fino) |
| `pac-temporal-v1` | GAP detection 20/10/5 ms, TOJ, FGC (gap con cambio de frecuencia) |
| `pac-binaural-v1` | ILD lateralización, dicótica no verbal, fusión binaural |
| `pac-noise-v1` | GIN, Random Gap Detection 20/10/5, ruido banda angosta |
| `pac-mld-v1` | Masking Level Difference 500 Hz (SoNo / SπNo) |
| `pps-pinheiro-v1` | PPS estándar 880/1430 Hz |
| `dps-musiek-v1` | DPS estándar Musiek 500/250 ms |

### Logoaudiometría y habla (requieren grabación del evaluador)

| Pack | Contenido |
|---|---|
| `logoaud-latam-v1` | SRT bisílabos + discriminación monosílabos (LatAm neutro) |
| `logoaud-us-es-v1` | SRT español de EE.UU. |
| `dichotic-digits-es-v1` | Dichotic Digits ES (recuerdo libre + dirigido) |
| `palpa-es-v1` | PALPA-E: 20 pares mínimos consonánticos |
| `hint-es-v1` | HINT adaptativo en ruido rosa (lista custom) |
| `sinb-es-v1` | Speech-in-Babble con ruido SSN |
| `matrix-es-v1` | Matrix 5-AFC, grid 5×10 |

### Paquetes con audio

| Pack | Notas |
|---|---|
| `sharvard-es-v1` | Corpus Sharvard ES (Aubanel 2014): 700 frases × 70 listas balanceadas fonémicamente. Descarga audios F+M desde GitHub Releases (~260 MB) |
| `hint-es-clinico-v1` | 70 tests HINT pre-configurados apuntando a las listas Sharvard |

## Baterías clínicas cubiertas

- **Patrones temporales**: FPT, PPS, DPS, DPT
- **Umbrales diferenciales (limens)**: frecuencia, duración, intensidad
- **Procesamiento temporal fino**: GAP, TOJ, RGD, FGC
- **Escucha binaural y dicótica**: ILD, fusión, dicótica no verbal, Dichotic Digits ES
- **Escucha en ruido**: GIN, HINT-ES, SinB-ES (Speech-Shaped Noise), Matrix-ES
- **Masking Level Difference** (MLD)
- **Memoria auditiva secuencial**
- **Logoaudiometría**: SRT, UCL, discriminación (LatAm, US-ES)
- **Diagnóstico fonémico**: PALPA-E pares mínimos

Cada test trae ficha clínica rica: para qué sirve, cómo funciona, protocolo, población diana, contraindicaciones, referencias con DOI. Interpretación automática con bandas normativas por edad (cuando el paradigma lo permite).

## Descarga

Binarios oficiales en [releases](https://github.com/Debaq/audiopac/releases):

- **Windows**: `AudioPAC-vX.Y.Z-windows-x86_64-setup.exe` (NSIS) o `.msi`
- **Linux**: `AudioPAC-vX.Y.Z-linux-x86_64.AppImage` o binario raw

### Firma de código

Binarios Windows firmados por **[SignPath Foundation](https://signpath.org/)**. Si SmartScreen aparece en versiones preliminares: **Más información → Ejecutar de todas formas**.

### Instalación Linux

```bash
chmod +x AudioPAC-*.AppImage
./AudioPAC-*.AppImage
```

## Calibración

Módulo de calibración con sonómetro externo. Soporta:

- **Tono 1 kHz** a nivel interno conocido (flujo básico)
- **Curva multi-frecuencia** (`250–8000 Hz × L/R`) con interpolación log-frecuencia
- **Ruido rosa / blanco / SSN** calibrado por tipo
- **Por oído** independiente (auriculares consumer difieren 3–5 dB L/R)
- **Device tracking**: detecta cambios de dispositivo de salida y marca calibración como inválida
- **Expiración** por defecto 6 meses + banner de estado global
- **Snapshot inmutable por sesión**: recalibrar no altera informes viejos
- **Pre-session check**: reproduce 2 tonos, el usuario elige el más fuerte; detecta cambios groseros de volumen SO / mute

⚠️ Uso investigativo / screening. Sin acoplador 6cc/2cc no cumple ANSI S3.6 ni IEC 60645-1.

## Grabación de estímulos

Editor web dentro de `/estimulos`:

- Captura: `MediaRecorder` WebM/Opus sin EC/NS/AGC
- Procesado automático: resample mono 44.1 kHz, HP 80 Hz, trim **VAD** (RMS + ZCR + cierre morfológico) o RMS fijo, fade 10 ms, normalización RMS a −20 dBFS
- **Denoise espectral** STFT opcional (gate por bin, smoothing frecuencia/tiempo, −12 dB)
- Export WAV PCM 16-bit mono a `appDataDir/stimuli/`
- Editor de recorte visual por waveform canvas + preview
- Análisis fonético ES: silabificación, acentuación, diptongo/hiato, clasificación articulatoria
- **Balance fonémico** vs corpus RAE/CREA con score 0–100

## Características clave

- Multi-perfil estilo Netflix (varios profesionales, PIN opcional)
- CRUD de pacientes con historial filtrable
- Editores nativos por motor: patterns, SRT (con familiarización + carrier + masking), Dichotic Digits (pares aleatorios o fijos), escape hatch JSON avanzado
- Runner adaptativo por paradigma (bracketing Hughson-Westlake, SRT, HINT, Matrix 5-AFC)
- Atajos durante evaluación (K/J correcto/incorrecto, Espacio reproducir)
- **Command palette** global `Ctrl+K` (pacientes / tests / informes / packs)
- Informes PDF + exportación CSV
- Plantillas de informe custom por pack (markdown con placeholders)
- Modo oscuro / claro automático
- Reinstalación limpia de BD con diálogo bloqueante si el schema cambia

## Stack

- **Tauri v2** — binario nativo multiplataforma
- **React 19** + TypeScript + Vite
- **Tailwind CSS v4** + shadcn/ui (paleta burdeo)
- **SQLite** local via `tauri-plugin-sql`
- **Web Audio API** — timing sample-accurate, mezcla tono+ruido, dicótica simultánea
- **jsPDF** — informes

## Desarrollo

### Requisitos

- Node.js 20+, Rust (cargo), pnpm 10+

Linux adicional: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev` / `libayatana-appindicator3-dev`, `librsvg2-dev`

### Ejecutar

```bash
pnpm install
./audiopac.sh          # menú interactivo
./audiopac.sh dev      # directo
./audiopac.sh build    # binario release
```

Artefactos en `src-tauri/target/release/bundle/`.

## Estructura

```
src/
├── routes/              # Páginas (React Router)
├── components/
│   ├── editors/         # SRT, Dichotic, InlineListCreator
│   └── ...              # TestDetailPanel, PackDetailDialog, CommandPalette
├── lib/
│   ├── audio/           # engine, denoise, hintRunner, matrixRunner, dichoticDigitsRunner
│   ├── packs/           # installer, types, interpretation, readiness
│   ├── assets/          # catalogs fetch
│   ├── es/              # phonetics ES
│   ├── db/              # queries SQLite
│   └── pdf/             # informes
├── stores/              # calibration store (zustand)
└── types/

src-tauri/
├── src/                 # Rust (reset_database, etc.)
├── migrations/          # 001_initial.sql (schema v2-packs)
└── capabilities/

docs/
├── ROADMAP_PAC.md       # roadmap vivo
└── SIGNING.md           # guía firma Windows
```

Repo hermano: [`audiopac-assets`](https://github.com/Debaq/audiopac-assets) aloja los JSONs de paquetes y los catálogos + tarballs de audio vía GitHub Releases.

## Contribuir

Issues y PRs bienvenidos. Software clínico — cambios en lógica de tests deben preservar fidelidad a protocolos estándar (Musiek para DPS, Pinheiro para PPS, Katz para SSW, etc.). Packs comunitarios: PR al repo `audiopac-assets`.

## Privacidad

AudioPAC es 100% local y offline. Sin telemetría, sin datos a servidores. Ver [PRIVACY.md](./PRIVACY.md).

## Licencia

[MIT](./LICENSE) © 2026 AudioPAC Contributors
