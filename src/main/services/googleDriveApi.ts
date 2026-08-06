import fs from 'node:fs'

/**
 * One dedicated folder per client account, one fixed file inside it — every
 * successful upload updates that same file in place (PATCH), so the Drive
 * folder always holds exactly the latest backup, never an accumulating
 * history (same "replace, don't accumulate" model the local cloud slot used
 * with Firebase Storage previously).
 */
const FOLDER_NAME = 'RepairDex Pro Backups'
const BACKUP_FILE_NAME = 'repairdesk-latest-backup.sqlite'
const BACKUP_MIME_TYPE = 'application/x-sqlite3'
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files'

async function driveFetch(accessToken: string, url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${accessToken}` }
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Google Drive request failed (${response.status}): ${body || response.statusText}`)
  }
  return response
}

function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** drive.file scope only ever sees files/folders this app itself created, so this search is inherently scoped — it can't match anything else in the client's Drive even without an explicit owner filter. */
async function findFile(accessToken: string, name: string, mimeType: string, parentId?: string): Promise<string | null> {
  const clauses = [
    `name = '${escapeQueryValue(name)}'`,
    `mimeType = '${mimeType}'`,
    'trashed = false',
    parentId ? `'${parentId}' in parents` : "'root' in parents"
  ]
  const url = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(clauses.join(' and '))}&fields=files(id)&spaces=drive`
  const response = await driveFetch(accessToken, url)
  const json = (await response.json()) as { files?: { id: string }[] }
  return json.files?.[0]?.id ?? null
}

async function ensureBackupFolder(accessToken: string): Promise<string> {
  const existing = await findFile(accessToken, FOLDER_NAME, FOLDER_MIME_TYPE)
  if (existing) return existing

  const response = await driveFetch(accessToken, `${DRIVE_FILES_ENDPOINT}?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME_TYPE })
  })
  const json = (await response.json()) as { id: string }
  return json.id
}

/** Uploads the given local backup file, replacing whatever backup already sits in the client's dedicated Drive folder. */
export async function uploadBackup(accessToken: string, filePath: string): Promise<void> {
  const folderId = await ensureBackupFolder(accessToken)
  const existingFileId = await findFile(accessToken, BACKUP_FILE_NAME, BACKUP_MIME_TYPE, folderId)
  const bytes = fs.readFileSync(filePath)

  if (existingFileId) {
    await driveFetch(accessToken, `${DRIVE_UPLOAD_ENDPOINT}/${existingFileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': BACKUP_MIME_TYPE },
      body: bytes
    })
    return
  }

  const boundary = `repairdesk-backup-${Date.now()}`
  const metadata = JSON.stringify({ name: BACKUP_FILE_NAME, parents: [folderId] })
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${BACKUP_MIME_TYPE}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--`)
  ])

  await driveFetch(accessToken, `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body
  })
}

export async function downloadLatestBackup(accessToken: string): Promise<Buffer> {
  const folderId = await findFile(accessToken, FOLDER_NAME, FOLDER_MIME_TYPE)
  if (!folderId) throw new Error('No backup folder found in Google Drive yet')

  const fileId = await findFile(accessToken, BACKUP_FILE_NAME, BACKUP_MIME_TYPE, folderId)
  if (!fileId) throw new Error('No backup found in Google Drive yet')

  const response = await driveFetch(accessToken, `${DRIVE_FILES_ENDPOINT}/${fileId}?alt=media`)
  return Buffer.from(await response.arrayBuffer())
}
