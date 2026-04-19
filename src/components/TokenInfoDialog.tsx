import { useEffect, useMemo, useState } from 'react'
import { X, CheckCircle2, AlertTriangle, Volume2, Mic2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { analyze } from '@/lib/es/phonetics'
import type { Stimulus } from '@/types'

interface Props {
  stimulus: Stimulus
  onClose: () => void
  onEditAudio?: () => void
  onPlay?: () => void
}

const TTS_LOCALE_KEY = 'audiopac.tts.locale'

function listEsVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
  return window.speechSynthesis.getVoices().filter(v => v.lang?.toLowerCase().startsWith('es'))
}

export function TokenInfoDialog({ stimulus, onClose, onEditAudio, onPlay }: Props) {
  const a = analyze(stimulus.token)
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [locale, setLocale] = useState<string>(() => {
    if (typeof window === 'undefined') return 'es-ES'
    return localStorage.getItem(TTS_LOCALE_KEY) ?? 'es-ES'
  })

  useEffect(() => {
    if (!ttsSupported) return
    const update = () => setVoices(listEsVoices())
    update()
    window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update)
  }, [ttsSupported])

  const availableLocales = useMemo(() => {
    const set = new Set(voices.map(v => v.lang))
    // siempre ofrecemos defaults
    set.add('es-ES'); set.add('es-MX'); set.add('es-US'); set.add('es-AR')
    return Array.from(set).sort()
  }, [voices])

  const speak = () => {
    if (!ttsSupported) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(stimulus.token)
    u.lang = locale
    const match = voices.find(v => v.lang === locale) ?? voices.find(v => v.lang.startsWith(locale.slice(0, 2)))
    if (match) u.voice = match
    u.rate = 0.9
    window.speechSynthesis.speak(u)
  }

  const saveLocale = (v: string) => {
    setLocale(v)
    if (typeof window !== 'undefined') localStorage.setItem(TTS_LOCALE_KEY, v)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--card)] border border-[var(--border)] rounded-lg max-w-lg w-full p-5 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-xs text-[var(--muted-foreground)] font-mono">Posición {stimulus.position}</div>
            <h2 className="text-2xl font-bold">{stimulus.token}</h2>
            <div className="mt-1 font-mono text-lg">
              {a.syllables.map((syl, i) => (
                <span key={i} className={i === a.stressed_index ? 'font-bold text-[var(--primary)] underline' : ''}>
                  {i > 0 && <span className="text-[var(--muted-foreground)] no-underline">·</span>}
                  {syl}
                </span>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--secondary)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge className={a.disilabo ? 'bg-emerald-500/15 text-emerald-700' : 'bg-amber-500/15 text-amber-700'}>
              {a.syllable_count} sílaba{a.syllable_count === 1 ? '' : 's'}
            </Badge>
            {a.stress_type && (
              <Badge className="bg-[var(--primary)]/10 text-[var(--primary)]">{a.stress_label}</Badge>
            )}
            {a.has_written_accent && <Badge variant="outline">con tilde</Badge>}
            {a.has_diphthong && <Badge variant="outline">diptongo</Badge>}
            {a.has_hiato && <Badge variant="outline">hiato</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="border border-[var(--border)]/50 rounded p-2">
              <div className="text-[10px] text-[var(--muted-foreground)] mb-1">Consonantes ({a.consonants.length})</div>
              <div className="font-mono text-sm flex flex-wrap gap-1">
                {a.consonants.length > 0
                  ? a.consonants.map((c, i) => <span key={i} className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-700">{c}</span>)
                  : <span className="text-[var(--muted-foreground)]">—</span>}
              </div>
            </div>
            <div className="border border-[var(--border)]/50 rounded p-2">
              <div className="text-[10px] text-[var(--muted-foreground)] mb-1">Vocales ({a.vowels.length})</div>
              <div className="font-mono text-sm flex flex-wrap gap-1">
                {a.vowels.length > 0
                  ? a.vowels.map((v, i) => <span key={i} className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700">{v}</span>)
                  : <span className="text-[var(--muted-foreground)]">—</span>}
              </div>
            </div>
          </div>

          {a.issues.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <ul className="list-disc pl-4 space-y-0.5">
                {a.issues.map((it, i) => <li key={i}>{it}</li>)}
              </ul>
            </div>
          )}

          <div className="border border-[var(--border)]/50 rounded p-2.5 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">Audio grabado</span>
              {stimulus.file_path ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <span className="text-[var(--muted-foreground)]">sin grabar</span>}
            </div>
            {stimulus.file_path && (
              <div className="grid grid-cols-2 gap-1 text-[var(--muted-foreground)]">
                <span>Duración: <b className="text-[var(--foreground)]">{stimulus.duration_ms} ms</b></span>
                <span>Sample rate: <b className="text-[var(--foreground)]">{stimulus.sample_rate} Hz</b></span>
                <span>RMS: <b className="text-[var(--foreground)]">{stimulus.rms_dbfs?.toFixed(1)} dBFS</b></span>
                <span>Peak: <b className="text-[var(--foreground)]">{stimulus.peak_dbfs?.toFixed(1)} dBFS</b></span>
              </div>
            )}
          </div>

          <div className="text-[10px] text-[var(--muted-foreground)] border-t border-[var(--border)]/40 pt-2">
            Regla ES: aguda = tónica en última; llana/grave = penúltima; esdrújula = antepenúltima; sobresdrújula = anterior.
            Digrafos <code>ch/ll/rr/qu</code> cuentan como una consonante. Sílabas calculadas con reglas de diptongo/hiato (algunos casos borde tipo "idea" pueden fallar).
          </div>

          {ttsSupported && (
            <div className="border border-[var(--border)]/50 rounded p-2 text-xs flex items-center gap-2 flex-wrap">
              <span className="font-medium flex items-center gap-1"><Mic2 className="w-3.5 h-3.5" /> Pronunciación TTS</span>
              <Select value={locale} onChange={e => saveLocale(e.target.value)} className="text-xs py-1 w-auto">
                {availableLocales.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </Select>
              <Button size="sm" variant="outline" onClick={speak}>
                <Volume2 className="w-3.5 h-3.5" /> Pronunciar
              </Button>
              <span className="text-[10px] text-[var(--muted-foreground)]">
                Preview sintético (no es el estímulo grabado). Útil para verificar acento/sílabas.
              </span>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            {onPlay && stimulus.file_path && (
              <Button size="sm" variant="outline" onClick={onPlay}>
                <Volume2 className="w-3.5 h-3.5" /> Reproducir
              </Button>
            )}
            {onEditAudio && stimulus.file_path && (
              <Button size="sm" variant="outline" onClick={onEditAudio}>
                Recortar audio
              </Button>
            )}
            <Button size="sm" onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
