export interface AudioOutputDevice {
  deviceId: string
  label: string
}

const FALLBACK_DEVICE: AudioOutputDevice = {
  deviceId: 'default',
  label: 'Salida predeterminada del sistema',
}

export async function listAudioOutputs(): Promise<AudioOutputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [FALLBACK_DEVICE]
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const outs = devices
      .filter(d => d.kind === 'audiooutput')
      .map(d => ({ deviceId: d.deviceId, label: d.label || '(sin etiqueta — permití micrófono para ver nombres)' }))
    return outs.length > 0 ? outs : [FALLBACK_DEVICE]
  } catch {
    return [FALLBACK_DEVICE]
  }
}

export async function requestDeviceLabelPermission(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) return
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach(t => t.stop())
  } catch {}
}

export async function getDefaultOutput(): Promise<AudioOutputDevice | null> {
  const outs = await listAudioOutputs()
  if (outs.length === 0) return null
  return outs.find(d => d.deviceId === 'default') ?? outs[0]
}
