import { mkdir, writeFile, readFile, remove, exists, BaseDirectory } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import { convertFileSrc } from '@tauri-apps/api/core'

const SUBDIR = 'stimuli'

export async function ensureStimuliDir(): Promise<string> {
  const base = await appDataDir()
  const dir = await join(base, SUBDIR)
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true })
  }
  return dir
}

export function stimulusFileName(listId: number, position: number, token: string): string {
  const safe = token.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_')
  return `list${listId}_${String(position).padStart(3, '0')}_${safe}.wav`
}

export async function saveStimulusWav(
  listId: number,
  position: number,
  token: string,
  wav: Uint8Array
): Promise<string> {
  await ensureStimuliDir()
  const name = stimulusFileName(listId, position, token)
  await writeFile(`${SUBDIR}/${name}`, wav, { baseDir: BaseDirectory.AppData })
  const base = await appDataDir()
  return await join(base, SUBDIR, name)
}

export async function loadStimulusWav(absPath: string): Promise<Uint8Array> {
  return await readFile(absPath)
}

export async function removeStimulusFile(absPath: string): Promise<void> {
  if (await exists(absPath)) await remove(absPath)
}

export function stimulusAssetUrl(absPath: string): string {
  return convertFileSrc(absPath)
}
