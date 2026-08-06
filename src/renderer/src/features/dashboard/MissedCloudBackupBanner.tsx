import { useEffect, useState } from 'react'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { dictionary } from '@shared/i18n'
import { isCloudBackupDue } from '@shared/lib/cloudBackupSchedule'
import { runCloudBackupNow } from '@shared/lib/cloudBackup'

/**
 * Shown whenever a configured daily cloud backup time has already passed
 * today with no successful upload since — including "the app was closed at
 * that time" (the exact case the product spec calls out: don't silently
 * catch up, tell the user and let them trigger it themselves). Resolves
 * itself the moment a backup succeeds, whether from this banner's own
 * button or from useCloudBackupScheduler's silent on-time trigger picking
 * up the very next scheduled slot.
 */
export function MissedCloudBackupBanner() {
  const [due, setDue] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkDue()
  }, [])

  const checkDue = async () => {
    const [backupSettings, state, driveStatus] = await Promise.all([
      window.api.settings.getBackupSettings(),
      window.api.backup.getCloudBackupState(),
      window.api.googleDrive.getStatus()
    ])
    // Not connected (or disconnected) — Settings already shows a clear
    // reconnect prompt there; don't also nag on the dashboard for a backup
    // that can't run yet.
    if (!backupSettings.cloudBackupEnabled || !driveStatus.connected) {
      setDue(false)
      return
    }
    setDue(isCloudBackupDue(backupSettings.scheduledTimes, state.lastCloudBackupAt, new Date()))
  }

  const handleBackupNow = async () => {
    setRunning(true)
    setError(null)
    const result = await runCloudBackupNow()
    setRunning(false)
    if (result.success) {
      setDue(false)
    } else {
      setError(result.error ?? 'Unknown error')
    }
  }

  if (!due) return null

  return (
    <div data-testid="missed-cloud-backup-banner" className="mb-xl rounded-lg border border-warning/30 bg-warning/5">
      <div className="flex flex-wrap items-center justify-between gap-md px-lg py-md">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-warning" />
            <BilingualText text={dictionary.cloudBackup.missedTitle} as="div" size="lg" />
          </div>
          <BilingualText text={dictionary.cloudBackup.missedBody} size="sm" className="mt-1 text-ink-muted" />
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
        <Button variant="primary" size="sm" onClick={handleBackupNow} disabled={running}>
          <BilingualText
            text={running ? dictionary.cloudBackup.backingUp : dictionary.cloudBackup.backupNow}
            size="xs"
            align="center"
          />
        </Button>
      </div>
    </div>
  )
}
