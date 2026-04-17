import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, User, Trash2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/stores/auth'
import { listProfiles, createProfile, deleteProfile, verifyPin } from '@/lib/db/profiles'
import type { Profile } from '@/types'

const AVATAR_COLORS = ['#6B1F2E', '#A63446', '#8A2436', '#4A1620', '#B84A5C', '#D17682', '#2B0A10']

export function ProfileSelectorPage() {
  const navigate = useNavigate()
  const setActiveProfile = useAuth(s => s.setActiveProfile)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [pinModal, setPinModal] = useState<Profile | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const list = await listProfiles()
      setProfiles(list)
      if (list.length === 0) setShowCreate(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSelect = (p: Profile) => {
    if (p.pin_hash) {
      setPinModal(p)
    } else {
      setActiveProfile(p)
      navigate('/dashboard')
    }
  }

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('¿Eliminar este perfil?')) return
    await deleteProfile(id)
    await load()
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--muted-foreground)]">Cargando...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--background)] via-[var(--secondary)] to-[var(--background)] flex flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-[var(--primary)] flex items-center justify-center text-[var(--primary-foreground)] text-3xl font-bold shadow-lg">
              A
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-3" style={{ color: 'var(--primary)' }}>AudioPAC</h1>
          <p className="text-[var(--muted-foreground)] text-lg">¿Quién está evaluando hoy?</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 justify-items-center">
          {profiles.map(p => (
            <button
              key={p.id}
              onClick={() => handleSelect(p)}
              className="group flex flex-col items-center gap-3 transition-transform hover:scale-110 relative"
            >
              <div
                className="w-28 h-28 rounded-2xl flex items-center justify-center text-white text-5xl font-bold shadow-lg ring-2 ring-transparent group-hover:ring-4 group-hover:ring-[var(--primary)] transition-all relative"
                style={{ background: p.color }}
              >
                {p.name.charAt(0).toUpperCase()}
                {p.pin_hash && (
                  <Lock className="absolute bottom-2 right-2 w-4 h-4 text-white/80" />
                )}
              </div>
              <span className="text-sm font-medium text-[var(--foreground)] group-hover:text-[var(--primary)]">{p.name}</span>
              <button
                onClick={(e) => handleDelete(p.id, e)}
                className="absolute top-1 right-1 p-1.5 bg-[var(--destructive)] rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Eliminar"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </button>
          ))}
          <button
            onClick={() => setShowCreate(true)}
            className="flex flex-col items-center gap-3 transition-transform hover:scale-110"
          >
            <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
              <Plus className="w-12 h-12" />
            </div>
            <span className="text-sm font-medium text-[var(--muted-foreground)]">Agregar perfil</span>
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateProfileModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => { setShowCreate(false); await load() }}
        />
      )}
      {pinModal && (
        <PinModal
          profile={pinModal}
          onClose={() => setPinModal(null)}
          onSuccess={(p) => { setActiveProfile(p); navigate('/dashboard') }}
        />
      )}
    </div>
  )
}

function CreateProfileModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('fonoaudiologo')
  const [color, setColor] = useState(AVATAR_COLORS[0])
  const [pin, setPin] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await createProfile({ name: name.trim(), role: role as 'fonoaudiologo', color, pin: pin || null })
      onCreated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <form onSubmit={submit} className="bg-[var(--card)] rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <User className="w-6 h-6" /> Nuevo perfil
        </h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} autoFocus required />
          </div>
          <div>
            <Label htmlFor="role">Rol</Label>
            <Select id="role" value={role} onChange={e => setRole(e.target.value)}>
              <option value="fonoaudiologo">Fonoaudiólogo/a</option>
              <option value="investigador">Investigador/a</option>
              <option value="admin">Administrador/a</option>
            </Select>
          </div>
          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {AVATAR_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-lg ring-2 transition-all ${color === c ? 'ring-[var(--foreground)] scale-110' : 'ring-transparent'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="pin">PIN (opcional, 4-6 dígitos)</Label>
            <Input id="pin" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || !name.trim()}>{saving ? 'Creando...' : 'Crear perfil'}</Button>
        </div>
      </form>
    </div>
  )
}

function PinModal({ profile, onClose, onSuccess }: { profile: Profile; onClose: () => void; onSuccess: (p: Profile) => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await verifyPin(profile.id, pin)
    if (ok) onSuccess(profile)
    else { setError('PIN incorrecto'); setPin('') }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <form onSubmit={submit} className="bg-[var(--card)] rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-4xl font-bold mb-3" style={{ background: profile.color }}>
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-bold">{profile.name}</h2>
        </div>
        <Label htmlFor="pin">Ingresa tu PIN</Label>
        <Input
          id="pin"
          type="password"
          inputMode="numeric"
          autoFocus
          maxLength={6}
          value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
          className="mt-2 text-center text-2xl tracking-widest"
        />
        {error && <p className="text-[var(--destructive)] text-sm mt-2">{error}</p>}
        <div className="flex gap-3 mt-6">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" disabled={pin.length < 4} className="flex-1">Entrar</Button>
        </div>
      </form>
    </div>
  )
}
