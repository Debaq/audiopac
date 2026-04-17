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
