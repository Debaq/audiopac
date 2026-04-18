import { fetch as tfetch } from '@tauri-apps/plugin-http'
import { getDb } from '@/lib/db/client'
import { ASSETS_RAW } from '@/lib/assets/catalogs'
import type { PackManifest, PacksIndexEntry } from './types'

export interface InstalledPack {
  id: number
  code: string
  version: string
  name: string
  category: string | null
  requirements: string | null
  installed_at: string
}

export interface PacksIndex {
  schema: number
  updated_at: string
  packs: PacksIndexEntry[]
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', bytes as any)
  return Array.from(new Uint8Array(h))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function fetchPacksIndex(): Promise<PacksIndex> {
  const url = `${ASSETS_RAW}/index.json`
  const r = await tfetch(url, { method: 'GET' })
  if (!r.ok) throw new Error(`fetch index.json: ${r.status}`)
  const data = (await r.json()) as { packs?: PacksIndexEntry[]; schema: number; updated_at: string }
  return { schema: data.schema, updated_at: data.updated_at, packs: data.packs ?? [] }
}

export async function fetchPackManifest(entry: PacksIndexEntry): Promise<PackManifest> {
  const url = entry.url.startsWith('http') ? entry.url : `${ASSETS_RAW}/${entry.url}`
  const r = await tfetch(url, { method: 'GET' })
  if (!r.ok) throw new Error(`fetch pack ${entry.id}: ${r.status}`)
  const buf = new Uint8Array(await r.arrayBuffer())
  const got = await sha256Hex(buf)
  if (got.toLowerCase() !== entry.sha256.toLowerCase()) {
    throw new Error(`sha256 mismatch ${entry.id}: expected ${entry.sha256}, got ${got}`)
  }
  const text = new TextDecoder().decode(buf)
  return JSON.parse(text) as PackManifest
}

export async function listInstalledPacks(): Promise<InstalledPack[]> {
  const db = await getDb()
  return db.select<InstalledPack[]>(
    `SELECT id, code, version, name, category, requirements, installed_at
     FROM packs ORDER BY installed_at DESC`,
  )
}

export async function getInstalledPack(code: string): Promise<InstalledPack | null> {
  const db = await getDb()
  const rows = await db.select<InstalledPack[]>(
    `SELECT id, code, version, name, category, requirements, installed_at
     FROM packs WHERE code = $1`,
    [code],
  )
  return rows[0] ?? null
}

/**
 * Inserta el pack y todo su contenido (tests + listas + items). Idempotente:
 * si el pack ya existe se actualiza version/metadata pero no se duplican rows.
 */
export async function installPack(
  manifest: PackManifest,
  source: { url: string; sha256: string },
): Promise<InstalledPack> {
  const db = await getDb()
  const existing = await getInstalledPack(manifest.id)

  let packId: number
  if (existing) {
    await db.execute(
      `UPDATE packs
       SET version=$1, name=$2, category=$3, description_md=$4, requirements=$5,
           license=$6, author_json=$7, references_json=$8, interpretation_json=$9,
           metadata_json=$10, source_url=$11, manifest_sha256=$12,
           updated_at=datetime('now')
       WHERE id=$13`,
      [
        manifest.version, manifest.name, manifest.category, manifest.description_md,
        manifest.requirements, manifest.license,
        JSON.stringify(manifest.author),
        manifest.references ? JSON.stringify(manifest.references) : null,
        manifest.interpretation ? JSON.stringify(manifest.interpretation) : null,
        manifest.metadata ? JSON.stringify(manifest.metadata) : null,
        source.url, source.sha256, existing.id,
      ],
    )
    packId = existing.id
  } else {
    const r = await db.execute(
      `INSERT INTO packs
        (code, version, name, category, description_md, requirements, license,
         author_json, references_json, interpretation_json, metadata_json,
         source_url, manifest_sha256)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        manifest.id, manifest.version, manifest.name, manifest.category,
        manifest.description_md, manifest.requirements, manifest.license,
        JSON.stringify(manifest.author),
        manifest.references ? JSON.stringify(manifest.references) : null,
        manifest.interpretation ? JSON.stringify(manifest.interpretation) : null,
        manifest.metadata ? JSON.stringify(manifest.metadata) : null,
        source.url, source.sha256,
      ],
    )
    packId = r.lastInsertId as number
  }

  // Tests: upsert por code. Re-INSERT preservando id si ya existía (para no romper sesiones).
  for (const t of manifest.tests ?? []) {
    const cfg = JSON.stringify(t.config_json)
    const existsRows = await db.select<{ id: number }[]>(
      'SELECT id FROM test_templates WHERE code=$1',
      [t.code],
    )
    if (existsRows.length > 0) {
      await db.execute(
        `UPDATE test_templates
         SET name=$1, test_type=$2, description=$3, config_json=$4,
             is_standard=$5, pack_id=$6, updated_at=datetime('now')
         WHERE id=$7`,
        [t.name, t.test_type, t.description ?? null, cfg, t.is_standard ?? 1, packId, existsRows[0].id],
      )
    } else {
      await db.execute(
        `INSERT INTO test_templates (code, name, test_type, description, config_json, is_standard, pack_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [t.code, t.name, t.test_type, t.description ?? null, cfg, t.is_standard ?? 1, packId],
      )
    }
  }

  // Listas: upsert por code. Si existía con audios grabados (file_path) los preservamos:
  // solo actualizamos metadata de lista y agregamos items faltantes.
  for (const l of manifest.lists ?? []) {
    const existsRows = await db.select<{ id: number }[]>(
      'SELECT id FROM stimulus_lists WHERE code=$1',
      [l.code],
    )
    let listId: number
    if (existsRows.length > 0) {
      listId = existsRows[0].id
      await db.execute(
        `UPDATE stimulus_lists
         SET name=$1, category=$2, language=$3, country_code=$4, description=$5,
             is_standard=1, pack_id=$6
         WHERE id=$7`,
        [l.name, l.category, l.language ?? 'es', l.country_code ?? null, l.description ?? null, packId, listId],
      )
    } else {
      const r = await db.execute(
        `INSERT INTO stimulus_lists
          (code, name, category, language, country_code, description, is_standard, pack_id)
         VALUES ($1,$2,$3,$4,$5,$6,1,$7)`,
        [l.code, l.name, l.category, l.language ?? 'es', l.country_code ?? null, l.description ?? null, packId],
      )
      listId = r.lastInsertId as number
    }

    for (const it of l.items) {
      const exists = await db.select<{ id: number }[]>(
        'SELECT id FROM stimuli WHERE list_id=$1 AND position=$2',
        [listId, it.pos],
      )
      const kw = it.keywords ? JSON.stringify(it.keywords) : null
      const meta = it.metadata ? JSON.stringify(it.metadata) : null
      if (exists.length > 0) {
        await db.execute(
          `UPDATE stimuli SET token=$1, keywords_json=$2, metadata_json=$3, updated_at=datetime('now') WHERE id=$4`,
          [it.token, kw, meta, exists[0].id],
        )
      } else {
        await db.execute(
          `INSERT INTO stimuli (list_id, position, token, keywords_json, metadata_json) VALUES ($1,$2,$3,$4,$5)`,
          [listId, it.pos, it.token, kw, meta],
        )
      }
    }
  }

  return (await getInstalledPack(manifest.id))!
}

/**
 * Desinstala un pack: borra tests+listas asociados (FK cascade ya borra stimuli).
 * Si existen sesiones que referencian alguno de esos templates, falla con error claro.
 */
export async function uninstallPack(code: string): Promise<void> {
  const db = await getDb()
  const pack = await getInstalledPack(code)
  if (!pack) return

  const blocking = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) AS count FROM test_sessions s
     JOIN test_templates t ON s.template_id = t.id
     WHERE t.pack_id = $1`,
    [pack.id],
  )
  if ((blocking[0]?.count ?? 0) > 0) {
    throw new Error(
      `No se puede desinstalar "${code}": hay ${blocking[0].count} sesión(es) asociadas. Borralas primero o archivá el pack.`,
    )
  }

  await db.execute('DELETE FROM test_templates WHERE pack_id = $1', [pack.id])
  await db.execute('DELETE FROM stimulus_lists WHERE pack_id = $1', [pack.id])
  await db.execute('DELETE FROM packs WHERE id = $1', [pack.id])
}
