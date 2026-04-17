import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Activity, FileText, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listPatients } from '@/lib/db/patients'
import { listAllSessions } from '@/lib/db/sessions'
import { useAuth } from '@/stores/auth'
import type { SessionWithDetails } from '@/types'
import { formatDateTime, percent } from '@/lib/utils'

export function DashboardPage() {
  const profile = useAuth(s => s.activeProfile)
  const [stats, setStats] = useState({ patients: 0, sessions: 0, recent: [] as SessionWithDetails[] })

  useEffect(() => {
    Promise.all([listPatients(), listAllSessions(5)]).then(([patients, sessions]) => {
      setStats({ patients: patients.length, sessions: sessions.length, recent: sessions })
    })
  }, [])

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Hola, {profile?.name}</h1>
        <p className="text-[var(--muted-foreground)]">Panel de control AudioPAC</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted-foreground)] flex items-center gap-2">
              <Users className="w-4 h-4" /> Pacientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.patients}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted-foreground)] flex items-center gap-2">
              <Activity className="w-4 h-4" /> Evaluaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.sessions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted-foreground)] flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Rol activo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold capitalize">{profile?.role}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Link to="/evaluacion">
          <Card className="hover:border-[var(--primary)] transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5" /> Nueva evaluación</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--muted-foreground)]">Iniciar un test DPS, PPS o personalizado con un paciente.</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/pacientes">
          <Card className="hover:border-[var(--primary)] transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Gestión de pacientes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--muted-foreground)]">Agregar, editar o consultar historial de pacientes.</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Últimas evaluaciones</CardTitle>
          <Link to="/informes" className="text-sm text-[var(--primary)] hover:underline">Ver todas</Link>
        </CardHeader>
        <CardContent>
          {stats.recent.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] text-center py-8">
              Aún no hay evaluaciones. Crea la primera desde "Evaluación".
            </p>
          ) : (
            <div className="space-y-2">
              {stats.recent.map(s => (
                <Link
                  key={s.id}
                  to={`/informes/${s.id}`}
                  className="flex items-center justify-between p-3 rounded-md hover:bg-[var(--secondary)] transition-colors"
                >
                  <div>
                    <div className="font-medium">{s.patient_name}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">{s.template_name} • {formatDateTime(s.started_at)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-[var(--primary)]">
                      {s.test_score !== null ? `${percent(s.test_score, 1)}%` : s.status}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
