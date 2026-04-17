# AudioPAC

Software multiplataforma para evaluación del **Procesamiento Auditivo Central (PAC)**.

Implementa los tests clínicos estándar:
- **DPS** (Duration Pattern Sequence) - Patrones de duración
- **PPS** (Pitch Pattern Sequence) - Patrones de frecuencia
- Tests personalizados para investigación

## Stack

- **Tauri v2** - binario nativo multiplataforma (Linux, Windows, macOS, iOS, Android)
- **React 19** + TypeScript + Vite
- **Tailwind CSS v4** + shadcn/ui (paleta burdeo)
- **SQLite** local via `tauri-plugin-sql`
- **Web Audio API** - generacion de tonos con timing sample-accurate
- **jsPDF** - informes exportables

## Caracteristicas

- Multi-perfil estilo Netflix (varios profesionales, PIN opcional)
- CRUD de pacientes con historial
- Motor de audio con envelope, ISI, IRI, canal mono/binaural, nivel dB configurable
- Editor de tests: crear secuencias y parametros para investigacion
- Informes PDF + exportacion CSV para analisis estadistico
- Modo oscuro / claro automatico

## Desarrollo

### Requisitos

- Node.js 20+
- Rust (cargo)
- pnpm

Linux adicional:
- `webkit2gtk-4.1`
- `libappindicator` / `libayatana-appindicator`

### Ejecutar

```bash
pnpm install
pnpm tauri dev
```

### Compilar binario

```bash
pnpm tauri build
```

## Estructura

```
src/
├── routes/          # Paginas (React Router)
├── components/      # UI + layouts
├── lib/
│   ├── audio/       # Motor Web Audio API
│   ├── db/          # Queries SQLite
│   └── pdf/         # Generador de informes
├── stores/          # Estado (zustand)
└── types/           # Tipos TypeScript

src-tauri/
├── src/             # Codigo Rust
├── migrations/      # SQL migrations
└── capabilities/    # Permisos
```

## Licencia

MIT
