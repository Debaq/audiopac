#!/usr/bin/env bash
#
# audiopac.sh - Script de gestion para AudioPAC
# Uso: ./audiopac.sh [comando]
# Sin argumentos: abre menu interactivo
#

set -uo pipefail

# ── Colores ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── Variables ────────────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
TAURI_DIR="$PROJECT_DIR/src-tauri"
DIST_DIR="$PROJECT_DIR/dist"
BINARY_NAME="audiopac"
VERSION=$(grep '"version"' "$PROJECT_DIR/package.json" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')

_detect_cargo_target() {
    if [[ -n "${CARGO_TARGET_DIR:-}" ]]; then
        echo "$CARGO_TARGET_DIR"
    elif grep -q 'target-dir' ~/.cargo/config.toml 2>/dev/null; then
        grep 'target-dir' ~/.cargo/config.toml | head -1 | sed 's/.*= *"\(.*\)".*/\1/' | sed "s|~|$HOME|"
    else
        echo "$TAURI_DIR/target"
    fi
}
CARGO_TARGET="$(_detect_cargo_target)"
BUNDLE_DIR="$CARGO_TARGET/release/bundle"

find_binary() {
    local name="${1:-$BINARY_NAME}"
    for dir in "$CARGO_TARGET/release" "$TAURI_DIR/target/release"; do
        if [[ -f "$dir/$name" ]]; then
            echo "$dir/$name"
            return 0
        fi
    done
    return 1
}

# ── Funciones auxiliares ─────────────────────────────────────────────────────
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
header()  { echo -e "\n${BOLD}${CYAN}=== $* ===${NC}\n"; }

elapsed() {
    local start=$1
    local end=$(date +%s)
    local diff=$((end - start))
    echo "$((diff / 60))m $((diff % 60))s"
}

pause_after() {
    echo ""
    echo -e "${DIM}Presiona ENTER para volver al menu...${NC}"
    read -r
}

# ── Verificacion de dependencias ─────────────────────────────────────────────
check_deps() {
    header "Verificando dependencias"
    local missing=0

    for cmd in node pnpm cargo rustc; do
        if command -v "$cmd" &>/dev/null; then
            success "$cmd -> $(command $cmd --version 2>/dev/null | head -1)"
        else
            error "$cmd no encontrado"
            missing=1
        fi
    done

    if pnpm tauri --version &>/dev/null; then
        success "tauri-cli -> $(pnpm tauri --version 2>/dev/null | tail -1)"
    else
        error "tauri-cli no encontrado (pnpm add -D @tauri-apps/cli)"
        missing=1
    fi

    if [[ $missing -eq 1 ]]; then
        error "Faltan dependencias obligatorias"
        return 1
    fi
    success "Todas las dependencias disponibles"
}

# ── Instalar dependencias ────────────────────────────────────────────────────
cmd_install() {
    header "Instalando dependencias"
    cd "$PROJECT_DIR"
    pnpm install
    success "Dependencias pnpm instaladas"
}

# ── Desarrollo ───────────────────────────────────────────────────────────────
cmd_dev() {
    header "Modo desarrollo (Tauri)"
    check_deps || return
    cd "$PROJECT_DIR"
    info "Iniciando Tauri + Vite hot reload..."
    pnpm tauri dev || true
}

cmd_dev_web() {
    header "Frontend dev (solo navegador)"
    cd "$PROJECT_DIR"
    info "Iniciando Vite dev server... (Ctrl+C para detener)"
    pnpm dev || true
}

# ── Check ────────────────────────────────────────────────────────────────────
cmd_check() {
    header "Verificacion rapida"
    local start=$(date +%s)
    local errors=0

    info "TypeScript check..."
    cd "$PROJECT_DIR"
    if pnpm tsc -b --noEmit 2>/dev/null || pnpm tsc -b; then
        success "TypeScript OK"
    else
        error "TypeScript tiene errores"
        errors=1
    fi

    info "Cargo check..."
    cd "$TAURI_DIR"
    if cargo check; then
        success "Rust OK"
    else
        error "Rust tiene errores"
        errors=1
    fi

    if [[ $errors -eq 0 ]]; then
        success "Todo OK en $(elapsed $start)"
    else
        error "Hay errores ($(elapsed $start))"
    fi
}

# ── Build ────────────────────────────────────────────────────────────────────
cmd_build() {
    header "Build AudioPAC v$VERSION"
    check_deps || return
    local start=$(date +%s)
    cd "$PROJECT_DIR"

    info "Compilando release completo..."
    pnpm tauri build

    success "Build completo en $(elapsed $start)"
    collect_artifacts
}

cmd_build_debug() {
    header "Build debug"
    cd "$PROJECT_DIR"
    local start=$(date +%s)

    info "Compilando en modo debug..."
    pnpm tauri build --debug

    success "Build debug en $(elapsed $start)"
}

cmd_build_frontend() {
    header "Build frontend"
    local start=$(date +%s)
    cd "$PROJECT_DIR"

    info "TypeScript + Vite build..."
    pnpm build

    success "Frontend compilado en $(elapsed $start)"
}

# ── Ejecutar binario ─────────────────────────────────────────────────────────
cmd_run() {
    local bin="$(find_binary || echo '')"
    if [[ ! -f "$bin" ]]; then
        error "Binario no encontrado. Ejecuta 'build' primero."
        return 1
    fi
    header "Ejecutando AudioPAC v$VERSION"
    "$bin" "$@" || true
}

# ── Recopilar artefactos ─────────────────────────────────────────────────────
collect_artifacts() {
    local out="$PROJECT_DIR/out/$(date '+%Y-%m-%d_%H-%M')"
    mkdir -p "$out"

    local bin="$(find_binary || echo '')"
    if [[ -f "$bin" ]]; then
        cp "$bin" "$out/"
        success "Binario en: $out"
    fi

    if [[ -d "$BUNDLE_DIR" ]]; then
        # Filtrar solo artefactos de AudioPAC (CARGO_TARGET_DIR es compartido)
        local patterns=("AudioPAC*" "audiopac*" "audio-pac*")
        for type in deb rpm appimage msi nsis dmg; do
            [[ -d "$BUNDLE_DIR/$type" ]] || continue
            for pat in "${patterns[@]}"; do
                for item in "$BUNDLE_DIR/$type"/$pat; do
                    [[ -e "$item" ]] && cp -r "$item" "$out/" 2>/dev/null || true
                done
            done
        done
    fi

    if [[ -n "$(ls -A "$out" 2>/dev/null)" ]]; then
        ls -lh "$out" | tail -n +2
    else
        rmdir "$out" 2>/dev/null
        warn "No se encontraron artefactos"
    fi
}

# ── Base de datos ────────────────────────────────────────────────────────────
cmd_db_reset() {
    header "Reset base de datos"
    local db_paths=(
        "$HOME/.local/share/com.audiopac.app/audiopac.db"
        "$HOME/.config/com.audiopac.app/audiopac.db"
    )
    local found=0
    for db in "${db_paths[@]}"; do
        if [[ -f "$db" ]]; then
            warn "Encontrada DB en: $db"
            read -rp "¿Eliminar? (s/N) " ans
            if [[ "$ans" =~ ^[sS]$ ]]; then
                rm -f "$db" "$db-journal" "$db-wal" "$db-shm"
                success "DB eliminada: $db"
                found=1
            fi
        fi
    done
    [[ $found -eq 0 ]] && info "No se encontro DB existente"
}

cmd_db_path() {
    header "Ubicacion de la base de datos"
    echo -e "${BOLD}Linux:${NC}   ~/.local/share/com.audiopac.app/audiopac.db"
    echo -e "${BOLD}Windows:${NC} %APPDATA%\\com.audiopac.app\\audiopac.db"
    echo -e "${BOLD}macOS:${NC}   ~/Library/Application Support/com.audiopac.app/audiopac.db"
    echo ""
    for db in "$HOME/.local/share/com.audiopac.app/audiopac.db" "$HOME/.config/com.audiopac.app/audiopac.db"; do
        if [[ -f "$db" ]]; then
            success "Existe: $db ($(du -h "$db" | cut -f1))"
        fi
    done
}

# ── Limpiar ──────────────────────────────────────────────────────────────────
cmd_clean() {
    header "Limpieza"
    info "Limpiando dist/ + cargo clean..."
    rm -rf "$DIST_DIR"
    cd "$TAURI_DIR" && cargo clean
    success "Limpio"
}

# ── Info ─────────────────────────────────────────────────────────────────────
cmd_info() {
    header "AudioPAC v$VERSION"
    echo -e "${BOLD}Directorio:${NC} $PROJECT_DIR"
    echo -e "${BOLD}Node:${NC}       $(node --version 2>/dev/null || echo 'N/A')"
    echo -e "${BOLD}pnpm:${NC}       $(pnpm --version 2>/dev/null || echo 'N/A')"
    echo -e "${BOLD}Rust:${NC}       $(rustc --version 2>/dev/null || echo 'N/A')"
    echo -e "${BOLD}Tauri:${NC}      $(pnpm tauri --version 2>/dev/null | tail -1 || echo 'N/A')"
    echo -e "${BOLD}Branch:${NC}     $(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo 'N/A')"
    echo -e "${BOLD}Commit:${NC}     $(git -C "$PROJECT_DIR" log --oneline -1 2>/dev/null || echo 'N/A')"
    local bin="$(find_binary || echo '')"
    if [[ -f "$bin" ]]; then
        echo -e "${BOLD}Binario:${NC}    $bin ($(du -h "$bin" | cut -f1))"
    fi
}

# ══════════════════════════════════════════════════════════════════════════════
# ── MENU INTERACTIVO ─────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

show_banner() {
    clear
    echo -e "${BOLD}${MAGENTA}"
    echo "    _             _ _       ____   _    ____ "
    echo "   / \  _   _  __| (_) ___ |  _ \ / \  / ___|"
    echo "  / _ \| | | |/ _\` | |/ _ \| |_) / _ \| |    "
    echo " / ___ \ |_| | (_| | | (_) |  __/ ___ \ |___ "
    echo "/_/   \_\__,_|\__,_|_|\___/|_| /_/   \_\____|"
    echo -e "${NC}"
    echo -e "${DIM}  Procesamiento Auditivo Central · v$VERSION"
    echo -e "  $(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo '-') · $(git -C "$PROJECT_DIR" log --oneline -1 2>/dev/null | cut -c1-50 || echo '-')${NC}"
    echo ""
}

show_menu() {
    echo -e "${BOLD} DESARROLLO${NC}"
    echo -e "  ${GREEN}1${NC})  Dev Tauri          ${DIM}Tauri + Vite hot reload${NC}"
    echo -e "  ${GREEN}2${NC})  Dev Web            ${DIM}Solo frontend en navegador${NC}"
    echo -e "  ${GREEN}3${NC})  Check              ${DIM}tsc + cargo check${NC}"
    echo ""
    echo -e "${BOLD} BUILD${NC}"
    echo -e "  ${YELLOW}4${NC})  Build release      ${DIM}App completa + paquetes${NC}"
    echo -e "  ${YELLOW}5${NC})  Build debug        ${DIM}Sin optimizaciones${NC}"
    echo -e "  ${YELLOW}6${NC})  Build frontend     ${DIM}Solo tsc + vite build${NC}"
    echo ""
    echo -e "${BOLD} GESTION${NC}"
    echo -e "  ${BLUE}7${NC})  Ejecutar app       ${DIM}Lanzar binario release${NC}"
    echo -e "  ${BLUE}8${NC})  Instalar deps      ${DIM}pnpm install${NC}"
    echo -e "  ${BLUE}9${NC})  Info proyecto      ${DIM}Versiones y estado${NC}"
    echo ""
    echo -e "${BOLD} BASE DE DATOS${NC}"
    echo -e "  ${CYAN}10${NC}) Ver path DB        ${DIM}Ubicacion archivo SQLite${NC}"
    echo -e "  ${RED}11${NC}) Reset DB           ${DIM}Borrar base de datos local${NC}"
    echo -e "  ${RED}12${NC}) Limpiar build      ${DIM}dist/ + cargo clean${NC}"
    echo ""
    echo -e "  ${BOLD}0${NC})  Salir"
    echo ""
}

menu_loop() {
    while true; do
        show_banner
        show_menu

        echo -ne "${BOLD}  Opcion: ${NC}"
        read -r choice

        case "${choice// /}" in
            1)  cmd_dev;            pause_after ;;
            2)  cmd_dev_web;        pause_after ;;
            3)  cmd_check;          pause_after ;;
            4)  cmd_build;          pause_after ;;
            5)  cmd_build_debug;    pause_after ;;
            6)  cmd_build_frontend; pause_after ;;
            7)  cmd_run;            pause_after ;;
            8)  cmd_install;        pause_after ;;
            9)  cmd_info;           pause_after ;;
            10) cmd_db_path;        pause_after ;;
            11) cmd_db_reset;       pause_after ;;
            12) cmd_clean;          pause_after ;;
            0|q|salir) echo -e "\n${GREEN}Hasta luego${NC}"; exit 0 ;;
            "") ;;
            *)  error "Opcion no valida: $choice"; sleep 1 ;;
        esac
    done
}

# ── Ayuda CLI ────────────────────────────────────────────────────────────────
cmd_help() {
    echo -e "${BOLD}${MAGENTA}AudioPAC v$VERSION${NC}"
    echo -e "${DIM}Software para evaluacion del Procesamiento Auditivo Central${NC}"
    echo ""
    echo -e "${BOLD}Uso:${NC} ./audiopac.sh [comando]"
    echo -e "     ./audiopac.sh          ${DIM}(menu interactivo)${NC}"
    echo ""
    echo "  dev            Tauri + Vite hot reload"
    echo "  dev:web        Solo frontend en navegador"
    echo "  check          tsc + cargo check"
    echo "  build          Build release completo"
    echo "  build:debug    Build debug"
    echo "  build:frontend Solo frontend"
    echo "  run            Ejecutar binario release"
    echo "  install        pnpm install"
    echo "  info           Info del proyecto"
    echo "  db:path        Ubicacion de la base de datos"
    echo "  db:reset       Borrar base de datos local"
    echo "  clean          Limpiar dist/ + cargo clean"
    echo "  help           Esta ayuda"
}

# ── Router ───────────────────────────────────────────────────────────────────
main() {
    cd "$PROJECT_DIR"

    if [[ $# -eq 0 ]]; then
        menu_loop
        exit 0
    fi

    case "$1" in
        dev)            cmd_dev ;;
        dev:web)        cmd_dev_web ;;
        check)          cmd_check ;;
        build)          cmd_build ;;
        build:debug)    cmd_build_debug ;;
        build:frontend) cmd_build_frontend ;;
        run)            cmd_run ;;
        install)        cmd_install ;;
        info)           cmd_info ;;
        db:path)        cmd_db_path ;;
        db:reset)       cmd_db_reset ;;
        clean)          cmd_clean ;;
        help|--help|-h) cmd_help ;;
        *)              error "Comando desconocido: $1"; cmd_help; exit 1 ;;
    esac
}

main "$@"
