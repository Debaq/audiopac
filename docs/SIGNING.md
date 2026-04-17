# Firma de código - AudioPAC

Cómo firmar los instaladores Windows para que Windows confíe en ellos.

## Por qué firmar

Sin firma → Windows SmartScreen muestra "Windows protegió tu PC" y los antivirus pueden marcar falsos positivos.

Con firma:
- Primera instalación: Windows muestra el publicador (AudioPAC) en lugar de "Publicador desconocido"
- A medida que más usuarios instalan, Microsoft SmartScreen construye reputación → la advertencia desaparece
- Los antivirus confían más en binarios firmados
- Las nuevas versiones firmadas con el mismo cert son reconocidas automáticamente

## Opciones de certificado

### 1. Comercial (recomendado para producción)

Certificados de Code Signing confiables:
- **SSL.com** — ~$170/año, más barato, acepta RUT empresa
- **Sectigo/Comodo** — ~$200/año
- **DigiCert** — ~$500/año, premium
- **EV Code Signing** — ~$300-500/año, reputación instantánea en SmartScreen

Al comprarlo recibes un `.pfx` con password. Skip al paso "Configurar en GitHub".

### 2. Auto-firmado (testing)

Sirve para probar el pipeline. Los usuarios deben confiar el cert manualmente la primera vez.

```bash
./scripts/generate-signing-cert.sh
```

Genera `.signing/audiopac-signing.pfx` + el base64 listo para copiar.

## Configurar en GitHub

1. Ir a tu repo → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**:
   - Nombre: `WINDOWS_CERT_BASE64`
   - Valor: contenido completo de `.signing/audiopac-signing.pfx.base64`
3. **New repository secret**:
   - Nombre: `WINDOWS_CERT_PASSWORD`
   - Valor: el password del PFX

## Flujo de release

```bash
# 1. Actualizar versión en package.json, src-tauri/Cargo.toml y src-tauri/tauri.conf.json
# 2. Commit + tag
git tag v0.1.0
git push --tags

# GitHub Actions:
# - Compila Linux AppImage
# - Compila Windows NSIS + MSI
# - Firma con el cert desde secrets (si está configurado)
# - Timestamp con digicert.com (la firma sigue válida aunque expire el cert)
# - Crea GitHub Release con los instaladores
```

Si los secrets no están configurados, la build sigue pero sin firma (advertencia visible en el log).

## Verificar firma (Windows)

```powershell
Get-AuthenticodeSignature "AudioPAC-v0.1.0-windows-x86_64-setup.exe"
```

Debe mostrar `Status: Valid` y el publicador.

## Convertir cert comercial a base64

Si recibiste un `.pfx` de tu CA:

```bash
# Linux/Mac
base64 -w 0 tu-cert.pfx > cert.base64
xclip -selection clipboard < cert.base64   # copiar al clipboard

# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("tu-cert.pfx")) | Set-Clipboard
```

## Renovación

Los certs comerciales duran 1-3 años. Cuando expire:

1. Comprar/renovar cert
2. Reemplazar `WINDOWS_CERT_BASE64` y `WINDOWS_CERT_PASSWORD` en GitHub Secrets
3. Los binarios ya firmados siguen válidos gracias al timestamp

## Troubleshooting

**Error: signtool.exe x64 not found**
El workflow lo busca automáticamente en `C:\Program Files (x86)\Windows Kits\10\bin`. Si falla, agregar step de `setup-msbuild` antes del signing.

**Error: Timestamp failed**
Servidores alternos si digicert cae:
- `http://timestamp.sectigo.com`
- `http://timestamp.globalsign.com/tsa/r6advanced1`
- `http://ts.ssl.com`
