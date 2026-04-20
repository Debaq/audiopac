import { useMemo, useState } from 'react'
import { AlertTriangle, Volume2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { playBurstDbfs, ensureRunning } from '@/lib/audio/engine'
import { useCalibrationStore } from '@/stores/calibration'

interface Props {
  onProceed: () => void
  onCancel: () => void
}

type Choice = 'A' | 'B'

const REF_DBFS = -20
const ATTEN_DB = 6
const FREQ = 1000
const DUR = 600

export function PreSessionCheck({ onProceed, onCancel }: Props) {
  const { status, ageDays } = useCalibrationStore()
  const louder = useMemo<Choice>(() => (Math.random() < 0.5 ? 'A' : 'B'), [])
  const [played, setPlayed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [answer, setAnswer] = useState<Choice | null>(null)
  const [failed, setFailed] = useState(false)

  const dbA = louder === 'A' ? REF_DBFS : REF_DBFS - ATTEN_DB
  const dbB = louder === 'B' ? REF_DBFS : REF_DBFS - ATTEN_DB

  const playSequence = async () => {
    setPlaying(true)
    setAnswer(null)
    setFailed(false)
    await ensureRunning()
    await playBurstDbfs(FREQ, DUR, dbA)
    await new Promise(r => setTimeout(r, 400))
    await playBurstDbfs(FREQ, DUR, dbB)
    setPlaying(false)
    setPlayed(true)
  }

  const submit = (c: Choice) => {
    setAnswer(c)
    if (c === louder) {
      setTimeout(onProceed, 500)
    } else {
      setFailed(true)
    }
  }

  const retry = () => {
    setPlayed(false)
    setAnswer(null)
    setFailed(false)
  }

  const calWarn = (() => {
    if (status === 'none') return 'No hay calibración activa. La evaluación usará 85 dB SPL por defecto.'
    if (status === 'expired') return `Calibración vencida (hace ${ageDays} días). Se recomienda recalibrar.`
    if (status === 'device_mismatch') return 'El dispositivo de salida no coincide con la calibración. Se recomienda recalibrar.'
    return null
  })()

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5" /> Verificación de nivel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {calWarn && (
            <div className="flex gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{calWarn}</span>
            </div>
          )}

          <p className="text-sm">
            Vas a escuchar <strong>dos tonos</strong> seguidos (A y B). Uno es 6 dB más fuerte que el otro.
            Indicá cuál sonó <strong>más fuerte</strong>. Esto valida que la cadena de audio no cambió desde la calibración.
          </p>

          {!played && !playing && (
            <Button onClick={playSequence} size="lg" className="w-full">
              <Volume2 className="w-5 h-5 mr-2" /> Reproducir A + B
            </Button>
          )}

          {playing && (
            <div className="text-center py-4 text-sm text-[var(--muted-foreground)]">Reproduciendo…</div>
          )}

          {played && !failed && (
            <div className="space-y-2">
              <p className="text-sm font-medium">¿Cuál sonó más fuerte?</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={answer === 'A' ? (louder === 'A' ? 'default' : 'destructive') : 'outline'}
                  onClick={() => submit('A')}
                  disabled={answer !== null}
                >
                  A {answer === 'A' && (louder === 'A' ? <Check className="w-4 h-4 ml-1" /> : <X className="w-4 h-4 ml-1" />)}
                </Button>
                <Button
                  variant={answer === 'B' ? (louder === 'B' ? 'default' : 'destructive') : 'outline'}
                  onClick={() => submit('B')}
                  disabled={answer !== null}
                >
                  B {answer === 'B' && (louder === 'B' ? <Check className="w-4 h-4 ml-1" /> : <X className="w-4 h-4 ml-1" />)}
                </Button>
              </div>
              <button className="text-xs text-[var(--muted-foreground)] underline" onClick={playSequence}>
                Volver a escuchar
              </button>
            </div>
          )}

          {failed && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/40 text-sm">
                Respuesta incorrecta. Posible cambio de volumen / auriculares / mute. Revisa la configuración antes de continuar.
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={retry} className="flex-1">Reintentar</Button>
                <Button variant="destructive" onClick={onProceed} className="flex-1">Continuar igual</Button>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-[var(--border)]/40">
            <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
