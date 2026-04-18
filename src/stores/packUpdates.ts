import { create } from 'zustand'
import { fetchPacksIndex, listInstalledPacks } from '@/lib/packs/installer'

export interface PackUpdateInfo {
  id: string
  name: string
  installed: string
  latest: string
}

interface State {
  updates: PackUpdateInfo[]
  installedCount: number
  checking: boolean
  lastCheckAt: number | null
  error: string | null
  refresh: () => Promise<void>
}

// Compara versiones semver simple (N.N.N). Fallback: string comparison.
function isNewer(latest: string, installed: string): boolean {
  const pa = latest.split('.').map(n => parseInt(n, 10))
  const pb = installed.split('.').map(n => parseInt(n, 10))
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const a = pa[i] ?? 0; const b = pb[i] ?? 0
    if (Number.isNaN(a) || Number.isNaN(b)) return latest !== installed
    if (a > b) return true
    if (a < b) return false
  }
  return false
}

export const usePackUpdatesStore = create<State>((set) => ({
  updates: [],
  installedCount: 0,
  checking: false,
  lastCheckAt: null,
  error: null,
  refresh: async () => {
    set({ checking: true, error: null })
    try {
      const [idx, installed] = await Promise.all([fetchPacksIndex(), listInstalledPacks()])
      const byCode = new Map(idx.packs.map(p => [p.id, p]))
      const updates: PackUpdateInfo[] = []
      for (const inst of installed) {
        const remote = byCode.get(inst.code)
        if (!remote) continue
        if (isNewer(remote.version, inst.version)) {
          updates.push({ id: inst.code, name: inst.name, installed: inst.version, latest: remote.version })
        }
      }
      set({ updates, installedCount: installed.length, checking: false, lastCheckAt: Date.now() })
    } catch (e) {
      set({ checking: false, error: (e as Error).message })
    }
  },
}))
