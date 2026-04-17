# Solicitud a SignPath Foundation

Valores listos para copiar-pegar en https://signpath.org/foundation

## Campos del formulario

### Project Name *
```
AudioPAC
```

### Repository URL *
```
https://github.com/Debaq/audiopac
```

### Homepage URL *
```
https://github.com/Debaq/audiopac
```

### Download URL
```
https://github.com/Debaq/audiopac/releases
```
(El README ya menciona: "Los binarios Windows están firmados con certificado de código proporcionado por SignPath Foundation")

### Privacy Policy URL
```
https://github.com/Debaq/audiopac/blob/main/PRIVACY.md
```

### Wikipedia URL
*(dejar vacío)*

### Tagline *
```
Software clínico open-source para evaluación del Procesamiento Auditivo Central (DPS/PPS)
```

### Description *
```
AudioPAC es software open-source multiplataforma para la evaluación del Procesamiento Auditivo Central en entornos clínicos y de investigación. Implementa los tests estándar Duration Pattern Sequence (DPS) y Pitch Pattern Sequence (PPS) usados por audiólogos y fonoaudiólogos para diagnóstico de trastornos del procesamiento auditivo central. Permite parámetros totalmente configurables para investigación, gestión de pacientes, generación de informes clínicos en PDF y exportación de datos para análisis estadístico. Funciona 100% offline con base de datos local SQLite, sin telemetría ni envío de datos a servidores.
```

### Reputation *
```
AudioPAC es un proyecto clínico activo en desarrollo inicial, construido para llenar un vacío real en el ecosistema de software audiológico open-source en español. Los tests DPS y PPS son procedimientos estándar enseñados en programas universitarios de fonoaudiología y audiología en Latinoamérica, pero los softwares comerciales existentes son costosos ($500-2000 USD por licencia) y cerrados, lo que limita su uso en universidades públicas, centros de salud de bajos recursos y proyectos de investigación.

El proyecto se desarrolla con estándares profesionales: CI/CD completo en GitHub Actions, TypeScript strict, arquitectura modular Tauri+React, base de datos SQLite con migraciones versionadas, y documentación técnica extensa. El código fuente y la documentación están disponibles públicamente bajo licencia MIT.

Target inicial: profesionales clínicos, estudiantes de fonoaudiología e investigadores en Chile y Latinoamérica. La obtención de firma de código es crítica para adopción en entornos hospitalarios e institucionales donde las políticas de IT bloquean ejecutables sin firmar.

Enlaces:
- Repositorio: https://github.com/Debaq/audiopac
- Releases: https://github.com/Debaq/audiopac/releases
- Documentación técnica: https://github.com/Debaq/audiopac/tree/main/docs
```

### Maintainer Type
```
Individual
```
*(o "Informal group" si colaboras con otros)*

### Build System
```
GitHub Actions
```

### First Name *
**[TU NOMBRE]**

### Last Name *
**[TU APELLIDO]**

### Email *
**[TU EMAIL]**

### Company Name
*(opcional - dejar vacío si no aplica, o nombre de tu universidad/institución)*

### Primary Discovery Channel *
Opciones típicas: "Search engine", "GitHub", "Recommendation", "Blog/article"

### Please specify the exact source
```
Recomendación de otro proyecto open source que usa SignPath Foundation
```
*(o lo que corresponda a la realidad)*

### Checkboxes
- ☑ **Code of Conduct** — marcar (obligatorio)
- ☐ I agree to receive other communications — opcional, tu decisión
- ☑ **Store and process personal data** — marcar (obligatorio)

## Info necesaria de ti

Para completar el formulario necesito:

1. **First Name** y **Last Name** reales
2. **Email** para la cuenta SignPath
3. **Company Name** (opcional — universidad, centro clínico, o dejar vacío)
4. **Primary Discovery Channel** y fuente específica

Si me das esos 4 datos, genero el texto final listo para copy-paste.

## Tras aprobación

SignPath te creará:
- Organization ID
- Project en signpath.io (slug: `audiopac`)
- Signing policy (usualmente `release-signing`)

Luego configuras en GitHub → Settings → Secrets:
- `SIGNPATH_ORGANIZATION_ID`
- `SIGNPATH_PROJECT_SLUG` = `audiopac`
- `SIGNPATH_SIGNING_POLICY_SLUG` = `release-signing`
- `SIGNPATH_API_TOKEN` (si no usan OIDC trust relationship)

Y activas el workflow:
```bash
mv .github/workflows/release.yml .github/workflows/release-unsigned.yml.disabled
mv .github/workflows/release-signpath.yml.disabled .github/workflows/release.yml
git commit -am "chore: activar firma SignPath Foundation"
git push
```
