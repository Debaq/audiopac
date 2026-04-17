import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit2, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PatientForm } from '@/components/layout/PatientForm'
import { getPatient, deletePatient } from '@/lib/db/patients'
import { listSessionsByPatient } from '@/lib/db/sessions'
import type { Patient, SessionWithDetails } from '@/types'
import { calculateAge, formatDate, formatDateTime, percent } from '@/lib/utils'

export function PatientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const patientId = Number(id)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [sessions, setSessions] = useState<SessionWithDetails[]>([])
  const [editing, setEditing] = useState(false)

  const load = async () => {
    const [p, s] = await Promise.all([getPatient(patientId), listSessionsByPatient(patientId)])
    setPatient(p)
    setSessions(s)
  }

  useEffect(() => { if (patientId) load() }, [patientId])

  const handleDelete = async () => {
    if (!patient) return
    if (!confirm('¿Eliminar paciente y todas sus evaluaciones? Esta acción no se puede deshacer.')) return
    await deletePatient(patient.id)
    navigate('/pacientes')
  }

  if (!patient) return <div className="p-8">Cargando...</div>

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link to="/pacientes" className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver a pacientes
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{patient.last_name}, {patient.first_name}</h1>
          <p className="text-[var(--muted-foreground)]">
            {patient.document_id && <span>Doc: {patient.document_id}</span>}
            {patient.birth_date && <span> • {calculateAge(patient.birth_date)} años</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Edit2 className="w-4 h-4" /> Editar
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" /> Eliminar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader><CardTitle>Datos personales</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {patient.birth_date && <div><span className="text-[var(--muted-foreground)]">Nacimiento:</span> {formatDate(patient.birth_date)}</div>}
            {patient.gender && <div><span className="text-[var(--muted-foreground)]">Género:</span> {patient.gender}</div>}
            {patient.phone && <div><span className="text-[var(--muted-foreground)]">Tel:</span> {patient.phone}</div>}
            {patient.email && <div><span className="text-[var(--muted-foreground)]">Email:</span> {patient.email}</div>}
            {patient.address && <div><span className="text-[var(--muted-foreground)]">Dirección:</span> {patient.address}</div>}
          </CardContent>
        </Card>
        {patient.notes && (
          <Card>
            <CardHeader><CardTitle>Notas clínicas</CardTitle></CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap">{patient.notes}</CardContent>
          </Card>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Historial de evaluaciones</h2>
        <Link to={`/evaluacion?patient=${patient.id}`}>
          <Button><Plus className="w-4 h-4" /> Nueva evaluación</Button>
        </Link>
      </div>

      {sessions.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-[var(--muted-foreground)]">Sin evaluaciones aún</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => (
            <Link key={s.id} to={`/informes/${s.id}`}>
              <Card className="hover:border-[var(--primary)] transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{s.template_name}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">{formatDateTime(s.started_at)} • {s.ear}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={s.status === 'completed' ? 'success' : s.status === 'cancelled' ? 'destructive' : 'secondary'}>
                      {s.status === 'completed' ? 'Completado' : s.status === 'cancelled' ? 'Cancelado' : 'En curso'}
                    </Badge>
                    {s.test_score !== null && (
                      <div className="font-semibold text-lg text-[var(--primary)]">
                        {percent(s.test_score, 1)}%
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {editing && (
        <PatientForm
          patient={patient}
          onClose={() => setEditing(false)}
          onSaved={async () => { setEditing(false); await load() }}
        />
      )}
    </div>
  )
}
