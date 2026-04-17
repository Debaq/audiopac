import { create } from 'zustand'
import { getDb } from '@/lib/db/client'

export const COUNTRY_OPTIONS = [
  { code: 'LATAM', label: 'Latinoamérica (neutro)' },
  { code: 'US',    label: 'Estados Unidos (ES)' },
  { code: 'MX',    label: 'México' },
  { code: 'GT',    label: 'Guatemala' },
  { code: 'HN',    label: 'Honduras' },
  { code: 'SV',    label: 'El Salvador' },
  { code: 'NI',    label: 'Nicaragua' },
  { code: 'CR',    label: 'Costa Rica' },
  { code: 'PA',    label: 'Panamá' },
  { code: 'CU',    label: 'Cuba' },
  { code: 'DO',    label: 'República Dominicana' },
  { code: 'PR',    label: 'Puerto Rico' },
  { code: 'VE',    label: 'Venezuela' },
  { code: 'CO',    label: 'Colombia' },
  { code: 'EC',    label: 'Ecuador' },
  { code: 'PE',    label: 'Perú' },
  { code: 'BO',    label: 'Bolivia' },
  { code: 'CL',    label: 'Chile' },
  { code: 'AR',    label: 'Argentina' },
  { code: 'UY',    label: 'Uruguay' },
  { code: 'PY',    label: 'Paraguay' },
] as const

interface SettingsState {
  countryCode: string
  loaded: boolean
  load: () => Promise<void>
  setCountryCode: (code: string) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  countryCode: 'LATAM',
  loaded: false,
  load: async () => {
    const db = await getDb()
    const rows = await db.select<{ value: string }[]>(
      "SELECT value FROM settings WHERE key = 'country_code'"
    )
    set({ countryCode: rows[0]?.value ?? 'LATAM', loaded: true })
  },
  setCountryCode: async (code) => {
    const db = await getDb()
    await db.execute(
      "INSERT INTO settings (key, value) VALUES ('country_code', $1) ON CONFLICT(key) DO UPDATE SET value=$1, updated_at=datetime('now')",
      [code]
    )
    set({ countryCode: code })
  },
}))
