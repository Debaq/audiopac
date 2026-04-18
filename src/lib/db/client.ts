import Database from '@tauri-apps/plugin-sql'

let dbInstance: Database | null = null

export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load('sqlite:audiopac.db')
  }
  return dbInstance
}

export async function closeDb() {
  if (dbInstance) {
    await dbInstance.close()
    dbInstance = null
  }
}

export type SchemaCheck = 'ok' | 'incompatible'

/**
 * Detecta DB pre-v2 (antes del refactor de packs).
 * - DB nueva o limpia → migración crea settings.schema_era='v2-packs' → 'ok'.
 * - Load() falla (checksum mismatch contra migraciones viejas) → 'incompatible'.
 * - Load() OK pero settings.schema_era falta o ≠ 'v2-packs' → 'incompatible'.
 */
export async function checkSchemaEra(): Promise<SchemaCheck> {
  try {
    const db = await getDb()
    const rows = await db.select<{ value: string }[]>(
      "SELECT value FROM settings WHERE key='schema_era'",
    )
    if (rows.length === 0 || rows[0]?.value !== 'v2-packs') return 'incompatible'
    return 'ok'
  } catch {
    return 'incompatible'
  }
}
