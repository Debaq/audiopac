import { useEffect, useState } from 'react'
import { Package, Download, Trash2, AlertTriangle, Check, RefreshCw, Mic, Music, FileAudio, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SearchBar } from '@/components/ui/SearchBar'
import { FilterChips, type ChipOption } from '@/components/ui/FilterChips'
import {
  fetchPacksIndex, fetchPackManifest, installPack, uninstallPack, listInstalledPacks,
  type PacksIndex, type InstalledPack,
} from '@/lib/packs/installer'
import type { PacksIndexEntry, PackRequirements } from '@/lib/packs/types'
import { PackDetailDialog } from '@/components/PackDetailDialog'
import { usePackUpdatesStore } from '@/stores/packUpdates'

const REQ_LABEL: Record<PackRequirements, { icon: typeof Mic; text: string; color: string }> = {
  ninguno: { icon: Music, text: 'Listo para usar', color: 'text-emerald-600' },
  recording: { icon: Mic, text: 'Requiere grabar audio', color: 'text-amber-600' },
  audio_pack: { icon: FileAudio, text: 'Audio en pack adicional', color: 'text-sky-600' },
}

type StateFilter = 'all' | 'installed' | 'available' | 'updates'
type ReqFilter = 'all' | PackRequirements

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

export function PacksSection() {
  const [index, setIndex] = useState<PacksIndex | null>(null)
  const [installed, setInstalled] = useState<Record<string, InstalledPack>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [detail, setDetail] = useState<PacksIndexEntry | null>(null)
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')
  const [reqFilter, setReqFilter] = useState<ReqFilter>('all')
  const refreshGlobal = usePackUpdatesStore(s => s.refresh)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const [idx, list] = await Promise.all([fetchPacksIndex(), listInstalledPacks()])
      setIndex(idx)
      const map: Record<string, InstalledPack> = {}
      for (const p of list) map[p.code] = p
      setInstalled(map)
      refreshGlobal().catch(() => {})
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function runInstall(entry: PacksIndexEntry) {
    if (busy) return
    setBusy(`install:${entry.id}`)
    try {
      const manifest = await fetchPackManifest(entry)
      await installPack(manifest, { url: entry.url, sha256: entry.sha256 })
      await load()
    } catch (e) {
      alert(`Error instalando ${entry.id}: ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  async function runUninstall(entry: PacksIndexEntry) {
    if (busy) return
    if (!confirm(`Desinstalar "${entry.name}"? Se borrarán las pruebas y listas asociadas (los audios grabados quedan en disco).`)) return
    setBusy(`uninstall:${entry.id}`)
    try {
      await uninstallPack(entry.id)
      await load()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mb-8">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2"><Package className="w-5 h-5" /> Paquetes de pruebas</h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            Cada pack agrupa pruebas + listas + interpretación clínica. Instalá solo los que vayas a usar.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading || !!busy}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refrescar
        </Button>
      </div>

      {error && (
        <Card className="border-amber-500/50 bg-amber-500/5 mb-3">
          <CardContent className="pt-4 flex gap-2 items-start text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">No se pudo cargar el índice de paquetes</p>
              <p className="mt-1 text-[var(--muted-foreground)]">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && !index && <p className="text-xs text-[var(--muted-foreground)]">Cargando índice…</p>}

      {index && (() => {
        const packs = index.packs
        const counts = {
          all: packs.length,
          installed: packs.filter(p => installed[p.id] && installed[p.id].version === p.version).length,
          available: packs.filter(p => !installed[p.id]).length,
          updates: packs.filter(p => installed[p.id] && installed[p.id].version !== p.version).length,
        }
        const stateOpts: ChipOption<StateFilter>[] = [
          { value: 'all', label: 'Todos', count: counts.all },
          { value: 'installed', label: 'Instalados', count: counts.installed },
          { value: 'available', label: 'Disponibles', count: counts.available },
          { value: 'updates', label: 'Actualizaciones', count: counts.updates },
        ]
        const reqOpts: ChipOption<ReqFilter>[] = [
          { value: 'all', label: 'Requisito: todos' },
          { value: 'ninguno', label: 'Listo' },
          { value: 'recording', label: 'Requiere grabación' },
          { value: 'audio_pack', label: 'Requiere audio pack' },
        ]
        const nq = query.trim() ? norm(query.trim()) : ''
        const filtered = packs.filter(p => {
          const inst = installed[p.id]
          if (stateFilter === 'installed' && !(inst && inst.version === p.version)) return false
          if (stateFilter === 'available' && inst) return false
          if (stateFilter === 'updates' && !(inst && inst.version !== p.version)) return false
          if (reqFilter !== 'all' && p.requirements !== reqFilter) return false
          if (!nq) return true
          return norm(p.name).includes(nq) || norm(p.id).includes(nq) || norm(p.category).includes(nq)
        })
        return (
        <>
        <div className="mb-3 space-y-2">
          <SearchBar value={query} onChange={setQuery} placeholder="Buscar pack por nombre, id o categoría..." />
          <div className="flex gap-3 flex-wrap">
            <FilterChips options={stateOpts} value={stateFilter} onChange={setStateFilter} />
            <FilterChips options={reqOpts} value={reqFilter} onChange={setReqFilter} />
          </div>
        </div>
        {filtered.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">Sin coincidencias.</p>
        ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map(p => {
            const inst = installed[p.id]
            const isInstalled = !!inst
            const versionMismatch = isInstalled && inst.version !== p.version
            const req = REQ_LABEL[p.requirements] ?? REQ_LABEL.ninguno
            const Icon = req.icon
            return (
              <Card key={p.id} className={isInstalled ? 'border-emerald-500/40' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-sm flex items-center gap-1.5 flex-wrap">
                        {p.name}
                        <Badge className="text-[10px]">v{p.version}</Badge>
                        {isInstalled && !versionMismatch && <Badge className="text-[10px] bg-emerald-600 text-white"><Check className="w-2.5 h-2.5" /></Badge>}
                        {versionMismatch && <Badge className="text-[10px] bg-amber-500 text-white">Update {inst.version}→{p.version}</Badge>}
                      </CardTitle>
                      <CardDescription className="text-[11px] mt-1">
                        <span className="font-mono">{p.id}</span> · {p.category} · {p.license}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className={`text-[11px] flex items-center gap-1.5 mb-2 ${req.color}`}>
                    <Icon className="w-3 h-3" /> {req.text}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={isInstalled && !versionMismatch ? 'outline' : 'default'}
                      onClick={() => runInstall(p)}
                      disabled={!!busy}
                    >
                      <Download className="w-3.5 h-3.5" />
                      {versionMismatch ? 'Actualizar' : isInstalled ? 'Reinstalar' : 'Instalar'}
                    </Button>
                    {isInstalled && (
                      <Button size="sm" variant="outline" onClick={() => runUninstall(p)} disabled={!!busy}>
                        <Trash2 className="w-3.5 h-3.5" /> Desinstalar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDetail(p)}
                      disabled={!!busy}
                      className="ml-auto"
                    >
                      <Info className="w-3.5 h-3.5" /> Detalle
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
        )}
        </>
        )
      })()}

      {detail && (
        <PackDetailDialog
          entry={detail}
          installedVersion={installed[detail.id]?.version ?? null}
          onClose={() => setDetail(null)}
          onChange={load}
        />
      )}
    </div>
  )
}
