import { useEffect, useState } from 'react'
import { Package, Download, RefreshCw, AlertTriangle, Check, ExternalLink, FileDown, Mic, User, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PacksSection } from '@/components/PacksSection'
import {
  fetchIndex, installTextCatalog, installAudioPack, getLocalStatus,
  type AssetsIndex, type AssetCatalogEntry, type AssetAudioPack, type InstallProgress, type LocalCatalogStatus,
  ASSETS_REPO,
} from '@/lib/assets/catalogs'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function stageLabel(s: InstallProgress['stage']): string {
  switch (s) {
    case 'fetching': return 'Descargando manifiesto'
    case 'validating': return 'Validando hash'
    case 'seeding': return 'Creando listas'
    case 'downloading': return 'Descargando pack'
    case 'extracting': return 'Descomprimiendo'
    case 'processing': return 'Procesando audio'
    case 'done': return 'Completado'
  }
}

export function CatalogsPage() {
  const [index, setIndex] = useState<AssetsIndex | null>(null)
  const [statuses, setStatuses] = useState<Record<string, LocalCatalogStatus>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState<InstallProgress | null>(null)
  const [packsReloadKey, setPacksReloadKey] = useState(0)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const idx = await fetchIndex()
      setIndex(idx)
      const sts: Record<string, LocalCatalogStatus> = {}
      for (const c of idx.catalogs) sts[c.id] = await getLocalStatus(c)
      setStatuses(sts)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const runInstallText = async (entry: AssetCatalogEntry) => {
    if (busy) return
    setBusy(`text:${entry.id}`)
    setProgress({ stage: 'fetching', current: 0, total: entry.lists, errors: [] })
    try {
      const final = await installTextCatalog(entry, p => setProgress({ ...p }))
      alert(`Catálogo "${entry.name}" instalado.\n✓ ${final.total - final.errors.length}/${final.total} listas\n${final.errors.length > 0 ? `✗ ${final.errors.length} errores (consola)` : ''}`)
      if (final.errors.length > 0) console.warn(final.errors)
      await load()
    } catch (e) {
      alert('Error: ' + (e as Error).message)
    } finally {
      setBusy(null); setProgress(null)
    }
  }

  const runInstallAudio = async (entry: AssetCatalogEntry, pack: AssetAudioPack) => {
    if (busy) return
    const status = statuses[entry.id]
    if (!status || status.lists_installed === 0) {
      alert('Instalá primero el texto del catálogo.')
      return
    }
    if (!confirm(`Bajar ${pack.asset_name} (${formatBytes(pack.bytes)}) y reemplazar grabaciones existentes de ${entry.name}?`)) return
    setBusy(`audio:${entry.id}:${pack.voice}`)
    setProgress({ stage: 'downloading', current: 0, total: pack.bytes, errors: [] })
    try {
      const final = await installAudioPack(entry, pack, p => setProgress({ ...p }))
      alert(`Pack audio "${entry.name} ${pack.voice}" instalado.\n✓ ${entry.items - final.errors.length}/${entry.items}\n${final.errors.length > 0 ? `✗ ${final.errors.length} errores (consola)` : ''}`)
      if (final.errors.length > 0) console.warn(final.errors)
      await load()
    } catch (e) {
      alert('Error: ' + (e as Error).message)
    } finally {
      setBusy(null); setProgress(null)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Package className="w-7 h-7" /> Catálogos</h1>
          <p className="text-[var(--muted-foreground)]">
            Bajá listas de estímulos y packs de audio desde <a href={`https://github.com/${ASSETS_REPO}`} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">{ASSETS_REPO} <ExternalLink className="w-3 h-3" /></a>
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { load(); setPacksReloadKey(k => k + 1) }} disabled={loading || !!busy}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refrescar
        </Button>
      </div>

      {error && (
        <Card className="border-amber-500/50 bg-amber-500/5 mb-4">
          <CardContent className="pt-5 flex gap-3 items-start text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">No se pudo cargar el manifiesto</p>
              <p className="text-xs mt-1 text-[var(--muted-foreground)]">{error}</p>
              <p className="text-xs mt-1 text-[var(--muted-foreground)]">Revisa conexión o permisos de red.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {progress && (
        <Card className="mb-4 border-[var(--primary)]/40">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium">{stageLabel(progress.stage)}</span>
              <span className="text-[var(--muted-foreground)]">
                {progress.stage === 'downloading'
                  ? `${formatBytes(progress.current)} / ${formatBytes(progress.total)}`
                  : `${progress.current}/${progress.total}`}
                {progress.errors.length > 0 && ` · ${progress.errors.length} err.`}
              </span>
            </div>
            {progress.message && <div className="text-[10px] text-[var(--muted-foreground)] mb-1.5 truncate">{progress.message}</div>}
            <div className="h-2 bg-[var(--secondary)] rounded overflow-hidden">
              <div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${(progress.current / Math.max(1, progress.total)) * 100}%` }} />
            </div>
          </CardContent>
        </Card>
      )}

      <PacksSection reloadKey={packsReloadKey} />

      <h2 className="text-xl font-semibold mb-3 mt-2">Corpus de habla (texto + audio)</h2>

      {loading && !index && <p className="text-sm text-[var(--muted-foreground)]">Cargando manifiesto…</p>}

      {index && (
        <div className="space-y-4">
          {index.catalogs.map(c => {
            const st = statuses[c.id]
            const textInstalled = st && st.lists_installed === c.lists
            const partialText = st && st.lists_installed > 0 && st.lists_installed < c.lists
            const audioInstalled = st ? st.items_with_audio : 0
            return (
              <Card key={c.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {c.name}
                        <Badge className="text-[10px]">v{c.version}</Badge>
                        <Badge className="text-[10px] bg-[var(--secondary)] text-[var(--foreground)]">{c.type}</Badge>
                        <Badge className="text-[10px] bg-[var(--secondary)] text-[var(--foreground)]">{c.license}</Badge>
                      </CardTitle>
                      <CardDescription>
                        {c.language}{c.region ? `-${c.region}` : ''} · {c.lists} listas · {c.items} ítems
                        {c.citation && <span className="block text-[10px] mt-1 italic">{c.citation}</span>}
                        {c.source && (
                          <a href={c.source} target="_blank" rel="noreferrer" className="text-[10px] underline inline-flex items-center gap-1 mt-1">
                            Fuente <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </CardDescription>
                    </div>
                    <div className="text-right text-xs text-[var(--muted-foreground)]">
                      <div>Texto: {textInstalled ? <span className="text-emerald-600 inline-flex items-center gap-1"><Check className="w-3 h-3" /> completo</span> : partialText ? <span className="text-amber-600">{st.lists_installed}/{c.lists}</span> : 'no instalado'}</div>
                      <div>Audio: {audioInstalled} / {c.items}</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => runInstallText(c)}
                      disabled={!!busy}
                      variant={textInstalled ? 'outline' : 'default'}
                    >
                      <FileDown className="w-4 h-4" /> {textInstalled ? 'Re-instalar texto' : 'Instalar texto'}
                      <span className="ml-1 text-[10px] opacity-70">({formatBytes(c.text_bytes)})</span>
                    </Button>
                  </div>
                  {c.audio_packs.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {c.audio_packs.map(p => {
                        const Icon = p.gender === 'male' ? User : p.gender === 'female' ? UserRound : Mic
                        return (
                          <div key={p.voice} className="flex items-start gap-3 p-2.5 rounded-md border border-[var(--border)]/50">
                            <Icon className="w-4 h-4 mt-0.5 text-[var(--muted-foreground)] shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                                {p.label ?? `Voz ${p.voice}`}
                                {p.speaker_id && <Badge className="text-[10px] bg-[var(--secondary)] text-[var(--foreground)]">{p.speaker_id}</Badge>}
                                <span className="text-[10px] text-[var(--muted-foreground)] font-normal">{formatBytes(p.bytes)} · {p.format.toUpperCase()}{p.channels ? ` · ${p.channels === 1 ? 'mono' : 'estéreo'}` : ''}</span>
                              </div>
                              {p.description && (
                                <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 leading-relaxed">{p.description}</p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => runInstallAudio(c, p)}
                              disabled={!!busy || !textInstalled}
                              className="shrink-0"
                            >
                              <Download className="w-4 h-4" /> Instalar
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {!textInstalled && c.audio_packs.length > 0 && (
                    <p className="text-[10px] text-[var(--muted-foreground)] mt-2">
                      Instalá el texto primero para habilitar los packs de audio.
                    </p>
                  )}
                  {c.audio_packs.length === 0 && (
                    <p className="text-[10px] text-[var(--muted-foreground)] mt-2 flex items-center gap-1">
                      <Mic className="w-3 h-3" /> Sin audios redistribuibles. Graba voces propias en /estimulos.
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
