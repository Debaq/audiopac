import { gunzipSync } from 'fflate'
import { fetch as tfetch } from '@tauri-apps/plugin-http'
import { processClip, encodeWav, DEFAULT_PROC } from '@/lib/audio/recording'
import { saveStimulusWav, removeStimulusFile } from '@/lib/fs/stimuli'
import {
  getStimulusListByCode, listStimuli,
  createStimulusList, addStimulusToken,
  updateStimulusRecording, updateStimulusKeywords,
} from '@/lib/db/stimuli'

export const ASSETS_REPO = 'Debaq/audiopac-assets'
export const ASSETS_BRANCH = 'main'
export const ASSETS_RAW = `https://cdn.jsdelivr.net/gh/${ASSETS_REPO}@${ASSETS_BRANCH}`
export const ASSETS_RELEASES = `https://github.com/${ASSETS_REPO}/releases/download`

export interface AssetAudioPack {
  voice: string
  label?: string
  gender?: 'female' | 'male' | 'other'
  speaker_id?: string
  description?: string
  release_tag: string
  asset_name: string
  sha256: string
  bytes: number
  format: string
  channels?: number
  sample_rate?: number
}

export interface AssetCatalogEntry {
  id: string
  name: string
  version: string
  type: 'sentence' | 'srt' | 'discrimination' | 'dichotic_digits' | 'matrix' | 'custom'
  language: string
  region?: string
  license: string
  source?: string
  citation?: string
  lists: number
  items: number
  keywords_per_item?: number
  text_url: string
  text_sha256: string
  text_bytes: number
  audio_packs: AssetAudioPack[]
}

export interface AssetsIndex {
  schema: number
  updated_at: string
  catalogs: AssetCatalogEntry[]
}

export interface CatalogText {
  id: string
  version: string
  schema: number
  license?: string
  source?: string
  citation?: string
  language: string
  region?: string
  lists: Array<{
    code: string
    name: string
    description?: string
    country_code?: string | null
    items: Array<{
      pos: number
      token: string
      keywords: string[]
      audio_id?: string
    }>
  }>
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', bytes as any)
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function fetchIndex(): Promise<AssetsIndex> {
  const r = await tfetch(`${ASSETS_RAW}/index.json`, { cache: 'no-cache' })
  if (!r.ok) throw new Error(`fetch index.json ${r.status}`)
  return await r.json()
}

export async function fetchCatalogText(entry: AssetCatalogEntry): Promise<CatalogText> {
  const r = await tfetch(`${ASSETS_RAW}/${entry.text_url}`, { cache: 'no-cache' })
  if (!r.ok) throw new Error(`fetch ${entry.text_url} ${r.status}`)
  const bytes = new Uint8Array(await r.arrayBuffer())
  const hash = await sha256Hex(bytes)
  if (hash !== entry.text_sha256) {
    throw new Error(`sha256 mismatch: expected ${entry.text_sha256}, got ${hash}`)
  }
  return JSON.parse(new TextDecoder().decode(bytes))
}

export interface InstallProgress {
  stage: 'fetching' | 'validating' | 'seeding' | 'downloading' | 'extracting' | 'processing' | 'done'
  current: number
  total: number
  message?: string
  errors: string[]
}

/**
 * Seed de listas + items desde un catalog text JSON. Idempotente por `code`:
 * si la lista existe, actualiza tokens + keywords preservando file_path grabado.
 */
export async function installTextCatalog(
  entry: AssetCatalogEntry,
  onProgress: (p: InstallProgress) => void
): Promise<InstallProgress> {
  const prog: InstallProgress = { stage: 'fetching', current: 0, total: entry.lists, errors: [] }
  onProgress(prog)

  const catalog = await fetchCatalogText(entry)
  prog.stage = 'seeding'
  prog.total = catalog.lists.length
  onProgress(prog)

  for (let i = 0; i < catalog.lists.length; i++) {
    const def = catalog.lists[i]
    prog.current = i + 1
    prog.message = def.code
    onProgress({ ...prog })
    try {
      let list = await getStimulusListByCode(def.code)
      let listId: number
      if (!list) {
        listId = await createStimulusList({
          code: def.code,
          name: def.name,
          category: entry.type === 'sentence' ? 'sentence' : (entry.type as any),
          language: catalog.language,
          country_code: def.country_code ?? catalog.region ?? null,
          description: def.description ?? null,
        })
      } else {
        listId = list.id
      }
      const existing = await listStimuli(listId)
      const byPos = new Map(existing.map(s => [s.position, s]))

      for (const it of def.items) {
        const prev = byPos.get(it.pos)
        if (!prev) {
          const newId = await addStimulusToken(listId, it.token)
          await updateStimulusKeywords(newId, it.keywords)
        } else {
          // Actualiza keywords siempre; token solo si cambió y no hay grabación
          await updateStimulusKeywords(prev.id, it.keywords)
          // (token update requiere nuevo helper; por ahora solo keywords)
        }
      }
    } catch (e) {
      prog.errors.push(`${def.code}: ${(e as Error).message}`)
    }
  }
  prog.stage = 'done'
  onProgress({ ...prog })
  return prog
}

/* ─── Tar parse (POSIX ustar, subconjunto suficiente para Sharvard) ─── */
function parseTar(bytes: Uint8Array): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>()
  const td = new TextDecoder('utf-8')
  let offset = 0
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512)
    // Fin: dos bloques nulos consecutivos
    if (header.every(b => b === 0)) break
    const name = td.decode(header.subarray(0, 100)).replace(/\0.*$/, '')
    if (!name) { offset += 512; continue }
    const sizeStr = td.decode(header.subarray(124, 136)).replace(/[ \0]+$/, '')
    const size = parseInt(sizeStr, 8) || 0
    const typeFlag = String.fromCharCode(header[156] || 0x30)
    offset += 512
    if (typeFlag === '0' || typeFlag === '\0') {
      const data = bytes.subarray(offset, offset + size)
      // Normalizar path: quitar "./" leading
      const cleanName = name.replace(/^\.\//, '')
      out.set(cleanName, data)
    }
    offset += Math.ceil(size / 512) * 512
  }
  return out
}

/**
 * Instala un pack de audio de un release de audiopac-assets:
 * 1) fetch tarball
 * 2) valida sha256
 * 3) gunzip + tar parse
 * 4) por cada list en el catalog text: match items via audio_id → carga WAV → procesa → guarda
 */
export async function installAudioPack(
  entry: AssetCatalogEntry,
  pack: AssetAudioPack,
  onProgress: (p: InstallProgress) => void
): Promise<InstallProgress> {
  const prog: InstallProgress = { stage: 'downloading', current: 0, total: pack.bytes, errors: [] }
  onProgress(prog)

  const url = `${ASSETS_RELEASES}/${pack.release_tag}/${pack.asset_name}`
  const resp = await tfetch(url)
  if (!resp.ok) throw new Error(`fetch ${pack.asset_name} ${resp.status}`)
  const reader = resp.body?.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        chunks.push(value)
        received += value.byteLength
        prog.current = received
        onProgress({ ...prog })
      }
    }
  } else {
    const ab = await resp.arrayBuffer()
    chunks.push(new Uint8Array(ab))
    received = ab.byteLength
  }
  const gz = new Uint8Array(received)
  let off = 0
  for (const c of chunks) { gz.set(c, off); off += c.byteLength }

  prog.stage = 'validating'
  prog.message = 'sha256'
  onProgress({ ...prog })
  const hash = await sha256Hex(gz)
  if (hash !== pack.sha256) throw new Error(`sha256 mismatch: ${hash} vs ${pack.sha256}`)

  prog.stage = 'extracting'
  prog.message = 'gunzip + tar'
  onProgress({ ...prog })
  const tar = gunzipSync(gz)
  const files = parseTar(tar)

  // Necesitamos el catalog text para mapear audio_id → (list_code, pos, token)
  prog.stage = 'fetching'
  prog.message = 'catalog text'
  onProgress({ ...prog })
  const catalog = await fetchCatalogText(entry)

  prog.stage = 'processing'
  prog.current = 0
  prog.total = entry.items
  onProgress({ ...prog })

  const ctx = new AudioContext()
  try {
    for (const def of catalog.lists) {
      const list = await getStimulusListByCode(def.code)
      if (!list) { prog.errors.push(`${def.code} no existe; instalá el texto primero`); continue }
      const rows = await listStimuli(list.id)
      const byPos = new Map(rows.map(r => [r.position, r]))
      for (const it of def.items) {
        prog.current++
        prog.message = it.audio_id ?? `${def.code}#${it.pos}`
        onProgress({ ...prog })
        const stim = byPos.get(it.pos)
        if (!stim) { prog.errors.push(`${def.code} pos ${it.pos} sin fila`); continue }
        if (!it.audio_id) { prog.errors.push(`${def.code} pos ${it.pos} sin audio_id`); continue }
        const wavName = `${it.audio_id}.wav`
        const wavBytes = files.get(wavName)
        if (!wavBytes) { prog.errors.push(`${wavName} no encontrado en tarball`); continue }
        try {
          const ab = wavBytes.buffer.slice(wavBytes.byteOffset, wavBytes.byteOffset + wavBytes.byteLength) as ArrayBuffer
          const decoded = await ctx.decodeAudioData(ab)
          const { buffer, metrics } = await processClip(decoded, { ...DEFAULT_PROC, denoise: false })
          const outWav = encodeWav(buffer)
          if (stim.file_path) await removeStimulusFile(stim.file_path).catch(() => {})
          const absOut = await saveStimulusWav(list.id, stim.position, stim.token, outWav)
          await updateStimulusRecording(stim.id, {
            file_path: absOut,
            duration_ms: metrics.duration_ms,
            rms_dbfs: metrics.rms_dbfs,
            peak_dbfs: metrics.peak_dbfs,
            sample_rate: metrics.sample_rate,
            normalized: true,
          })
        } catch (e) {
          prog.errors.push(`${wavName}: ${(e as Error).message}`)
        }
      }
    }
  } finally {
    await ctx.close().catch(() => {})
  }

  prog.stage = 'done'
  onProgress({ ...prog })
  return prog
}

export interface LocalCatalogStatus {
  entry: AssetCatalogEntry
  lists_installed: number
  items_with_audio: number
}

/** Estado local: cuántas listas del catálogo ya están en DB y cuántos items tienen audio. */
export async function getLocalStatus(entry: AssetCatalogEntry): Promise<LocalCatalogStatus> {
  let lists_installed = 0
  let items_with_audio = 0
  // Sin catalog text no conocemos los códigos; usamos el patrón del id.
  // Para Sharvard: SHARVARD_ES_L01..L{entry.lists}. Generic: bajamos el text.
  try {
    const catalog = await fetchCatalogText(entry)
    for (const def of catalog.lists) {
      const list = await getStimulusListByCode(def.code)
      if (!list) continue
      lists_installed++
      const rows = await listStimuli(list.id)
      items_with_audio += rows.filter(r => r.file_path).length
    }
  } catch {
    // sin red o sin catalog → 0
  }
  return { entry, lists_installed, items_with_audio }
}
