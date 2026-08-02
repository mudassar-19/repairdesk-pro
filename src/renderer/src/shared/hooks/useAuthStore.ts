import { create } from 'zustand'

export interface AuthUser {
  uid: string
  email: string
}

interface AuthState {
  isAuthenticated: boolean
  user: AuthUser | null
  deviceId: string | null
  /** True only while the app checks the local encrypted session on startup. */
  sessionLoading: boolean
  setAuthenticated: (user: AuthUser, deviceId: string) => void
  setSessionLoading: (loading: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  deviceId: null,
  sessionLoading: true,
  setAuthenticated: (user, deviceId) => set({ isAuthenticated: true, user, deviceId }),
  setSessionLoading: (sessionLoading) => set({ sessionLoading }),
  clear: () => set({ isAuthenticated: false, user: null, deviceId: null })
}))
