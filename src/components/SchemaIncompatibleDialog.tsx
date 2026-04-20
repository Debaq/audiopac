import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { closeDb } from '@/lib/db/client'

export function SchemaIncompatibleDialog() {
  const [busy, setBusy] = useState(false)

  async function onReset() {
    setBusy(true)
    try {
      // Liberar el handle JS antes de borrar el archivo.
      await closeDb().catch(() => {})
      const report = await invoke<string>('reset_database')
      console.info('[reset_database]\n' + report)
    } catch (e) {
      console.error('reset_database failed', e)
      alert('Error al regenerar: ' + (e as Error).message)
      setBusy(false)
    }
  }

  async function onExit() {
    try {
      await getCurrentWindow().close()
    } catch (e) {
      console.error('window close failed', e)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,20,28,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          background: '#1f1f28',
          color: '#f0f0f0',
          maxWidth: 560,
          padding: '32px 36px',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          border: '1px solid #6B1F2E',
        }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 22, color: '#ff8e9a' }}>
          Base de datos incompatible
        </h2>
        <p style={{ margin: '0 0 12px', lineHeight: 1.5 }}>
          Esta versión de AudioPAC reemplaza el sistema interno de pruebas por un
          modelo de <strong>paquetes instalables</strong> (Fase 6).
        </p>
        <p style={{ margin: '0 0 12px', lineHeight: 1.5 }}>
          Tu base de datos actual no es compatible. Para continuar hay que
          regenerarla desde cero. Esto borrará:
        </p>
        <ul style={{ margin: '0 0 16px 20px', lineHeight: 1.6 }}>
          <li>Pacientes y sesiones</li>
          <li>Calibraciones</li>
          <li>Listas de estímulos y audios grabados</li>
          <li>Plantillas de tests personalizadas</li>
        </ul>
        <p style={{ margin: '0 0 24px', lineHeight: 1.5, color: '#ffd28e' }}>
          AudioPAC sigue en beta. La app se cerrará al aceptar.{' '}
          <strong>Tienes que reabrirla manualmente</strong>; al hacerlo vas a
          poder instalar packs oficiales desde <strong>/catalogos</strong>.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onExit}
            disabled={busy}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid #555',
              background: 'transparent',
              color: '#ddd',
              cursor: busy ? 'wait' : 'pointer',
              fontSize: 14,
            }}
          >
            Salir
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#6B1F2E',
              color: '#fff',
              cursor: busy ? 'wait' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {busy ? 'Borrando…' : 'Aceptar (cerrar y reabrir manual)'}
          </button>
        </div>
      </div>
    </div>
  )
}
