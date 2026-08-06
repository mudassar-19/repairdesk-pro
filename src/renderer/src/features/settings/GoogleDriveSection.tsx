import { useState } from 'react'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { dictionary } from '@shared/i18n'
import type { GoogleDriveStatus } from '../../../../main/ipc/googleDrive'

interface GoogleDriveSectionProps {
  status: GoogleDriveStatus | null
  onStatusChange: () => void
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

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)
    const result = await window.api.googleDrive.connect()
    setConnecting(false)
    if (!result.success) {
      setError(result.error || dictionary.googleDrive.connectFailed.en)
    }
    onStatusChange()
  }

  const handleDisconnect = async () => {
    await window.api.googleDrive.disconnect()
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

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
