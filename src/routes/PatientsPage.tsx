import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { PatientForm } from '@/components/layout/PatientForm'
import { listPatients } from '@/lib/db/patients'
import type { Patient } from '@/types'
import { calculateAge, formatDate } from '@/lib/utils'

export function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      setPatients(await listPatients(search || undefined))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(load, search ? 200 : 0)
    return () => clearTimeout(t)
  }, [search])

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Pacientes</h1>
          <p className="text-[var(--muted-foreground)]">{patients.length} registrados</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Nuevo paciente
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
        <Input
          placeholder="Buscar por nombre o RUT/documento..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <p className="text-center text-[var(--muted-foreground)] py-8">Cargando...</p>
      ) : patients.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <User className="w-12 h-12 mx-auto text-[var(--muted-foreground)] mb-3" />
            <p className="text-[var(--muted-foreground)]">No hay pacientes</p>
            <Button className="mt-4" onClick={() => setShowForm(true)}>Agregar primero</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {patients.map(p => (
            <Link key={p.id} to={`/pacientes/${p.id}`}>
              <Card className="hover:border-[var(--primary)] transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center font-semibold">
                    {p.first_name[0]}{p.last_name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{p.last_name}, {p.first_name}</div>
                    <div className="text-sm text-[var(--muted-foreground)]">
                      {p.document_id && <span>Doc: {p.document_id}</span>}
                      {p.birth_date && <span> • {calculateAge(p.birth_date)} años</span>}
                      {p.birth_date && <span> • Nac: {formatDate(p.birth_date)}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {showForm && (
        <PatientForm
          onClose={() => setShowForm(false)}
          onSaved={async () => { setShowForm(false); await load() }}
        />
      )}
    </div>
  )
}
