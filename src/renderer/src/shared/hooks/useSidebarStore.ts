import { create } from 'zustand'

interface SidebarState {
  collapsed: boolean
  toggle: () => void
}

/** Minimal Zustand wiring for Phase 1 — proves the store works via the one piece of UI state the shell actually needs. */
export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: false,
  toggle: () => set((state) => ({ collapsed: !state.collapsed }))
}))
