import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { firebaseAuth } from '@shared/lib/firebase'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { PageHeader } from '@shared/components/PageHeader'
import { dictionary } from '@shared/i18n'
import { useAuthStore } from '@shared/hooks/useAuthStore'
import { BrandingSection } from './BrandingSection'
import { ReceiptSettingsSection } from './ReceiptSettingsSection'
import { BackupSettingsSection } from './BackupSettingsSection'

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
      <PageHeader
        title={dictionary.nav.settings}
        action={
          <Button variant="danger-ghost" onClick={handleLogout} disabled={loggingOut}>
            <BilingualText text={dictionary.settings.logout} size="sm" align="center" />
          </Button>
        }
      />

      <div className="flex flex-col gap-xl">
        <BrandingSection />
        <ReceiptSettingsSection />
        <BackupSettingsSection />
      </div>
    </div>
  )
}
