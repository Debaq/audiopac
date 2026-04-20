import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import type { TestConfig } from '@/types'

type FB = NonNullable<TestConfig['feedback']>

const DEFAULT_FEEDBACK: FB = { practice: 'correct_incorrect', test: 'off' }

interface Props {
  value: TestConfig
  onChange: (v: TestConfig) => void
  disabled?: boolean
}

/** Sección compartida: patient_instructions_md + feedback + response_timeout_ms + examiner_notes_md. */
export function SharedConfigSection({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)

  const fb: FB = value.feedback ?? DEFAULT_FEEDBACK
  const setFb = <K extends keyof FB>(k: K, v: FB[K]) =>
    onChange({ ...value, feedback: { ...fb, [k]: v } })

  return (
    <div className="rounded-md border border-[var(--border)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium bg-[var(--secondary)]/50 hover:bg-[var(--secondary)]"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <span>Consigna y feedback</span>
        <span className="ml-auto text-[10px] text-[var(--muted-foreground)] font-normal">
          {value.patient_instructions_md ? '✓ consigna' : '—'}
          {value.response_timeout_ms ? ` · ${value.response_timeout_ms}ms` : ''}
        </span>
      </button>
      {open && (
        <div className="p-3 space-y-3">
          <div>
            <Label>Consigna al paciente (markdown)</Label>
            <Textarea
              rows={4}
              value={value.patient_instructions_md ?? ''}
              onChange={e => onChange({ ...value, patient_instructions_md: e.target.value })}
              placeholder="# Instrucciones&#10;Vas a escuchar palabras. Repite cada una..."
              disabled={disabled}
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
              Se mostrará en un modal antes del primer trial.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Feedback en práctica</Label>
              <Select value={fb.practice} onChange={e => setFb('practice', e.target.value as FB['practice'])} disabled={disabled}>
                <option value="off">Sin feedback</option>
                <option value="correct_incorrect">Correcto/Incorrecto</option>
                <option value="with_text">Con texto custom</option>
              </Select>
            </div>
            <div>
              <Label>Feedback en test</Label>
              <Select value={fb.test} onChange={e => setFb('test', e.target.value as FB['test'])} disabled={disabled}>
                <option value="off">Sin feedback</option>
                <option value="correct_incorrect">Correcto/Incorrecto</option>
              </Select>
            </div>
          </div>

          {fb.practice === 'with_text' && (
            <div>
              <Label>Texto de feedback (práctica)</Label>
              <Textarea
                rows={2}
                value={fb.practice_text_md ?? ''}
                onChange={e => setFb('practice_text_md', e.target.value)}
                placeholder="Muy bien / Prueba de nuevo"
                disabled={disabled}
                className="text-xs"
              />
            </div>
          )}

          <div>
            <Label>Timeout de respuesta (ms, 0 = sin timeout)</Label>
            <Input
              type="number"
              min={0}
              value={value.response_timeout_ms ?? 0}
              onChange={e => onChange({ ...value, response_timeout_ms: Number(e.target.value) || 0 })}
              disabled={disabled}
            />
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
              Si el paciente no responde en este tiempo, el trial se marca incorrecto automáticamente.
            </p>
          </div>

          <div>
            <Label>Notas del examinador (markdown, privadas)</Label>
            <Textarea
              rows={3}
              value={value.examiner_notes_md ?? ''}
              onChange={e => onChange({ ...value, examiner_notes_md: e.target.value })}
              placeholder="Protocolo: ...; Cuándo aplicar: ..."
              disabled={disabled}
              className="font-mono text-xs"
            />
          </div>
        </div>
      )}
    </div>
  )
}
