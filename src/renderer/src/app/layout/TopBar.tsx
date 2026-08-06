import { useSidebarStore } from '@shared/hooks/useSidebarStore'

export function TopBar() {
  const toggle = useSidebarStore((state) => state.toggle)

  return (
    <header className="no-print relative flex flex-shrink-0 items-center justify-between border-b border-border bg-surface px-lg py-md">
      <span className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-primary-500 to-primary-700" />
      <button
        type="button"
        onClick={toggle}
        aria-label="Toggle sidebar"
        className="rounded-md p-2 text-ink-muted transition-colors hover:bg-primary/10 hover:text-primary"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </header>
  )
}
