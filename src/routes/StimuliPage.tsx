import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Mic, Square, Play, Trash2, Plus, RefreshCw, Check, AlertTriangle, Globe, Scissors, Layers } from 'lucide-react'
import { StimulusEditDialog } from '@/components/StimulusEditDialog'
import { BatchRecordDialog } from '@/components/BatchRecordDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { SearchBar } from '@/components/ui/SearchBar'
import { FilterChips, type ChipOption } from '@/components/ui/FilterChips'
import {
  listStimulusLists, listStimuli, createStimulusList, deleteStimulusList,
  addStimulusToken, updateStimulusRecording, clearStimulusRecording, deleteStimulus,
  updateStimulusKeywords, parseKeywords,
} from '@/lib/db/stimuli'
import { saveStimulusWav, removeStimulusFile, loadStimulusWav } from '@/lib/fs/stimuli'
import {
  startMicRecording, processClip, encodeWav, measureBuffer, DEFAULT_PROC,
} from '@/lib/audio/recording'
import { playStimulusBuffer, loadStimulusBuffer } from '@/lib/audio/engine'
import { useSettingsStore, COUNTRY_OPTIONS } from '@/stores/settings'
import { useAuth } from '@/stores/auth'
import type { StimulusList, Stimulus, StimulusCategory } from '@/types'

function normalizeWord(w: string): string {
  return w.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^\p{L}\p{N}]+/gu, '')
}

function tokenizeSentence(s: string): string[] {
  return s.split(/\s+/).filter(Boolean)
}

const CATEGORIES: { value: StimulusCategory; label: string }[] = [
  { value: 'srt', label: 'SRT (bisílabos)' },
  { value: 'discrimination', label: 'Discriminación' },
  { value: 'dichotic_digits', label: 'Dichotic Digits' },
  { value: 'sentence', label: 'Oraciones' },
  { value: 'matrix', label: 'Matrix (5 columnas)' },
  { value: 'custom', label: 'Personalizada' },
]

export function StimuliPage() {
  const profile = useAuth(s => s.activeProfile)
  const { countryCode, loaded, load, setCountryCode } = useSettingsStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedListCode = searchParams.get('list')
  const returnTo = searchParams.get('returnTo')

  const [lists, setLists] = useState<StimulusList[]>([])
  const [selectedListId, setSelectedListId] = useState<number | null>(null)
  const [items, setItems] = useState<Stimulus[]>([])

  const [newListName, setNewListName] = useState('')
  const [newListCat, setNewListCat] = useState<StimulusCategory>('custom')
  const [newListCountry, setNewListCountry] = useState(countryCode)

  const [listQuery, setListQuery] = useState('')
  const [catFilter, setCatFilter] = useState<'all' | StimulusCategory>('all')

  const [newToken, setNewToken] = useState('')

  const [showAllCountries, setShowAllCountries] = useState(false)
  const [editStimulus, setEditStimulus] = useState<Stimulus | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)
  const [recordingId, setRecordingId] = useState<number | null>(null)
  const recRef = useRef<Awaited<ReturnType<typeof startMicRecording>> | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [playingId, setPlayingId] = useState<number | null>(null)
  const stopRef = useRef<(() => void) | null>(null)

  useEffect(() => { if (!loaded) load() }, [loaded, load])
  useEffect(() => { setNewListCountry(countryCode) }, [countryCode])

  const refreshLists = async () => {
    // Si viene ?list=CODE, cargamos sin filtro país para garantizar que la lista aparezca aunque sea de otra región.
    const ignoreCountry = showAllCountries || !!requestedListCode
    const rows = await listStimulusLists(ignoreCountry ? undefined : countryCode)
    setLists(rows)
    if (requestedListCode) {
      const match = rows.find(l => l.code === requestedListCode)
      if (match) { setSelectedListId(match.id); return }
    }
    if (rows.length > 0 && (selectedListId == null || !rows.find(l => l.id === selectedListId))) {
      setSelectedListId(rows[0].id)
    } else if (rows.length === 0) {
      setSelectedListId(null)
    }
  }

  const refreshItems = async () => {
    if (selectedListId == null) { setItems([]); return }
    setItems(await listStimuli(selectedListId))
  }

  useEffect(() => { if (loaded) refreshLists() }, [loaded, countryCode, showAllCountries, requestedListCode])
  useEffect(() => { refreshItems() }, [selectedListId])

  const selectedList = useMemo(() => lists.find(l => l.id === selectedListId) ?? null, [lists, selectedListId])

  const filteredLists = useMemo(() => {
    const nq = listQuery.trim()
      ? listQuery.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
      : ''
    return lists.filter(l => {
      if (catFilter !== 'all' && l.category !== catFilter) return false
      if (!nq) return true
      const hay = (l.name + ' ' + l.code + ' ' + (l.description ?? ''))
        .toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
      return hay.includes(nq)
    })
  }, [lists, listQuery, catFilter])

  const catCounts = useMemo(() => {
    const m: Record<string, number> = { all: lists.length }
    for (const l of lists) m[l.category] = (m[l.category] ?? 0) + 1
    return m
  }, [lists])

  const catOptions: ChipOption<'all' | StimulusCategory>[] = useMemo(() => {
    const base: ChipOption<'all' | StimulusCategory>[] = [
      { value: 'all', label: 'Todas', count: catCounts.all },
    ]
    for (const c of CATEGORIES) {
      if (catCounts[c.value]) base.push({ value: c.value, label: c.label, count: catCounts[c.value] })
    }
    return base
  }, [catCounts])

  const createList = async () => {
    if (!newListName.trim()) return
    const code = `USR_${Date.now()}`
    await createStimulusList({
      code,
      name: newListName.trim(),
      category: newListCat,
      country_code: newListCountry,
      created_by: profile?.id ?? null,
    })
    setNewListName('')
    await refreshLists()
  }

  const removeList = async (id: number) => {
    const l = lists.find(x => x.id === id)
    if (!l) return
    if (l.is_standard === 1) { alert('Listas estándar no se eliminan. Desactívala si no la quieres ver.'); return }
    if (!confirm(`¿Eliminar lista "${l.name}" y todas sus grabaciones?`)) return
    const its = await listStimuli(id)
    for (const it of its) if (it.file_path) await removeStimulusFile(it.file_path).catch(() => {})
    await deleteStimulusList(id)
    await refreshLists()
  }

  const addToken = async () => {
    if (!selectedListId || !newToken.trim()) return
    await addStimulusToken(selectedListId, newToken.trim())
    setNewToken('')
    await refreshItems()
  }

  const removeToken = async (s: Stimulus) => {
    if (!confirm(`¿Quitar "${s.token}"?`)) return
    if (s.file_path) await removeStimulusFile(s.file_path).catch(() => {})
    await deleteStimulus(s.id)
    await refreshItems()
  }

  const startRec = async (s: Stimulus) => {
    try {
      const rec = await startMicRecording()
      recRef.current = rec
      setRecordingId(s.id)
    } catch (e) {
      alert('No se pudo acceder al micrófono: ' + (e as Error).message)
    }
  }

  const stopRec = async (s: Stimulus) => {
    if (!recRef.current) return
    setBusyId(s.id)
    try {
      const clip = await recRef.current.stop()
      recRef.current = null
      setRecordingId(null)

      const { buffer, metrics } = await processClip(clip.buffer, DEFAULT_PROC)
      const wav = encodeWav(buffer)

      if (s.file_path) await removeStimulusFile(s.file_path).catch(() => {})
      const absPath = await saveStimulusWav(s.list_id, s.position, s.token, wav)

      await updateStimulusRecording(s.id, {
        file_path: absPath,
        duration_ms: metrics.duration_ms,
        rms_dbfs: metrics.rms_dbfs,
        peak_dbfs: metrics.peak_dbfs,
        sample_rate: metrics.sample_rate,
        normalized: true,
      })
      await refreshItems()
    } catch (e) {
      alert('Error procesando: ' + (e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const cancelRec = () => {
    recRef.current?.cancel()
    recRef.current = null
    setRecordingId(null)
  }

  const preview = async (s: Stimulus) => {
    if (playingId === s.id) {
      stopRef.current?.()
      stopRef.current = null
      setPlayingId(null)
      return
    }
    if (!s.file_path) return
    try {
      const bytes = await loadStimulusWav(s.file_path)
      const buf = await loadStimulusBuffer(s.file_path, bytes)
      const stop = await playStimulusBuffer(buf, 60, {
        ear: 'binaural',
        rms_dbfs: s.rms_dbfs,
        onEnd: () => { setPlayingId(null); stopRef.current = null },
      })
      stopRef.current = stop
      setPlayingId(s.id)
    } catch (e) {
      alert('Error reproduciendo: ' + (e as Error).message)
    }
  }

  const reanalyze = async (s: Stimulus) => {
    if (!s.file_path) return
    setBusyId(s.id)
    try {
      const bytes = await loadStimulusWav(s.file_path)
      const ctx = new AudioContext()
      const buf = await ctx.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
      await ctx.close()
      const m = measureBuffer(buf)
      await updateStimulusRecording(s.id, {
        file_path: s.file_path,
        duration_ms: m.duration_ms,
        rms_dbfs: m.rms_dbfs,
        peak_dbfs: m.peak_dbfs,
        sample_rate: m.sample_rate,
        normalized: s.normalized === 1,
      })
      await refreshItems()
    } finally {
      setBusyId(null)
    }
  }

  const toggleKeyword = async (s: Stimulus, word: string) => {
    const norm = normalizeWord(word)
    const current = parseKeywords(s)
    const has = current.includes(norm)
    const next = has ? current.filter(w => w !== norm) : [...current, norm]
    await updateStimulusKeywords(s.id, next)
    await refreshItems()
  }

  const clearRec = async (s: Stimulus) => {
    if (!confirm(`¿Borrar grabación de "${s.token}"?`)) return
    if (s.file_path) await removeStimulusFile(s.file_path).catch(() => {})
    await clearStimulusRecording(s.id)
    await refreshItems()
  }

  const recordedCount = items.filter(s => s.file_path).length
  const progress = items.length === 0 ? 0 : Math.round((recordedCount / items.length) * 100)

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Estudio</h1>
          <p className="text-[var(--muted-foreground)]">
            Graba, procesa y normaliza listas para logoaudiometría y PAC verbales.
          </p>
        </div>
        {returnTo && (
          <Button variant="outline" size="sm" onClick={() => navigate(returnTo)}>
            ← Volver al editor
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            <Globe className="w-4 h-4" /> País / dialecto
          </span>
          <Select
            value={countryCode}
            onChange={e => setCountryCode(e.target.value)}
            className="max-w-xs"
            disabled={showAllCountries}
          >
            {COUNTRY_OPTIONS.map(c => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </Select>
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showAllCountries}
              onChange={e => setShowAllCountries(e.target.checked)}
            />
            <span>Ver listas de <b>todas las regiones</b> (p.ej. Sharvard ES)</span>
          </label>
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        <Card className="col-span-4 flex flex-col min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Listas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 flex flex-col flex-1 min-h-0">
            <SearchBar value={listQuery} onChange={setListQuery} placeholder="Buscar lista..." className="mb-1" />
            <div className="overflow-x-auto -mx-1 px-1 pb-1">
              <FilterChips options={catOptions} value={catFilter} onChange={setCatFilter} className="flex-nowrap" />
            </div>
            {lists.length === 0 && <p className="text-xs text-[var(--muted-foreground)]">No hay listas para este país.</p>}
            {lists.length > 0 && filteredLists.length === 0 && (
              <p className="text-xs text-[var(--muted-foreground)]">Sin coincidencias.</p>
            )}
            <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
            {filteredLists.map(l => (
              <div
                key={l.id}
                className={`p-2.5 rounded-md cursor-pointer border transition-colors ${selectedListId === l.id ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)]/50 hover:bg-[var(--secondary)]'}`}
                onClick={() => setSelectedListId(l.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate flex-1">{l.name}</span>
                  {l.is_standard === 1 && <Badge className="text-[10px]">std</Badge>}
                </div>
                <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5 flex items-center gap-1.5">
                  <span>{CATEGORIES.find(c => c.value === l.category)?.label ?? l.category}</span>
                  {l.country_code && <span>· {l.country_code}</span>}
                </div>
                {l.is_standard !== 1 && (
                  <button
                    className="text-[11px] text-red-500 hover:underline mt-1"
                    onClick={(e) => { e.stopPropagation(); removeList(l.id) }}
                  >Eliminar</button>
                )}
              </div>
            ))}
            </div>

            <div className="pt-2 border-t border-[var(--border)]/50 mt-3 space-y-2">
              <Input placeholder="Nombre nueva lista" value={newListName} onChange={e => setNewListName(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Select value={newListCat} onChange={e => setNewListCat(e.target.value as StimulusCategory)}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
                <Select value={newListCountry} onChange={e => setNewListCountry(e.target.value)}>
                  {COUNTRY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                </Select>
              </div>
              <Button size="sm" onClick={createList} disabled={!newListName.trim()} className="w-full">
                <Plus className="w-3.5 h-3.5" /> Crear lista
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="col-span-8 flex flex-col gap-4 min-h-0">
          {selectedList ? (
            <>
              <Card className="flex flex-col flex-1 min-h-0">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{selectedList.name}</CardTitle>
                      <CardDescription>
                        {selectedList.description ?? CATEGORIES.find(c => c.value === selectedList.category)?.label}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{recordedCount}<span className="text-base text-[var(--muted-foreground)]">/{items.length}</span></div>
                      <div className="text-[11px] text-[var(--muted-foreground)]">grabados ({progress}%)</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 min-h-0">
                  <div className="flex gap-2 mb-3">
                    <Input
                      placeholder="Nuevo token (palabra / frase)"
                      value={newToken}
                      onChange={e => setNewToken(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addToken() }}
                    />
                    <Button onClick={addToken} disabled={!newToken.trim()}>
                      <Plus className="w-4 h-4" /> Agregar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setBatchOpen(true)}
                      disabled={items.length === 0 || recordingId != null}
                      title="Grabar todos los tokens en una toma"
                    >
                      <Layers className="w-4 h-4" /> Grabar todos
                    </Button>
                  </div>

                  {items.length === 0 ? (
                    <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
                      Sin tokens. Agrega palabras arriba o edita la lista.
                    </p>
                  ) : (
                    <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto pr-1">
                      {items.map(s => {
                        const isRec = recordingId === s.id
                        const isBusy = busyId === s.id
                        const isPlaying = playingId === s.id
                        const isSentence = selectedList.category === 'sentence'
                        const words = isSentence ? tokenizeSentence(s.token) : []
                        const keys = isSentence ? parseKeywords(s) : []
                        return (
                          <div
                            key={s.id}
                            className={`rounded-md border ${s.file_path ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-[var(--border)]/50'}`}
                          >
                          <div className="flex items-center gap-2 p-2">
                            <span className="w-8 text-xs text-[var(--muted-foreground)] text-right">{s.position}</span>
                            <span className="font-medium flex-1">{s.token}</span>

                            {s.file_path ? (
                              <>
                                <span className="text-[10px] text-[var(--muted-foreground)]" title={`peak ${s.peak_dbfs?.toFixed(1)} dBFS`}>
                                  {s.duration_ms} ms · {s.rms_dbfs?.toFixed(1)} dBFS
                                  {s.normalized === 1 && <span className="text-emerald-600 ml-1">✓</span>}
                                </span>
                                <Button size="sm" variant="ghost" onClick={() => preview(s)} disabled={isBusy}>
                                  {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditStimulus(s)} disabled={isBusy} title="Recortar audio">
                                  <Scissors className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => reanalyze(s)} disabled={isBusy} title="Re-analizar">
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => clearRec(s)} disabled={isBusy} title="Borrar grabación">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            ) : (
                              <span className="text-[10px] text-[var(--muted-foreground)]">sin audio</span>
                            )}

                            {!isRec ? (
                              <Button
                                size="sm"
                                variant={s.file_path ? 'outline' : 'default'}
                                onClick={() => startRec(s)}
                                disabled={recordingId != null || isBusy}
                              >
                                <Mic className="w-3.5 h-3.5" />
                                {s.file_path ? 'Regrabar' : 'Grabar'}
                              </Button>
                            ) : (
                              <>
                                <Button size="sm" variant="destructive" onClick={() => stopRec(s)}>
                                  <Check className="w-3.5 h-3.5" /> Detener
                                </Button>
                                <Button size="sm" variant="ghost" onClick={cancelRec}>×</Button>
                              </>
                            )}

                            <Button size="sm" variant="ghost" onClick={() => removeToken(s)} disabled={isBusy || isRec} title="Eliminar token">
                              ×
                            </Button>
                          </div>
                          {isSentence && words.length > 0 && (
                            <div className="px-2 pb-2 pt-1 border-t border-[var(--border)]/30 flex flex-wrap gap-1">
                              <span className="text-[10px] text-[var(--muted-foreground)] mr-1 self-center">
                                Palabras clave ({keys.length}):
                              </span>
                              {words.map((w, i) => {
                                const n = normalizeWord(w)
                                const isKey = !!n && keys.includes(n)
                                return (
                                  <button
                                    key={i}
                                    onClick={() => n && toggleKeyword(s, w)}
                                    disabled={!n || isBusy || isRec}
                                    className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${isKey
                                      ? 'border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)] font-medium'
                                      : 'border-[var(--border)]/50 hover:bg-[var(--secondary)]'}`}
                                  >
                                    {w}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="pt-5 flex gap-3 items-start text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Tips de grabación</p>
                    <ul className="text-xs mt-1 space-y-0.5 list-disc pl-4 text-[var(--muted-foreground)]">
                      <li>Ambiente silencioso. Micrófono a 15–20 cm de la boca.</li>
                      <li>Procesado automático: HP 80 Hz, trim silencios, fade 10 ms, normalización RMS a −20 dBFS.</li>
                      <li>El nivel SPL se aplica al reproducir usando la calibración activa (ref a 1 kHz).</li>
                      <li>Calibración ruido/habla: el RMS del habla ≈ pico tonal −10 dB. Para uso estricto, calibrar por separado.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="pt-8 pb-8 text-center text-sm text-[var(--muted-foreground)]">
                Selecciona o crea una lista.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {editStimulus && (
        <StimulusEditDialog
          stimulus={editStimulus}
          onClose={() => setEditStimulus(null)}
          onSaved={() => refreshItems()}
        />
      )}
      {batchOpen && selectedList && (
        <BatchRecordDialog
          items={items}
          onClose={() => setBatchOpen(false)}
          onSaved={() => refreshItems()}
        />
      )}
    </div>
  )
}
