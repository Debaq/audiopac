import { create } from 'zustand'
import type { Calibration } from '@/types'
import { getActiveCalibration, getActiveCurve, getActiveNoisePoints, isCalibrationExpired } from '@/lib/db/calibrations'
import { getDefaultOutput } from '@/lib/audio/device'
import { setActiveRefDb, setActiveCalibrationCurve, setActiveNoiseRef, DEFAULT_REF_DB, type NoiseRefByType } from '@/lib/audio/engine'

export type CalibrationStatus = 'none' | 'ok' | 'expired' | 'device_mismatch'

interface CalibrationState {
  active: Calibration | null
  currentDeviceId: string | null
  currentDeviceLabel: string | null
  status: CalibrationStatus
  ageDays: number | null
  refresh: () => Promise<void>
  init: () => () => void
}

function computeStatus(active: Calibration | null, devId: string | null, devLabel: string | null): CalibrationStatus {
  if (!active) return 'none'
  if (isCalibrationExpired(active)) return 'expired'
  if (active.device_id && devId && active.device_id !== devId) return 'device_mismatch'
  if (active.device_label && devLabel && active.device_label !== devLabel && !active.device_id) return 'device_mismatch'
  return 'ok'
}

function ageInDays(iso: string | null): number | null {
  if (!iso) return null
  const then = new Date(iso.replace(' ', 'T') + 'Z').getTime()
  if (Number.isNaN(then)) return null
  return Math.floor((Date.now() - then) / 86400000)
}

export const useCalibrationStore = create<CalibrationState>((set, get) => ({
  active: null,
  currentDeviceId: null,
  currentDeviceLabel: null,
  status: 'none',
  ageDays: null,
  refresh: async () => {
    const active = await getActiveCalibration().catch(() => null)
    const dev = await getDefaultOutput().catch(() => null)
    const curve = await getActiveCurve().catch(() => [])
    const noisePts = await getActiveNoisePoints().catch(() => [])
    setActiveRefDb(active?.ref_db_spl ?? DEFAULT_REF_DB)
    setActiveCalibrationCurve(curve.map(p => ({ frequency_hz: p.frequency_hz, ear: p.ear, ref_db_spl: p.ref_db_spl })))
    const noiseRef: NoiseRefByType = {}
    for (const p of noisePts) noiseRef[p.noise_type] = p.ref_db_spl
    setActiveNoiseRef(noiseRef)
    set({
      active,
      currentDeviceId: dev?.deviceId ?? null,
      currentDeviceLabel: dev?.label ?? null,
      status: computeStatus(active, dev?.deviceId ?? null, dev?.label ?? null),
      ageDays: ageInDays(active?.created_at ?? null),
    })
  },
  init: () => {
    get().refresh()
    const handler = () => get().refresh()
    navigator.mediaDevices?.addEventListener?.('devicechange', handler)
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', handler)
  },
}))
