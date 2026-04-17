import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Activity, FileText, ArrowUpRight, Waves, Clock, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 20) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Hero */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--primary)] uppercase tracking-widest mb-1">{greeting}</p>
          <h1 className="text-4xl font-black tracking-tight">{profile?.name}</h1>
          <p className="text-[var(--muted-foreground)] mt-1">Panel principal · {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <Waves className="w-24 h-24 text-[var(--primary)]/10" strokeWidth={1} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard icon={Users} label="Pacientes" value={String(stats.patients)} to="/pacientes" accent="wine" />
        <StatCard icon={Activity} label="Evaluaciones" value={String(stats.sessions)} to="/informes" accent="teal" />
        <StatCard icon={CheckCircle2} label="Completadas" value={String(stats.recent.filter(s => s.status === 'completed').length)} to="/informes" accent="gold" />
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link to="/evaluacion" className="group">
          <div className="relative overflow-hidden rounded-2xl p-6 brand-gradient text-white shadow-xl shadow-[var(--primary)]/20 h-full hover:shadow-2xl hover:shadow-[var(--primary)]/30 transition-all">
            <div className="absolute -right-8 -bottom-8 w-48 h-48 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors" />
            <div className="relative">
              <Activity className="w-10 h-10 mb-3" strokeWidth={2} />
              <h3 className="text-2xl font-black mb-1">Nueva evaluación</h3>
              <p className="text-white/80 text-sm mb-4">Iniciar un test DPS, PPS o personalizado</p>
              <div className="inline-flex items-center gap-1 text-sm font-semibold">
                Comenzar <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </div>
            </div>
          </div>
        </Link>

        <Link to="/pacientes" className="group">
          <div className="relative overflow-hidden rounded-2xl p-6 bg-[var(--card)] border-2 border-[var(--border)] shadow-lg h-full hover:border-[var(--primary)] hover:shadow-xl transition-all">
            <Users className="w-10 h-10 mb-3 text-[var(--primary)]" strokeWidth={2} />
            <h3 className="text-2xl font-black mb-1">Pacientes</h3>
            <p className="text-[var(--muted-foreground)] text-sm mb-4">Gestionar registros e historial clínico</p>
            <div className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)]">
              Ver lista <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </div>
          </div>
        </Link>
      </div>

      {/* Recent sessions */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-black flex items-center gap-2">
          <Clock className="w-5 h-5 text-[var(--primary)]" /> Últimas evaluaciones
        </h2>
        <Link to="/informes" className="text-sm font-semibold text-[var(--primary)] hover:underline">Ver todas →</Link>
      </div>

      {stats.recent.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-10 h-10 mx-auto text-[var(--muted-foreground)]/40 mb-2" />
            <p className="text-sm text-[var(--muted-foreground)]">Aún no hay evaluaciones. Crea la primera desde "Evaluación".</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {stats.recent.map(s => {
            const score = s.test_score !== null ? percent(s.test_score, 1) : null
            const passed = score !== null && score >= 75
            return (
              <Link key={s.id} to={`/informes/${s.id}`}>
                <div className="group flex items-center justify-between p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--secondary)] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-[var(--muted-foreground)]" />
                    </div>
                    <div>
                      <div className="font-semibold">{s.patient_name}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">{s.template_name} · {formatDateTime(s.started_at)}</div>
                    </div>
                  </div>
                  {score !== null && (
                    <div className="flex items-center gap-3">
                      <div className={`text-xl font-black ${passed ? 'text-emerald-600' : 'text-red-600'}`}>
                        {score}%
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-[var(--muted-foreground)] group-hover:text-[var(--primary)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon, label, value, to, accent,
}: {
  icon: typeof Users
  label: string
  value: string
  to: string
  accent: 'wine' | 'teal' | 'gold'
}) {
  const accentClass = {
    wine: 'from-[var(--primary)]/20 to-[var(--primary)]/5 text-[var(--primary)]',
    teal: 'from-[var(--color-teal-500)]/20 to-[var(--color-teal-500)]/5 text-[var(--color-teal-500)]',
    gold: 'from-[var(--color-gold-500)]/20 to-[var(--color-gold-500)]/5 text-[var(--color-gold-500)]',
  }[accent]
  return (
    <Link to={to} className="group">
      <div className="relative overflow-hidden rounded-2xl p-5 bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)]/50 transition-all">
        <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${accentClass} blur-xl opacity-60`} />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">{label}</div>
            <div className="text-4xl font-black mt-1">{value}</div>
          </div>
          <Icon className="w-8 h-8 text-[var(--muted-foreground)]/30 group-hover:text-[var(--primary)] transition-colors" strokeWidth={1.5} />
        </div>
      </div>
    </Link>
  )
}
