import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Users, Activity, Settings2, FileText, LogOut, Home, AudioLines } from 'lucide-react'
import { useAuth } from '@/stores/auth'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', label: 'Inicio', icon: Home },
  { to: '/pacientes', label: 'Pacientes', icon: Users },
  { to: '/evaluacion', label: 'Evaluación', icon: Activity },
  { to: '/tests', label: 'Tests', icon: Settings2 },
  { to: '/informes', label: 'Informes', icon: FileText },
]

export function AppLayout() {
  const { activeProfile, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

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
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

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
    </div>
  )
}
