import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/stores/auth'

export function AuthGuard() {
  const activeProfile = useAuth(s => s.activeProfile)
  if (!activeProfile) return <Navigate to="/" replace />
  return <Outlet />
}
