# AudioPAC

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-v2-24C8D8.svg)](https://tauri.app)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows-lightgrey)](https://github.com/Debaq/audiopac/releases)

**Software open-source multiplataforma para evaluación del Procesamiento Auditivo Central (PAC)**.

Implementa los tests clínicos estándar:
- **DPS** (Duration Pattern Sequence) — Patrones de duración
- **PPS** (Pitch Pattern Sequence) — Patrones de frecuencia
- Tests personalizados con parámetros totalmente configurables para investigación

## Descarga

Binarios oficiales en la [página de releases](https://github.com/Debaq/audiopac/releases):

- **Windows**: `AudioPAC-vX.Y.Z-windows-x86_64-setup.exe` (NSIS) o `.msi`
- **Linux**: `AudioPAC-vX.Y.Z-linux-x86_64.AppImage` (portable) o binario raw

### Firma de código

Los binarios Windows están firmados con certificado de código proporcionado por **[SignPath Foundation](https://signpath.org/)** como parte de su programa de sponsorship gratuito para proyectos open source.

### Instalación Windows

Si SmartScreen muestra "Windows protegió tu PC" (solo en versiones preliminares sin firmar):
1. Clic en **Más información**
2. Clic en **Ejecutar de todas formas**

### Instalación Linux

```bash
# AppImage (portable)
chmod +x AudioPAC-*.AppImage
./AudioPAC-*.AppImage

# Binario raw
chmod +x AudioPAC-v*-linux-x86_64
./AudioPAC-v*-linux-x86_64
```

## Stack

- **Tauri v2** — binario nativo multiplataforma
- **React 19** + TypeScript + Vite
- **Tailwind CSS v4** + shadcn/ui (paleta burdeo)
- **SQLite** local via `tauri-plugin-sql`
- **Web Audio API** — generación de tonos con timing sample-accurate
- **jsPDF** — informes exportables

## Características

- Multi-perfil estilo Netflix (varios profesionales, PIN opcional)
- CRUD de pacientes con historial
- Motor de audio con envelope, ISI, IRI, canal mono/binaural, nivel dB configurable
- Editor visual de tests: secuencias de longitud variable con bloques de tono por tamaño y frecuencia
- Atajos de teclado durante la evaluación (K/J para correcto/incorrecto, Espacio para reproducir)
- Informes PDF + exportación CSV para análisis estadístico
- Modo oscuro / claro automático

## Desarrollo

### Requisitos

- Node.js 20+
- Rust (cargo)
- pnpm 10+

Linux adicional:
- `libwebkit2gtk-4.1-dev`
- `libappindicator3-dev` / `libayatana-appindicator3-dev`
- `librsvg2-dev`

### Ejecutar

```bash
pnpm install
./audiopac.sh         # menú interactivo
./audiopac.sh dev     # o directo
```

### Compilar binario

```bash
./audiopac.sh build   # o: pnpm tauri build
```

Artefactos en `src-tauri/target/release/bundle/`.

## Estructura

```
src/
├── routes/          # Páginas (React Router)
├── components/      # UI + layouts + SequenceBuilder
├── lib/
│   ├── audio/       # Motor Web Audio API
│   ├── db/          # Queries SQLite
│   └── pdf/         # Generador de informes
├── hooks/           # useKeyboard, etc.
├── stores/          # Estado (zustand)
└── types/           # Tipos TypeScript

src-tauri/
├── src/             # Código Rust
├── migrations/      # SQL migrations
├── capabilities/    # Permisos Tauri
└── icons/           # Iconos generados

.github/workflows/
├── ci.yml           # tsc + cargo check + clippy en cada push
└── release.yml      # Build multiplataforma + firma + GitHub release al taguear v*

docs/
└── SIGNING.md       # Guía de firma de código Windows

scripts/
└── generate-signing-cert.sh   # Helper cert auto-firmado (testing)
```

## Contribuir

Issues y pull requests bienvenidos. Este es software clínico — cualquier cambio en la lógica de los tests debe preservar fidelidad a los protocolos estándar (Musiek para DPS, Pinheiro para PPS).

## Privacidad

AudioPAC es 100% local y offline. No recopila telemetría ni envía datos a servidores. Ver [PRIVACY.md](./PRIVACY.md).

## Licencia

[MIT](./LICENSE) © 2026 AudioPAC Contributors
