import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createPatient, updatePatient } from '@/lib/db/patients'
import { useAuth } from '@/stores/auth'
import type { Patient } from '@/types'

export function PatientForm({
  patient,
  onClose,
  onSaved,
}: {
  patient?: Patient | null
  onClose: () => void
  onSaved: () => void
}) {
  const profile = useAuth(s => s.activeProfile)
  const [form, setForm] = useState({
    document_id: patient?.document_id ?? '',
    first_name: patient?.first_name ?? '',
    last_name: patient?.last_name ?? '',
    birth_date: patient?.birth_date ?? '',
    gender: patient?.gender ?? '',
    phone: patient?.phone ?? '',
    email: patient?.email ?? '',
    address: patient?.address ?? '',
    notes: patient?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        document_id: form.document_id || null,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        birth_date: form.birth_date || null,
        gender: form.gender || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        notes: form.notes || null,
        created_by: profile?.id ?? null,
      }
      if (patient) await updatePatient(patient.id, payload)
      else await createPatient(payload)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <form onSubmit={submit} className="bg-[var(--card)] rounded-2xl p-8 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">{patient ? 'Editar paciente' : 'Nuevo paciente'}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-[var(--secondary)]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Nombre *</Label>
            <Input value={form.first_name} onChange={upd('first_name')} required />
          </div>
          <div>
            <Label>Apellido *</Label>
            <Input value={form.last_name} onChange={upd('last_name')} required />
          </div>
          <div>
            <Label>Documento / RUT</Label>
            <Input value={form.document_id} onChange={upd('document_id')} />
          </div>
          <div>
            <Label>Fecha de nacimiento</Label>
            <Input type="date" value={form.birth_date} onChange={upd('birth_date')} />
          </div>
          <div>
            <Label>Género</Label>
            <Select value={form.gender} onChange={upd('gender')}>
              <option value="">-</option>
              <option value="F">Femenino</option>
              <option value="M">Masculino</option>
              <option value="O">Otro</option>
            </Select>
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input value={form.phone} onChange={upd('phone')} />
          </div>
          <div className="col-span-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={upd('email')} />
          </div>
          <div className="col-span-2">
            <Label>Dirección</Label>
            <Input value={form.address} onChange={upd('address')} />
          </div>
          <div className="col-span-2">
            <Label>Notas clínicas</Label>
            <Textarea value={form.notes} onChange={upd('notes')} rows={3} />
          </div>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      </form>
    </div>
  )
}
