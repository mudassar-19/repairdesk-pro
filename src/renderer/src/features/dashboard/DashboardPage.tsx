import { useEffect, useState } from 'react'
import { BilingualText } from '@shared/components/BilingualText'
import { EmptyState } from '@shared/components/EmptyState'
import { DatabaseIcon, CloudIcon } from '@shared/components/icons'
import { dictionary } from '@shared/i18n'
import { verifyFirebaseInitialized } from '@shared/lib/firebase'
import type { ComponentType, SVGProps } from 'react'
import type { SystemHealth } from '../../../../main/ipc/system'

type CheckState = 'checking' | 'ok' | 'error'

function StatusPill({ state }: { state: CheckState }) {
  const styles: Record<CheckState, string> = {
    checking: 'bg-ink-muted/10 text-ink-muted',
    ok: 'bg-success/10 text-success',
    error: 'bg-danger/10 text-danger'
  }
  const label: Record<CheckState, string> = {
    checking: 'Checking…',
    ok: 'Connected',
    error: 'Failed'
  }
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles[state]}`}>
      {label[state]}
    </span>
  )
}

function StatusCard({
  icon: Icon,
  title,
  state,
  detail
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  state: CheckState
  detail: string
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface p-lg shadow-card">
      <div className="mb-md flex items-start justify-between gap-sm">
        <div className="flex items-center gap-sm">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon width={20} height={20} />
          </span>
          <span className="text-base font-medium leading-tight text-ink">{title}</span>
        </div>
        <StatusPill state={state} />
      </div>
      <p className="text-sm text-ink-muted">{detail}</p>
    </div>
  )
}

export function DashboardPage() {
  const [dbState, setDbState] = useState<CheckState>('checking')
  const [firebaseState, setFirebaseState] = useState<CheckState>('checking')
  const [health, setHealth] = useState<SystemHealth | null>(null)

  useEffect(() => {
    window.api
      .getSystemHealth()
      .then((result) => {
        setHealth(result)
        setDbState(result.db.ok ? 'ok' : 'error')
      })
      .catch(() => setDbState('error'))

    try {
      const result = verifyFirebaseInitialized()
      setFirebaseState(result.ok ? 'ok' : 'error')
    } catch {
      setFirebaseState('error')
    }
  }, [])

  return (
    <div className="flex flex-1 flex-col">
      <BilingualText text={dictionary.nav.dashboard} as="div" size="xl" className="mb-xl" />

      <div className="mb-xl grid grid-cols-2 gap-lg">
        <StatusCard
          icon={DatabaseIcon}
          title="SQLite / Drizzle"
          state={dbState}
          detail={health ? `Last checked: ${health.db.checkedAt}` : 'Awaiting first health check.'}
        />
        <StatusCard
          icon={CloudIcon}
          title="Firebase SDK"
          state={firebaseState}
          detail="Initialized with placeholder config — not wired to auth/sync yet."
        />
      </div>

      <EmptyState />
    </div>
  )
}
