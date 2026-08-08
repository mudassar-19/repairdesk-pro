import { useState } from 'react'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { dictionary } from '@shared/i18n'
import { restoreFromCloudBackup } from '@shared/lib/cloudBackup'
import type { GoogleDriveStatus, RemoteBackupInfoResult } from '../../../../main/ipc/googleDrive'

interface GoogleDriveSectionProps {
  status: GoogleDriveStatus | null
  onStatusChange: () => void
}

function bilingualBody(template: { en: string; ur: string }, when: string): { en: string; ur: string } {
  return { en: template.en.replace('{when}', when), ur: template.ur.replace('{when}', when) }
}

/**
 * The one-time-per-device "Connect Google Drive" action (Settings, next to
 * the Cloud Backup controls it unlocks). Connecting opens the system browser
 * for a standard Google OAuth consent screen (loopback redirect — see
 * main/services/googleDriveAuth.ts) and completes back here once
 * window.api.googleDrive.connect() resolves; there's no embedded webview and
 * no separate "waiting" screen to navigate away from.
 */
export function GoogleDriveSection({ status, onStatusChange }: GoogleDriveSectionProps) {
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [foundBackup, setFoundBackup] = useState<RemoteBackupInfoResult['backup']>(null)
  const [freshChosen, setFreshChosen] = useState(false)
  const [restoring, setRestoring] = useState(false)

  const checkForExistingBackup = async () => {
    setChecking(true)
    setFoundBackup(null)
    setFreshChosen(false)
    const info = await window.api.googleDrive.getRemoteBackupInfo()
    setChecking(false)
    if (info.connected && info.backup) setFoundBackup(info.backup)
  }

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)
    const result = await window.api.googleDrive.connect()
    setConnecting(false)
    if (!result.success) {
      setError(result.error || dictionary.googleDrive.connectFailed.en)
      onStatusChange()
      return
    }
    onStatusChange()
    // Fresh-device flow (Part F): a just-connected account may already hold a
    // backup — offer to restore it instead of silently starting empty.
    await checkForExistingBackup()
  }

  const handleRestoreFound = async () => {
    setRestoring(true)
    setError(null)
    const result = await restoreFromCloudBackup()
    // On success the app relaunches; only a failure returns to this UI.
    if (!result.success) {
      setRestoring(false)
      setError(result.error || dictionary.googleDrive.connectFailed.en)
    }
  }

  const handleDisconnect = async () => {
    await window.api.googleDrive.disconnect()
    setFoundBackup(null)
    setFreshChosen(false)
    onStatusChange()
  }

  return (
    <div className="mb-md flex flex-col gap-sm rounded-md border border-border/60 bg-surface-raised p-md">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <div className="min-w-0">
          <BilingualText text={dictionary.googleDrive.title} as="div" size="sm" className="mb-1 font-medium text-ink" />
          {status?.connected ? (
            <p className="flex items-center gap-2 text-sm text-ink">
              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-success" />
              {dictionary.googleDrive.connectedAs.en}: {status.email}
            </p>
          ) : status?.revoked ? (
            <p className="flex items-center gap-2 text-sm text-warning">
              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-warning" />
              {dictionary.googleDrive.disconnected.en}
              {status.email ? ` (${status.email})` : ''}
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-ink-muted/40" />
              {dictionary.googleDrive.notConnected.en}
            </p>
          )}
        </div>

        {status?.connected ? (
          <Button variant="secondary" size="sm" onClick={handleDisconnect}>
            <BilingualText text={dictionary.googleDrive.disconnect} size="xs" align="center" />
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={handleConnect} disabled={connecting}>
            <BilingualText
              text={connecting ? dictionary.googleDrive.connecting : status?.revoked ? dictionary.googleDrive.reconnect : dictionary.googleDrive.connect}
              size="xs"
              align="center"
            />
          </Button>
        )}
      </div>

      <BilingualText text={dictionary.googleDrive.hint} size="xs" className="text-ink-muted" />

      {checking && (
        <BilingualText text={dictionary.googleDrive.checkingBackup} size="xs" className="text-ink-muted" />
      )}

      {/* Fresh-device restore prompt: only while connected, a backup was found, and the user hasn't chosen to start fresh. */}
      {status?.connected && foundBackup && !freshChosen && (
        <div className="flex flex-col gap-sm rounded-md border border-primary/30 bg-primary/5 p-md">
          <BilingualText text={dictionary.googleDrive.backupFoundTitle} as="div" size="sm" className="font-medium text-ink" />
          <BilingualText
            text={bilingualBody(dictionary.googleDrive.backupFoundBody, new Date(foundBackup.modifiedTime).toLocaleString())}
            size="xs"
            className="text-ink-muted"
          />
          {restoring ? (
            <BilingualText text={dictionary.googleDrive.restoringBackup} size="xs" className="text-warning" />
          ) : (
            <div className="flex flex-wrap gap-sm">
              <Button variant="primary" size="sm" onClick={handleRestoreFound}>
                <BilingualText text={dictionary.googleDrive.restoreThisBackup} size="xs" align="center" />
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setFreshChosen(true)}>
                <BilingualText text={dictionary.googleDrive.startFresh} size="xs" align="center" />
              </Button>
            </div>
          )}
        </div>
      )}

      {status?.connected && foundBackup && freshChosen && (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-md">
          <BilingualText text={dictionary.googleDrive.freshWarning} size="xs" className="text-warning" />
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
