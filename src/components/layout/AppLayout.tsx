import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Users, Activity, Settings2, FileText, LogOut, Home } from 'lucide-react'
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
    <div className="flex h-screen bg-[var(--background)]">
      <aside className="w-64 border-r border-[var(--border)] bg-[var(--card)] flex flex-col">
        <div className="p-6 border-b border-[var(--border)]">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--primary)] flex items-center justify-center text-[var(--primary-foreground)] font-bold">
              A
            </div>
            <div>
              <div className="font-bold text-[var(--foreground)]">AudioPAC</div>
              <div className="text-xs text-[var(--muted-foreground)]">Procesamiento Auditivo</div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'text-[var(--foreground)] hover:bg-[var(--secondary)]'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        {activeProfile && (
          <div className="p-3 border-t border-[var(--border)]">
            <div className="flex items-center gap-3 p-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                style={{ background: activeProfile.color }}
              >
                {activeProfile.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{activeProfile.name}</div>
                <div className="text-xs text-[var(--muted-foreground)] capitalize">{activeProfile.role}</div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-md hover:bg-[var(--secondary)] text-[var(--muted-foreground)]"
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
