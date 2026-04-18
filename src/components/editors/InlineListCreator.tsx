import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { createStimulusList, addStimulusToken, getStimulusListByCode } from '@/lib/db/stimuli'
import { useAuth } from '@/stores/auth'
import { useSettingsStore, COUNTRY_OPTIONS } from '@/stores/settings'
import type { StimulusCategory } from '@/types'

interface Props {
  category: StimulusCategory
  categoryLabel: string
  /** Tokens pre-cargados al crear (ej: dígitos 1-9 sin 7 para dichotic). */
  seedTokens?: string[]
  onClose: () => void
  onCreated: (code: string) => void
}

export function InlineListCreator({ category, categoryLabel, seedTokens, onClose, onCreated }: Props) {
  const profile = useAuth(s => s.activeProfile)
  const { countryCode } = useSettingsStore()
  const [name, setName] = useState('')
  const [country, setCountry] = useState(countryCode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    if (!name.trim()) return
    setBusy(true); setError(null)
    try {
      let code = `USR_${category.toUpperCase()}_${Date.now()}`
      // evitar colisión improbable
      if (await getStimulusListByCode(code)) code = `${code}_${Math.floor(Math.random() * 1000)}`
      const listId = await createStimulusList({
        code,
        name: name.trim(),
        category,
        country_code: country,
        created_by: profile?.id ?? null,
      })
      for (const tk of seedTokens ?? []) {
        await addStimulusToken(listId, tk)
      }
      onCreated(code)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--card)] border border-[var(--border)] rounded-lg max-w-md w-full p-5 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Nueva lista — {categoryLabel}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--secondary)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Nombre *</Label>
            <Input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ej: SRT bisílabos propios"
            />
          </div>
          <div>
            <Label>País / dialecto</Label>
            <Select value={country} onChange={e => setCountry(e.target.value)}>
              {COUNTRY_OPTIONS.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </Select>
          </div>
          {seedTokens && seedTokens.length > 0 && (
            <div className="rounded-md bg-[var(--secondary)] p-2 text-xs">
              Se van a cargar <b>{seedTokens.length}</b> tokens semilla: {seedTokens.join(', ')}.
              Luego podés grabarlos en <code>/estímulos</code>.
            </div>
          )}
          {error && <div className="text-xs text-red-500">{error}</div>}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button onClick={create} disabled={busy || !name.trim()}>
              {busy ? 'Creando…' : 'Crear y seleccionar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
