import { create } from 'zustand'

interface DismissedBannersState {
  dismissed: Set<string>
  dismiss: (key: string) => void
}

/**
 * In-memory only (unlike useAuthStore's disk-backed session) — resets on
 * app restart, which is exactly "dismissible per session" for a nudge like
 * the recurring-expense reminder. Survives navigating away from and back to
 * the Dashboard within the same run, unlike component-local state would.
 */
export const useDismissedBannersStore = create<DismissedBannersState>((set) => ({
  dismissed: new Set(),
  dismiss: (key) => set((state) => ({ dismissed: new Set(state.dismissed).add(key) }))
}))
