import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile } from '@/types'

interface AuthState {
  activeProfile: Profile | null
  setActiveProfile: (p: Profile | null) => void
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      activeProfile: null,
      setActiveProfile: (p) => set({ activeProfile: p }),
      logout: () => set({ activeProfile: null }),
    }),
    { name: 'audiopac_auth' }
  )
)
