#!/usr/bin/env bash
#
# generate-signing-cert.sh
#
# Genera un certificado auto-firmado para firmar binarios Windows.
# Útil para testing o si aún no has comprado un cert comercial.
#
# Para producción real necesitas un cert de CA confiable (Sectigo, DigiCert, SSL.com).
# Los auto-firmados igual pasan la SmartScreen si se confian manualmente, pero no
# construyen reputación en Microsoft SmartScreen.
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/.signing"
PFX_FILE="$OUT_DIR/audiopac-signing.pfx"
CRT_FILE="$OUT_DIR/audiopac-signing.crt"
B64_FILE="$OUT_DIR/audiopac-signing.pfx.base64"

mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"

if [[ -f "$PFX_FILE" ]]; then
    echo -e "${YELLOW}Certificado ya existe en: $PFX_FILE${NC}"
    read -rp "¿Regenerar? (s/N) " ans
    [[ "$ans" =~ ^[sS]$ ]] || exit 0
    rm -f "$PFX_FILE" "$CRT_FILE" "$B64_FILE"
fi

echo -e "${BOLD}Generando certificado de firma auto-firmado para AudioPAC${NC}"
echo ""
read -rp "Nombre del publicador [AudioPAC]: " PUBLISHER
PUBLISHER="${PUBLISHER:-AudioPAC}"
read -rp "País (código ISO 2 letras) [CL]: " COUNTRY
COUNTRY="${COUNTRY:-CL}"
read -rsp "Password del PFX: " PASSWORD
echo ""
read -rsp "Confirma password: " PASSWORD2
echo ""
[[ "$PASSWORD" == "$PASSWORD2" ]] || { echo -e "${RED}Passwords no coinciden${NC}"; exit 1; }

SUBJECT="/C=$COUNTRY/O=$PUBLISHER/CN=$PUBLISHER"

echo -e "${BOLD}Generando clave + cert (válido 3 años)...${NC}"
openssl req -x509 -sha256 -days 1095 -newkey rsa:4096 -nodes \
    -keyout "$OUT_DIR/key.pem" \
    -out "$CRT_FILE" \
    -subj "$SUBJECT" \
    -addext "basicConstraints=CA:false" \
    -addext "keyUsage=digitalSignature" \
    -addext "extendedKeyUsage=codeSigning"

echo -e "${BOLD}Empacando como PFX...${NC}"
openssl pkcs12 -export \
    -out "$PFX_FILE" \
    -inkey "$OUT_DIR/key.pem" \
    -in "$CRT_FILE" \
    -password "pass:$PASSWORD"

rm -f "$OUT_DIR/key.pem"

echo -e "${BOLD}Generando base64 para GitHub Secrets...${NC}"
base64 -w 0 "$PFX_FILE" > "$B64_FILE"

chmod 600 "$PFX_FILE" "$B64_FILE"

echo ""
echo -e "${GREEN}✓ Certificado generado${NC}"
echo ""
echo -e "${BOLD}Archivos creados (.signing/ ignorado por git):${NC}"
echo "  $PFX_FILE       — cert + clave privada"
echo "  $CRT_FILE       — solo cert público"
echo "  $B64_FILE       — PFX en base64 (para GitHub Secrets)"
echo ""
echo -e "${BOLD}Configurar en GitHub:${NC}"
echo "  1. Repo → Settings → Secrets and variables → Actions → New repository secret"
echo "  2. WINDOWS_CERT_BASE64    = contenido de $B64_FILE"
echo "  3. WINDOWS_CERT_PASSWORD  = el password que ingresaste"
echo ""
echo -e "${YELLOW}Copiar base64 al clipboard:${NC}"
if command -v xclip &>/dev/null; then
    xclip -selection clipboard < "$B64_FILE"
    echo "  ✓ Ya está en el clipboard (xclip)"
elif command -v wl-copy &>/dev/null; then
    wl-copy < "$B64_FILE"
    echo "  ✓ Ya está en el clipboard (wl-copy)"
else
    echo "  cat $B64_FILE   # copiar manualmente"
fi
echo ""
echo -e "${YELLOW}Para Windows (usuarios finales que quieran confiar este cert):${NC}"
echo "  Doble-click en $CRT_FILE → Instalar → Máquina local → Autoridades de certificación raíz de confianza"
echo ""
