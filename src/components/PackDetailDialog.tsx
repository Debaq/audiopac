import { useEffect, useState } from 'react'
import { X, Download, Trash2, Check, Package, BookOpen, FileAudio, Mic, Music, AlertTriangle, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchPackManifest, installPack, uninstallPack } from '@/lib/packs/installer'
import type { PackManifest, PacksIndexEntry, PackRequirements } from '@/lib/packs/types'
import { Markdown } from '@/lib/markdown'

const REQ: Record<PackRequirements, { icon: typeof Mic; text: string; color: string }> = {
  ninguno: { icon: Music, text: 'Listo para usar', color: 'text-emerald-600' },
  recording: { icon: Mic, text: 'Requiere grabar audio', color: 'text-amber-600' },
  audio_pack: { icon: FileAudio, text: 'Audio en pack adicional', color: 'text-sky-600' },
}

export function PackDetailDialog({
  entry, installedVersion, onClose, onChange,
}: {
  entry: PacksIndexEntry
  installedVersion: string | null
  onClose: () => void
  onChange: () => void
}) {
  const [manifest, setManifest] = useState<PackManifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'install' | 'uninstall' | null>(null)

  useEffect(() => {
    let cancel = false
    fetchPackManifest(entry)
      .then(m => { if (!cancel) setManifest(m) })
      .catch(e => { if (!cancel) setError((e as Error).message) })
    return () => { cancel = true }
  }, [entry])

  const isInstalled = installedVersion !== null
  const needsUpdate = isInstalled && installedVersion !== entry.version

  const install = async () => {
    setBusy('install')
    try {
      const m = manifest ?? await fetchPackManifest(entry)
      await installPack(m, { url: entry.url, sha256: entry.sha256 })
      onChange()
      onClose()
    } catch (e) { alert((e as Error).message) } finally { setBusy(null) }
  }

  const uninstall = async () => {
    if (!confirm(`Desinstalar "${entry.name}"?`)) return
    setBusy('uninstall')
    try {
      await uninstallPack(entry.id)
      onChange()
      onClose()
    } catch (e) { alert((e as Error).message) } finally { setBusy(null) }
  }

  const req = REQ[entry.requirements] ?? REQ.ninguno
  const ReqIcon = req.icon

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto p-4" onClick={onClose}>
      <Card className="max-w-3xl w-full my-4" onClick={e => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 flex-wrap text-lg">
              <Package className="w-5 h-5" />
              {entry.name}
              <Badge className="text-[10px]">v{entry.version}</Badge>
              {isInstalled && !needsUpdate && <Badge className="text-[10px] bg-emerald-600 text-white"><Check className="w-2.5 h-2.5" /> instalado</Badge>}
              {needsUpdate && <Badge className="text-[10px] bg-amber-500 text-white">Update {installedVersion}→{entry.version}</Badge>}
            </CardTitle>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1 font-mono">{entry.id} · {entry.category} · {entry.license}</p>
            <div className={`text-[11px] flex items-center gap-1.5 mt-1 ${req.color}`}>
              <ReqIcon className="w-3 h-3" /> {req.text}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--secondary)]" aria-label="Cerrar"><X className="w-4 h-4" /></button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex gap-2 items-start text-xs p-3 rounded border border-amber-500/60 bg-amber-500/10">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!manifest && !error && <p className="text-xs text-[var(--muted-foreground)]">Cargando manifiesto…</p>}

          {manifest && (
            <>
              {manifest.description_md && (
                <div className="p-3 rounded border border-[var(--border)] bg-[var(--secondary)]/30">
                  <Markdown source={manifest.description_md} />
                </div>
              )}

              {manifest.tests && manifest.tests.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2"><ListChecks className="w-4 h-4" /> Pruebas ({manifest.tests.length})</h3>
                  <ul className="space-y-1 text-xs">
                    {manifest.tests.map(t => (
                      <li key={t.code} className="flex items-start gap-2 p-2 rounded border border-[var(--border)]">
                        <Badge className="text-[10px] shrink-0">{t.test_type}</Badge>
                        <div className="min-w-0 flex-1">
                          <div className="font-mono font-semibold">{t.code}</div>
                          <div>{t.name}</div>
                          {t.description && <div className="text-[var(--muted-foreground)] mt-0.5">{t.description}</div>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {manifest.lists && manifest.lists.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2"><FileAudio className="w-4 h-4" /> Listas ({manifest.lists.length})</h3>
                  <ul className="space-y-1 text-xs">
                    {manifest.lists.map(l => (
                      <li key={l.code} className="flex items-start gap-2 p-2 rounded border border-[var(--border)]">
                        <Badge className="text-[10px] shrink-0">{l.category}</Badge>
                        <div className="min-w-0 flex-1">
                          <div className="font-mono font-semibold">{l.code}</div>
                          <div>{l.name} <span className="text-[var(--muted-foreground)]">· {l.items.length} items</span></div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {manifest.lists_ref && (
                <section className="text-xs p-2 rounded bg-sky-500/10 border border-sky-500/40">
                  <strong>Catálogo referenciado:</strong> <span className="font-mono">{manifest.lists_ref}</span>
                </section>
              )}

              {manifest.interpretation && (
                <section>
                  <h3 className="text-sm font-semibold mb-2">Interpretación clínica</h3>
                  <div className="text-xs p-2 rounded bg-[var(--secondary)]/50">
                    <div><span className="text-[var(--muted-foreground)]">Métrica:</span> <span className="font-mono">{manifest.interpretation.metric}</span></div>
                    {manifest.interpretation.norms_by_age && (
                      <div className="mt-1">
                        <span className="text-[var(--muted-foreground)]">Bandas etarias:</span>{' '}
                        {manifest.interpretation.norms_by_age.map((n, i) =>
                          <span key={i} className="font-mono text-[10px] mr-2">{n.age_min}–{n.age_max}a</span>
                        )}
                      </div>
                    )}
                    {manifest.interpretation.description_md && (
                      <div className="mt-2 text-[11px]"><Markdown source={manifest.interpretation.description_md} /></div>
                    )}
                  </div>
                </section>
              )}

              {manifest.references && manifest.references.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2"><BookOpen className="w-4 h-4" /> Referencias</h3>
                  <ul className="space-y-1 text-xs list-disc pl-5">
                    {manifest.references.map((r, i) => (
                      <li key={i} className="text-[var(--muted-foreground)]">
                        {r.citation}
                        {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="underline ml-1 text-[var(--primary)]">link</a>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {manifest.author && (
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  Autor: {manifest.author.name}
                  {manifest.author.url && <> · <a href={manifest.author.url} target="_blank" rel="noreferrer" className="underline">{manifest.author.url}</a></>}
                </p>
              )}
            </>
          )}

          <div className="flex gap-2 justify-end pt-2 border-t border-[var(--border)]">
            <Button variant="outline" onClick={onClose} disabled={!!busy}>Cerrar</Button>
            {isInstalled && (
              <Button variant="outline" onClick={uninstall} disabled={!!busy}>
                <Trash2 className="w-4 h-4" /> Desinstalar
              </Button>
            )}
            <Button onClick={install} disabled={!!busy || !manifest}>
              <Download className="w-4 h-4" />
              {needsUpdate ? 'Actualizar' : isInstalled ? 'Reinstalar' : 'Instalar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
