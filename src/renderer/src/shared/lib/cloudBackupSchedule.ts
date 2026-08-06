/**
 * Pure due/missed calculation for the scheduled cloud backup feature — no
 * Electron/Firebase dependency, so this is directly unit-testable. Each
 * entry in `scheduledTimes` is a 24-hour "HH:mm" string (e.g. "18:00").
 */

function parseTimeToMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

/**
 * The latest scheduled time-of-day that has already passed as of `now`,
 * expressed as a concrete Date for today — or null if none has passed yet
 * today. Only the most recent slot matters: if two of today's three times
 * have already passed, only the later one determines whether a backup is due.
 */
export function mostRecentDueSlotToday(scheduledTimes: string[], now: Date): Date | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const dueMinutes = scheduledTimes
    .map(parseTimeToMinutes)
    .filter((minutes) => minutes <= nowMinutes)
    .sort((a, b) => b - a)[0]
  if (dueMinutes === undefined) return null

  const slot = new Date(now)
  slot.setHours(Math.floor(dueMinutes / 60), dueMinutes % 60, 0, 0)
  return slot
}

/**
 * True if the most recent scheduled slot that's already passed today has no
 * successful backup covering it yet. A `lastCloudBackupAt` from an earlier
 * day is always "before" today's slot, so a fresh day with nothing backed
 * up yet is correctly due the moment the first scheduled time passes.
 */
export function isCloudBackupDue(scheduledTimes: string[], lastCloudBackupAt: string | null, now: Date): boolean {
  const slot = mostRecentDueSlotToday(scheduledTimes, now)
  if (!slot) return false
  if (!lastCloudBackupAt) return true
  return new Date(lastCloudBackupAt).getTime() < slot.getTime()
}
