import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Users, Activity, Settings2, FileText, LogOut, Home, AudioLines, Gauge, AlertTriangle, CheckCircle2, Mic, Package, Download, Map } from 'lucide-react'
import { useAuth } from '@/stores/auth'
import { useCalibrationStore } from '@/stores/calibration'
import { usePackUpdatesStore } from '@/stores/packUpdates'
import { CommandPalette } from '@/components/CommandPalette'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', label: 'Inicio', icon: Home },
  { to: '/pacientes', label: 'Pacientes', icon: Users },
  { to: '/evaluacion', label: 'Evaluación', icon: Activity },
  { to: '/tests', label: 'Tests', icon: Settings2 },
  { to: '/informes', label: 'Informes', icon: FileText },
  { to: '/estimulos', label: 'Estímulos', icon: Mic },
  { to: '/catalogos', label: 'Catálogos', icon: Package },
  { to: '/calibracion', label: 'Calibración', icon: Gauge },
  { to: '/roadmap', label: 'Roadmap', icon: Map },
]

export function AppLayout() {
  const { activeProfile, logout } = useAuth()
  const { active, status, ageDays } = useCalibrationStore()
  const packUpdates = usePackUpdatesStore(s => s.updates)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const calMessage = (() => {
    if (status === 'none') return 'Sin calibración — usando 85 dB por defecto'
    if (status === 'expired') return `Calibración vencida (${ageDays}d) — recalibrar`
    if (status === 'device_mismatch') return 'Dispositivo cambió — recalibrar'
    return `${active?.label} · ${active?.ref_db_spl.toFixed(0)} dB · hace ${ageDays}d`
  })()
  const calBad = status !== 'ok'

  return (
    <div className="flex h-screen bg-[var(--background)] bg-waves">
      <aside className="w-60 flex flex-col relative">
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-[var(--border)] to-transparent" />

        <div className="p-5">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl brand-gradient flex items-center justify-center text-white shadow-lg shadow-[var(--primary)]/20 group-hover:shadow-[var(--primary)]/40 transition-shadow">
                <AudioLines className="w-5 h-5" strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <div className="font-black text-lg leading-none brand-gradient-text tracking-tight">AudioPAC</div>
              <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mt-0.5">Procesamiento Auditivo</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              className={({ isActive }) => cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative',
                isActive
                  ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--primary)]/90 text-[var(--primary-foreground)] shadow-md shadow-[var(--primary)]/20'
                  : 'text-[var(--foreground)]/80 hover:bg-[var(--secondary)] hover:text-[var(--foreground)]'
              )}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-1 h-6 bg-[var(--primary)] rounded-r-full" />
                  )}
                  <Icon className={cn('w-4 h-4 transition-transform', isActive && 'scale-110')} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="flex-1">{label}</span>
                  {to === '/catalogos' && packUpdates.length > 0 && (
                    <span
                      className={cn(
                        'text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center',
                        isActive ? 'bg-white/25 text-white' : 'bg-amber-500 text-white',
                      )}
                      title={`${packUpdates.length} paquete(s) con actualizaciones`}
                    >
                      {packUpdates.length}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {packUpdates.length > 0 && (
          <div className="px-3 pb-2">
            <Link
              to="/catalogos"
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs border bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 transition-colors"
              title={packUpdates.map(u => `${u.name}: v${u.installed} → v${u.latest}`).join('\n')}
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {packUpdates.length === 1
                  ? '1 paquete con actualización'
                  : `${packUpdates.length} paquetes con actualizaciones`}
              </span>
            </Link>
          </div>
        )}

        <div className="px-3 pb-2">
          <Link
            to="/calibracion"
            className={cn(
              'flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs border transition-colors',
              calBad
                ? 'bg-red-500/10 border-red-500/40 text-red-600 hover:bg-red-500/15'
                : 'bg-emerald-500/5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10'
            )}
            title={calMessage}
          >
            {calBad ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate">{calMessage}</span>
          </Link>
        </div>

        {activeProfile && (
          <div className="p-3">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)]/50">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-md shrink-0"
                style={{ background: activeProfile.color }}
              >
                {activeProfile.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate leading-tight">{activeProfile.name}</div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-md hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] text-[var(--muted-foreground)] transition-colors"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <CommandPalette />
    </div>
  )
}
