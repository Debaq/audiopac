# Política de Privacidad - AudioPAC

**Última actualización: 2026-04-17**

## Resumen

AudioPAC es software clínico **100% local y offline**. No recopilamos, transmitimos ni almacenamos ningún dato en servidores remotos. Toda la información clínica permanece exclusivamente en el equipo del usuario.

## Datos almacenados

AudioPAC almacena localmente en el dispositivo del usuario:

- **Perfiles de profesionales**: nombre, color de avatar, hash SHA-256 del PIN (opcional)
- **Pacientes**: datos identificatorios ingresados manualmente por el profesional
- **Sesiones de evaluación**: respuestas, puntajes, timestamps, observaciones clínicas
- **Plantillas de tests**: parámetros configurables creados por el usuario

Todos estos datos se guardan en una base de datos SQLite local ubicada en:
- **Windows**: `%APPDATA%\com.audiopac.app\audiopac.db`
- **Linux**: `~/.local/share/com.audiopac.app/audiopac.db`

## Datos NO recopilados

AudioPAC **NO** incluye:
- Telemetría, analytics o tracking
- Envío de datos a servidores propios o de terceros
- Reporte automático de errores o crashes
- Identificadores únicos del dispositivo
- Cookies, fingerprinting o publicidad
- Conexiones a internet para funcionamiento core

## Red

La aplicación no realiza conexiones de red en operación normal. Las únicas conexiones posibles:
- Actualización manual iniciada por el usuario desde la página de releases de GitHub
- Carga de fuentes del sistema operativo (no externas)

## Responsabilidad del usuario

El profesional que opera AudioPAC es responsable de:
- Proteger el acceso físico al equipo donde se instala
- Configurar PIN para cada perfil si hay múltiples usuarios
- Cumplir con la legislación local de protección de datos de salud (HIPAA, GDPR, Ley 19.628 Chile, etc.)
- Implementar backups regulares del archivo `audiopac.db`

## Código abierto

El código fuente está disponible públicamente en https://github.com/Debaq/audiopac bajo licencia MIT. Cualquier usuario puede auditar el comportamiento de la aplicación.

## Contacto

Para preguntas sobre privacidad, abrir un issue en https://github.com/Debaq/audiopac/issues
