# Solicitud a SignPath Foundation

SignPath Foundation ofrece firma de código **gratuita con cert EV** (Extended Validation) para proyectos open source. Con EV, Windows SmartScreen confía **instantáneamente** — sin construcción de reputación.

## Requisitos (verificados)

- ✅ Repo público en GitHub (`Debaq/audiopac`)
- ✅ Licencia open source aprobada (MIT)
- ✅ Desarrollo activo (commits recientes)
- ✅ Proyecto útil y de buena fe (software clínico)
- ✅ README claro con instrucciones
- ✅ No malware, no dual-use problemático

## Cómo aplicar

1. Ir a https://signpath.org/foundation
2. Clic en **Apply for Sponsorship**
3. Completar formulario:

### Project Information

| Campo | Valor |
|-------|-------|
| **Project name** | AudioPAC |
| **Project URL** | https://github.com/Debaq/audiopac |
| **License** | MIT |
| **Description** | Software open-source multiplataforma para evaluación del Procesamiento Auditivo Central (PAC). Implementa los tests clínicos estándar DPS (Duration Pattern Sequence) y PPS (Pitch Pattern Sequence) usados en audiología y fonoaudiología para diagnóstico de trastornos de procesamiento auditivo. Desarrollado con Tauri v2, React y SQLite local. |
| **Artifacts to sign** | Windows NSIS installer (.exe) + MSI |
| **Build system** | GitHub Actions |
| **Target users** | Profesionales de la salud (audiólogos, fonoaudiólogos), investigadores, centros clínicos y universidades |

### Why you need signing

> Our users are healthcare professionals who need to install AudioPAC on clinical workstations, often in institutional environments with strict IT policies. Unsigned installers trigger Windows SmartScreen warnings and are blocked by many corporate antivirus solutions, preventing adoption in clinical settings where the software is most needed.

### Open source commitment

- Repo público bajo MIT
- Issues abiertos
- Documentación en español + inglés progresivo
- Pull requests bienvenidos

## Tras aprobación

SignPath te creará:
- Organization ID
- Project en signpath.io
- Signing policy (usualmente "release-signing")

Luego configuras GitHub Secrets:
- `SIGNPATH_ORGANIZATION_ID`
- `SIGNPATH_PROJECT_SLUG` = `audiopac`
- `SIGNPATH_SIGNING_POLICY_SLUG` = `release-signing`
- `SIGNPATH_API_TOKEN` (si no usas OIDC trust relationship)

Y activas el workflow:
```bash
mv .github/workflows/release.yml .github/workflows/release-unsigned.yml.disabled
mv .github/workflows/release-signpath.yml.disabled .github/workflows/release.yml
git commit -am "chore: activar firma SignPath Foundation"
git push
```

## Tiempo estimado

- Aplicación → aprobación: días a 2 semanas
- Setup tras aprobación: ~30 min

## Mientras tanto

El workflow actual (`release.yml`) funciona sin firma. Los users verán SmartScreen la primera vez pero pueden hacer "Más info → Ejecutar de todas formas". El README ya documenta esto.

## Alternativa paga si rechazan

Si SignPath rechaza (raro para proyecto clínico serio):
- **Azure Trusted Signing**: ~$10 USD/mes, confianza SmartScreen instantánea equivalente a EV
- **SSL.com OV**: ~$130 USD/año, construcción gradual de reputación

Ver `docs/SIGNING.md` para configuración alternativa.
