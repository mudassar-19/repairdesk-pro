import { useEffect, useState } from 'react'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { Card } from '@shared/components/Card'
import { ConfirmDialog } from '@shared/components/ConfirmDialog'
import { ScrollList } from '@shared/components/ScrollList'
import { dictionary } from '@shared/i18n'
import type { BilingualString } from '@shared/i18n'
import { runCloudBackupNow, restoreFromCloudBackup } from '@shared/lib/cloudBackup'
import { GoogleDriveSection } from './GoogleDriveSection'
import type { BackupInfo } from '../../../../main/db/services/backupService'
import type { BackupSettings, CloudBackupState } from '../../../../main/db/repositories/settingsRepository'
import type { GoogleDriveStatus } from '../../../../main/ipc/googleDrive'

const kindLabel: Record<BackupInfo['kind'], BilingualString> = {
  auto: dictionary.backup.kindAuto,
  manual: dictionary.backup.kindManual,
  safety: dictionary.backup.kindSafety
}

const kindBadgeClass: Record<BackupInfo['kind'], string> = {
  auto: 'bg-primary/10 text-primary',
  manual: 'bg-success/10 text-success',
  safety: 'bg-warning/10 text-warning'
}

const selectClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

type RestoreTarget = { type: 'file'; filePath: string } | { type: 'cloud' }

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

/**
 * Location/frequency/retention (Phase 15) plus the existing Phase 12
 * backup/restore actions and history, all in one place per requirement 4 —
 * "surface it here properly instead of wherever it currently lives." Backup
 * Now's default-location path (no explicit destinationDir) already reads the
 * persisted customLocation setting via backupService.getConfiguredBackupsDir,
 * so saving a new default here takes effect the next time that button runs,
 * with no change needed to the button itself.
 *
 * The Cloud Backup block below is a separate, additional destination
 * alongside all of the above — it never replaces or reads from the local
 * backup history list.
 */
export function BackupSettingsSection() {
  const [backupSettings, setBackupSettingsState] = useState<BackupSettings | null>(null)
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [backupBusy, setBackupBusy] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<RestoreTarget | null>(null)

  const [cloudState, setCloudState] = useState<CloudBackupState | null>(null)
  const [cloudBusy, setCloudBusy] = useState(false)
  const [cloudMessage, setCloudMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [newTime, setNewTime] = useState('18:00')
  const [driveStatus, setDriveStatus] = useState<GoogleDriveStatus | null>(null)

  const loadBackupSettings = () => {
    window.api.settings.getBackupSettings().then(setBackupSettingsState)
  }
  const loadBackups = () => {
    window.api.backup.list().then(setBackups)
  }
  const loadCloudState = () => {
    window.api.backup.getCloudBackupState().then(setCloudState)
  }
  const loadDriveStatus = () => {
    window.api.googleDrive.getStatus().then(setDriveStatus)
  }

  useEffect(() => {
    loadBackupSettings()
    loadBackups()
    loadCloudState()
    loadDriveStatus()
  }, [])

  const handleChangeDefaultLocation = async () => {
    const dir = await window.api.backup.chooseDirectory()
    if (!dir) return
    const updated = await window.api.settings.setBackupSettings({ customLocation: dir })
    setBackupSettingsState(updated)
    loadBackups()
  }

  const handleResetDefaultLocation = async () => {
    const updated = await window.api.settings.setBackupSettings({ customLocation: null })
    setBackupSettingsState(updated)
    loadBackups()
  }

  const handleFrequencyChange = async (frequency: BackupSettings['frequency']) => {
    const updated = await window.api.settings.setBackupSettings({ frequency })
    setBackupSettingsState(updated)
  }

  const handleRetentionChange = async (retentionCount: BackupSettings['retentionCount']) => {
    const updated = await window.api.settings.setBackupSettings({ retentionCount })
    setBackupSettingsState(updated)
  }

  const handleBackupNow = async (destinationDir?: string) => {
    setBackupBusy(true)
    setMessage(null)
    const result = await window.api.backup.createManual(destinationDir)
    setBackupBusy(false)
    if (result.success) {
      setMessage({ type: 'success', text: `${dictionary.backup.backupSuccess.en}: ${result.filePath}` })
      loadBackups()
    } else {
      setMessage({ type: 'error', text: `${dictionary.backup.backupFailed.en}: ${result.error}` })
    }
  }

  const handleChooseLocation = async () => {
    const dir = await window.api.backup.chooseDirectory()
    if (dir) handleBackupNow(dir)
  }

  const handleRestoreFromFile = async () => {
    const filePath = await window.api.backup.chooseRestoreFile()
    if (filePath) setRestoreTarget({ type: 'file', filePath })
  }

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return
    setRestoring(true)
    setMessage(null)
    const result =
      restoreTarget.type === 'file' ? await window.api.backup.restore(restoreTarget.filePath) : await restoreFromCloudBackup()
    setRestoreTarget(null)
    if (!result.success) {
      setRestoring(false)
      setMessage({ type: 'error', text: `${dictionary.backup.restoreFailed.en}: ${result.error}` })
    }
  }

  const handleCloudEnabledChange = async (cloudBackupEnabled: boolean) => {
    const updated = await window.api.settings.setBackupSettings({ cloudBackupEnabled })
    setBackupSettingsState(updated)
  }

  const handleAddTime = async () => {
    if (!backupSettings || backupSettings.scheduledTimes.includes(newTime)) return
    const scheduledTimes = [...backupSettings.scheduledTimes, newTime].sort()
    const updated = await window.api.settings.setBackupSettings({ scheduledTimes })
    setBackupSettingsState(updated)
  }

  const handleRemoveTime = async (time: string) => {
    if (!backupSettings) return
    const scheduledTimes = backupSettings.scheduledTimes.filter((t) => t !== time)
    const updated = await window.api.settings.setBackupSettings({ scheduledTimes })
    setBackupSettingsState(updated)
  }

  const handleCloudBackupNow = async () => {
    setCloudBusy(true)
    setCloudMessage(null)
    const result = await runCloudBackupNow()
    setCloudBusy(false)
    if (result.success) {
      setCloudMessage({ type: 'success', text: dictionary.cloudBackup.backupSuccess.en })
      loadCloudState()
    } else {
      setCloudMessage({ type: 'error', text: `${dictionary.cloudBackup.backupFailed.en}: ${result.error}` })
      // A revoked/expired Drive connection surfaces here as a failed backup —
      // refresh so the connection card immediately reflects "disconnected,
      // please reconnect" instead of continuing to show stale "Connected".
      loadDriveStatus()
    }
  }

  return (
    <Card>
      <BilingualText text={dictionary.backup.title} as="div" size="lg" className="mb-md" />

      {backupSettings && (
        <div className="mb-lg grid grid-cols-1 gap-md rounded-md border border-border/60 bg-surface-raised p-md sm:grid-cols-3">
          <div>
            <BilingualText text={dictionary.backup.defaultLocation} size="sm" className="mb-1 text-ink-muted" />
            <p className="mb-2 truncate text-xs text-ink" title={backupSettings.customLocation ?? undefined}>
              {backupSettings.customLocation ?? dictionary.backup.builtInLocation.en}
            </p>
            <div className="flex gap-sm">
              <Button variant="ghost" size="sm" onClick={handleChangeDefaultLocation}>
                <BilingualText text={dictionary.backup.changeLocation} size="xs" align="center" />
              </Button>
              {backupSettings.customLocation && (
                <Button variant="ghost" size="sm" onClick={handleResetDefaultLocation}>
                  <BilingualText text={dictionary.backup.resetToDefault} size="xs" align="center" />
                </Button>
              )}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.backup.frequency} size="sm" className="text-ink-muted" />
            <select
              value={backupSettings.frequency}
              onChange={(event) => handleFrequencyChange(event.target.value as BackupSettings['frequency'])}
              className={selectClass}
            >
              <option value="daily">{dictionary.backup.frequencyDaily.en}</option>
              <option value="weekly">{dictionary.backup.frequencyWeekly.en}</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.backup.retentionCount} size="sm" className="text-ink-muted" />
            <select
              value={backupSettings.retentionCount}
              onChange={(event) => handleRetentionChange(Number(event.target.value) as BackupSettings['retentionCount'])}
              className={selectClass}
            >
              <option value={7}>7</option>
              <option value={14}>14</option>
              <option value={30}>30</option>
            </select>
          </label>
        </div>
      )}

      {restoring ? (
        <div className="mb-lg rounded-md bg-warning/10 px-md py-sm text-sm text-warning">{dictionary.backup.restoring.en}</div>
      ) : (
        <>
          <div className="mb-lg flex flex-wrap items-center gap-sm">
            <Button variant="primary" size="sm" onClick={() => handleBackupNow()} disabled={backupBusy}>
              <BilingualText
                text={backupBusy ? dictionary.backup.creatingBackup : dictionary.backup.backupNow}
                size="xs"
                align="center"
              />
            </Button>
            <Button variant="secondary" size="sm" onClick={handleChooseLocation} disabled={backupBusy}>
              <BilingualText text={dictionary.backup.chooseLocation} size="xs" align="center" />
            </Button>
            <Button variant="secondary" size="sm" onClick={handleRestoreFromFile}>
              <BilingualText text={dictionary.backup.restoreFromFile} size="xs" align="center" />
            </Button>
          </div>

          {message && (
            <p className={`mb-lg text-sm ${message.type === 'success' ? 'text-success' : 'text-danger'}`}>{message.text}</p>
          )}

          <BilingualText text={dictionary.backup.availableBackups} as="div" size="sm" className="mb-sm text-ink-muted" />
          {backups.length === 0 ? (
            <p className="mb-lg text-sm text-ink-muted">{dictionary.backup.noBackupsYet.en}</p>
          ) : (
            <ScrollList maxHeight="sm" className="mb-lg divide-y divide-border rounded-md border border-border/60">
              {backups.map((backup) => (
                <div key={backup.filePath} className="flex items-center justify-between px-md py-sm">
                  <div className="flex items-center gap-sm">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${kindBadgeClass[backup.kind]}`}>
                      {kindLabel[backup.kind].en}
                    </span>
                    <div>
                      <p className="text-sm text-ink">{formatDate(backup.createdAt)}</p>
                      <p className="text-xs text-ink-muted">{formatBytes(backup.sizeBytes)}</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setRestoreTarget({ type: 'file', filePath: backup.filePath })}>
                    <BilingualText text={dictionary.backup.restore} size="xs" align="center" />
                  </Button>
                </div>
              ))}
            </ScrollList>
          )}
        </>
      )}

      <div className="border-t border-border/60 pt-lg">
        <BilingualText text={dictionary.cloudBackup.title} as="div" size="lg" className="mb-md" />

        <GoogleDriveSection status={driveStatus} onStatusChange={loadDriveStatus} />

        {backupSettings && (
          <div className="mb-md flex flex-col gap-md rounded-md border border-border/60 bg-surface-raised p-md">
            <label className="flex items-center gap-sm">
              <input
                type="checkbox"
                checked={backupSettings.cloudBackupEnabled}
                onChange={(event) => handleCloudEnabledChange(event.target.checked)}
                disabled={!driveStatus?.connected}
                className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <BilingualText text={dictionary.cloudBackup.enabled} size="sm" />
            </label>

            <div>
              <BilingualText text={dictionary.cloudBackup.scheduledTimes} size="sm" className="mb-1 text-ink-muted" />
              <div className="mb-2 flex flex-wrap gap-2">
                {backupSettings.scheduledTimes.map((time) => (
                  <span
                    key={time}
                    className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                  >
                    {time}
                    <button
                      type="button"
                      onClick={() => handleRemoveTime(time)}
                      aria-label={`Remove ${time}`}
                      className="text-primary/70 hover:text-primary"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-sm">
                <input
                  type="time"
                  value={newTime}
                  onChange={(event) => setNewTime(event.target.value)}
                  className="rounded-md border border-border bg-surface px-sm py-1.5 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <Button variant="ghost" size="sm" onClick={handleAddTime}>
                  <BilingualText text={dictionary.cloudBackup.addTime} size="xs" align="center" />
                </Button>
              </div>
            </div>

            <div>
              <BilingualText text={dictionary.cloudBackup.lastBackup} size="sm" className="text-ink-muted" />
              <p className="text-sm text-ink">
                {cloudState?.lastCloudBackupAt ? formatDate(cloudState.lastCloudBackupAt) : dictionary.cloudBackup.neverBackedUp.en}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-sm">
          <Button variant="primary" size="sm" onClick={handleCloudBackupNow} disabled={cloudBusy || !driveStatus?.connected}>
            <BilingualText
              text={cloudBusy ? dictionary.cloudBackup.backingUp : dictionary.cloudBackup.backupNow}
              size="xs"
              align="center"
            />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRestoreTarget({ type: 'cloud' })}
            disabled={!driveStatus?.connected}
          >
            <BilingualText text={dictionary.cloudBackup.restoreFromCloud} size="xs" align="center" />
          </Button>
        </div>

        {cloudMessage && (
          <p className={`mt-md text-sm ${cloudMessage.type === 'success' ? 'text-success' : 'text-danger'}`}>{cloudMessage.text}</p>
        )}
      </div>

      <ConfirmDialog
        open={restoreTarget !== null}
        title={restoreTarget?.type === 'cloud' ? dictionary.cloudBackup.restoreConfirmTitle : dictionary.backup.restoreConfirmTitle}
        body={restoreTarget?.type === 'cloud' ? dictionary.cloudBackup.restoreConfirmBody : dictionary.backup.restoreConfirmBody}
        confirmLabel={dictionary.backup.restore}
        cancelLabel={dictionary.backup.cancel}
        danger
        onConfirm={handleConfirmRestore}
        onCancel={() => setRestoreTarget(null)}
      />
    </Card>
  )
}
