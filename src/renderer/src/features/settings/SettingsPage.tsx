import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { firebaseAuth } from '@shared/lib/firebase'
import { BilingualText } from '@shared/components/BilingualText'
import { EmptyState } from '@shared/components/EmptyState'
import { dictionary } from '@shared/i18n'
import { useAuthStore } from '@shared/hooks/useAuthStore'

export function SettingsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const clear = useAuthStore((state) => state.clear)
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await signOut(firebaseAuth).catch(() => {})
      await window.api.auth.clearLocalSession()
    } finally {
      // Activity logging is a best-effort side effect — fired after the
      // session is already cleared, never awaited in the critical path.
      window.api
        .logActivity({
          actionType: 'logout',
          entityType: 'auth',
          entityId: user?.uid ?? null,
          description: 'Signed out'
        })
        .catch(() => {})
      clear()
      navigate('/auth', { replace: true })
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <BilingualText text={dictionary.nav.settings} as="div" size="xl" className="mb-xl" />

      <div className="mb-xl flex items-center justify-between rounded-lg border border-border/60 bg-surface p-lg shadow-card">
        <div>
          <p className="text-sm text-ink-muted">{dictionary.settings.loggedInAs.en}</p>
          <p className="text-base font-medium text-ink">{user?.email ?? '—'}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-md bg-danger/10 px-md py-sm text-sm font-medium text-danger transition-colors hover:bg-danger/20 disabled:opacity-60"
        >
          <BilingualText text={dictionary.settings.logout} size="sm" className="items-center" />
        </button>
      </div>

      <EmptyState />
    </div>
  )
}
