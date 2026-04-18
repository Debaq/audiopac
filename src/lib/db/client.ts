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
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb()
  const rows = await db.select<{ value: string }[]>(
    'SELECT value FROM settings WHERE key = $1',
    [key],
  )
  return rows[0]?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb()
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = datetime('now')`,
    [key, value],
  )
}

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
