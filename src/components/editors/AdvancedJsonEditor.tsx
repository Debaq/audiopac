import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Code2, ChevronDown, ChevronRight } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import type { TestConfig } from '@/types'

interface Props {
  value: TestConfig
  onChange: (v: TestConfig) => void
  disabled?: boolean
}

export function AdvancedJsonEditor({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(() => JSON.stringify(value, null, 2))
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!dirty) setText(JSON.stringify(value, null, 2))
  }, [value, dirty])

  const onTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setText(v)
    setDirty(true)
    try {
      const parsed = JSON.parse(v)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setError('Raíz debe ser un objeto')
        return
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'JSON inválido')
    }
  }

  const apply = () => {
    try {
      const parsed = JSON.parse(text) as TestConfig
      onChange(parsed)
      setDirty(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'JSON inválido')
    }
  }

  const revert = () => {
    setText(JSON.stringify(value, null, 2))
    setDirty(false)
    setError(null)
  }

  return (
    <div className="rounded-md border border-[var(--border)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium bg-[var(--secondary)]/50 hover:bg-[var(--secondary)]"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Code2 className="w-4 h-4" />
        <span>Configuración avanzada (JSON)</span>
        <span className="ml-auto text-[10px] text-amber-600 font-normal">experimental</span>
      </button>
      {open && (
        <div className="p-3 space-y-2">
          <div className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded p-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Uso experimental. Cambios no validados pueden romper el test. Preserva campos no expuestos por la UI (<code>advanced_json</code> u otros que el runner agregue).
            </span>
          </div>
          <Textarea
            value={text}
            onChange={onTextChange}
            disabled={disabled}
            rows={18}
            className="font-mono text-[11px]"
            spellCheck={false}
          />
          <div className="flex items-center justify-between text-xs">
            <span className={error ? 'text-red-600' : dirty ? 'text-amber-600' : 'text-emerald-600'}>
              {error ? <><AlertTriangle className="w-3 h-3 inline" /> {error}</> :
               dirty ? 'Cambios sin aplicar' :
               <><Check className="w-3 h-3 inline" /> Sincronizado</>}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={revert}
                disabled={!dirty}
                className="px-2 py-1 text-xs rounded border border-[var(--border)] hover:bg-[var(--secondary)] disabled:opacity-40"
              >
                Revertir
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={!!error || !dirty || disabled}
                className="px-2 py-1 text-xs rounded bg-[var(--primary)] text-[var(--primary-foreground)] disabled:opacity-40"
              >
                Aplicar JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
