import { useEffect, useState } from 'react'
import { Package, Download, Mic, Music, FileAudio, Check, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  fetchPacksIndex, fetchPackManifest, installPack,
  type PacksIndex,
} from '@/lib/packs/installer'
import type { PackRequirements, PacksIndexEntry } from '@/lib/packs/types'
import { setSetting } from '@/lib/db/client'

const RECOMMENDED = new Set([
  'pac-patterns-v1',
  'pac-limens-v1',
  'pac-temporal-v1',
])

const REQ: Record<PackRequirements, { icon: typeof Mic; text: string; color: string }> = {
  ninguno: { icon: Music, text: 'Listo para usar', color: 'text-emerald-600' },
  recording: { icon: Mic, text: 'Requiere grabar audio', color: 'text-amber-600' },
  audio_pack: { icon: FileAudio, text: 'Requiere pack de audio', color: 'text-sky-600' },
}

export function BootstrapDialog({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState<PacksIndex | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [installing, setInstalling] = useState(false)
  const [progressIdx, setProgressIdx] = useState<number>(0)
  const [currentLabel, setCurrentLabel] = useState<string>('')

  useEffect(() => {
    (async () => {
      try {
        const idx = await fetchPacksIndex()
        setIndex(idx)
        const preset = new Set<string>()
        for (const p of idx.packs) if (RECOMMENDED.has(p.id)) preset.add(p.id)
        setSelected(preset)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const finish = async () => {
    await setSetting('bootstrap_done', '1')
    onDone()
  }

  const install = async () => {
    if (!index || installing) return
    const targets = index.packs.filter(p => selected.has(p.id))
    if (targets.length === 0) { await finish(); return }
    setInstalling(true)
    try {
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i]
        setProgressIdx(i); setCurrentLabel(t.name)
        const manifest = await fetchPackManifest(t)
        await installPack(manifest, { url: t.url, sha256: t.sha256 })
      }
      await finish()
    } catch (e) {
      setError((e as Error).message)
      setInstalling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto p-6">
      <Card className="max-w-3xl w-full my-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl"><Package className="w-6 h-6" /> Bienvenido a AudioPAC</CardTitle>
          <CardDescription>
            La app viene vacía. Elige qué paquetes de pruebas instalar para empezar. Podrás cambiarlos después desde <span className="font-mono">Catálogos</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex gap-2 items-start text-xs p-3 rounded border border-amber-500/60 bg-amber-500/10">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">No se pudo cargar el índice de paquetes</p>
                <p className="mt-1 text-[var(--muted-foreground)]">{error}</p>
                <p className="mt-1 text-[var(--muted-foreground)]">Puedes continuar sin instalar y hacerlo luego desde Catálogos.</p>
              </div>
            </div>
          )}

          {loading && <p className="text-sm text-[var(--muted-foreground)]">Cargando índice…</p>}

          {installing && (
            <div className="p-3 rounded border border-[var(--primary)]/40">
              <div className="flex justify-between text-xs mb-1">
                <span>Instalando {progressIdx + 1}/{selected.size}</span>
                <span className="text-[var(--muted-foreground)]">{currentLabel}</span>
              </div>
              <div className="h-2 bg-[var(--secondary)] rounded overflow-hidden">
                <div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${((progressIdx) / Math.max(1, selected.size)) * 100}%` }} />
              </div>
            </div>
          )}

          {index && !installing && (
            <div className="grid gap-2 md:grid-cols-2">
              {index.packs.map(p => {
                const req = REQ[p.requirements] ?? REQ.ninguno
                const Icon = req.icon
                const recommended = RECOMMENDED.has(p.id)
                const checked = selected.has(p.id)
                return (
                  <label
                    key={p.id}
                    className={`flex gap-2 items-start p-2.5 rounded border cursor-pointer transition-colors ${checked ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)]'}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 shrink-0"
                      checked={checked}
                      onChange={() => toggle(p.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap text-sm">
                        <span className="font-medium">{p.name}</span>
                        <Badge className="text-[10px]">v{p.version}</Badge>
                        {recommended && <Badge className="text-[10px] bg-emerald-600 text-white"><Check className="w-2.5 h-2.5" /> recomendado</Badge>}
                      </div>
                      <div className={`text-[11px] flex items-center gap-1 mt-0.5 ${req.color}`}>
                        <Icon className="w-3 h-3" /> {req.text}
                      </div>
                      <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5 font-mono">{p.id} · {p.category}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          )}

          <div className="flex justify-between items-center gap-2 pt-2">
            <button
              type="button"
              className="text-xs text-[var(--muted-foreground)] underline disabled:opacity-50"
              onClick={finish}
              disabled={installing}
            >
              Omitir e instalar luego
            </button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => selectedAll(index, selected, setSelected)} disabled={loading || installing || !index}>
                {index && selected.size === index.packs.length ? 'Ninguno' : 'Todos'}
              </Button>
              <Button onClick={install} disabled={loading || installing || !index}>
                <Download className="w-4 h-4" />
                {selected.size === 0 ? 'Continuar' : `Instalar ${selected.size}`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function selectedAll(
  index: PacksIndex | null,
  selected: Set<string>,
  setSelected: (s: Set<string>) => void,
) {
  if (!index) return
  if (selected.size === index.packs.length) setSelected(new Set())
  else setSelected(new Set(index.packs.map((p: PacksIndexEntry) => p.id)))
}
