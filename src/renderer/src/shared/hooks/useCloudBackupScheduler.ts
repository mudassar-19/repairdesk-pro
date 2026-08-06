import { useEffect, useRef } from 'react'
import { isCloudBackupDue } from '@shared/lib/cloudBackupSchedule'
import { runCloudBackupNow } from '@shared/lib/cloudBackup'

const CHECK_INTERVAL_MS = 2 * 60 * 1000

/**
 * Runs the scheduled cloud backup silently when a configured time-of-day is
 * crossed WHILE the app is open — the "on-time" case. Deliberately does NOT
 * auto-run on the very first check after mount even if a slot already looks
 * due: that first check can't tell "the app just opened right as the slot
 * passed" apart from "the app was closed all day and this was missed" — and
 * per the product requirement, a missed backup must surface a visible
 * reminder (see MissedCloudBackupBanner, which reads the same due state),
 * not be silently caught up on the next launch. Only a transition from
 * not-due to due observed across two checks in the same running session
 * counts as "on time."
 */
export function useCloudBackupScheduler(enabled: boolean): void {
  const hasCheckedOnceRef = useRef(false)
  const wasDueRef = useRef(false)
  const runningRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function tick() {
      const [backupSettings, state, driveStatus] = await Promise.all([
        window.api.settings.getBackupSettings(),
        window.api.backup.getCloudBackupState(),
        window.api.googleDrive.getStatus()
      ])
      // Google Drive not connected (or access was revoked) — never treat this
      // as a failure to retry or nag about here; the disconnected state is
      // surfaced in Settings instead, and local backups keep running as
      // normal in the meantime (see main/db/services/backupService.ts).
      if (cancelled || !backupSettings.cloudBackupEnabled || !driveStatus.connected) return

      const due = isCloudBackupDue(backupSettings.scheduledTimes, state.lastCloudBackupAt, new Date())
      const isFirstCheck = !hasCheckedOnceRef.current
      hasCheckedOnceRef.current = true

      if (due && !isFirstCheck && !wasDueRef.current && !runningRef.current) {
        runningRef.current = true
        try {
          await runCloudBackupNow()
        } finally {
          runningRef.current = false
        }
      }
      wasDueRef.current = due
    }

    tick()
    const interval = setInterval(tick, CHECK_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [enabled])
}
