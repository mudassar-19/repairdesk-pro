import { randomBytes, createHash } from 'node:crypto'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import { app, safeStorage, shell } from 'electron'

/**
 * drive.file is the only *Drive* permission requested — this app can only
 * ever see/write files and folders it creates itself, never anything else
 * already in the client's Drive. openid+email ride along solely so the
 * token exchange's id_token carries the account's email address (for the
 * "Connected as x@gmail.com" status in Settings); they grant no additional
 * access to Drive or anything else, and no separate consent-screen
 * registration is needed for them beyond drive.file.
 */
const SCOPE = 'openid email https://www.googleapis.com/auth/drive.file'
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'
const FLOW_TIMEOUT_MS = 5 * 60 * 1000

const CLIENT_ID = import.meta.env.MAIN_VITE_GOOGLE_DRIVE_CLIENT_ID
const CLIENT_SECRET = import.meta.env.MAIN_VITE_GOOGLE_DRIVE_CLIENT_SECRET

export interface GoogleDriveSession {
  email: string
  refreshToken: string
  connectedAt: string
}

export type ConnectResult = { success: true; email: string } | { success: false; error: string }

export type AccessTokenResult =
  | { accessToken: string }
  | { error: 'not_connected' | 'revoked' | 'network'; message: string }

const sessionPath = (): string => path.join(app.getPath('userData'), 'google-drive-session.enc')

/** Same safeStorage-encrypted-blob-on-disk approach as the Firebase session (main/ipc/auth.ts) — one encrypted file per credential, never plaintext. */
export function loadGoogleDriveSession(): GoogleDriveSession | null {
  try {
    if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(sessionPath())) return null
    return JSON.parse(safeStorage.decryptString(fs.readFileSync(sessionPath()))) as GoogleDriveSession
  } catch {
    return null
  }
}

function saveGoogleDriveSession(session: GoogleDriveSession): void {
  const encrypted = safeStorage.encryptString(JSON.stringify(session))
  fs.writeFileSync(sessionPath(), encrypted)
}

export function clearGoogleDriveSession(): void {
  if (fs.existsSync(sessionPath())) fs.unlinkSync(sessionPath())
}

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Pulls the `email` claim out of the id_token JWT's payload — a local decode, not a verified/trusted claim, which is fine here since it's only ever used for the connected-account label shown back to the same user who just signed in. */
function decodeIdTokenEmail(idToken: string): string | null {
  try {
    const payload = idToken.split('.')[1]
    if (!payload) return null
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as { email?: string }
    return typeof json.email === 'string' ? json.email : null
  } catch {
    return null
  }
}

function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

interface LoopbackListener {
  port: number
  codePromise: Promise<string>
  close: () => void
}

/**
 * Waits for Google's redirect on a one-off local HTTP server bound to the
 * loopback interface (RFC 8252) — the standard, secure OAuth pattern for
 * desktop apps. Nothing is pre-registered: Google's "Desktop app" client
 * type accepts any loopback (127.0.0.1) redirect URI at any port, so a fresh OS-assigned
 * port is requested (and torn down) on every connect attempt. The `state`
 * check guards against another local process racing this one for the port.
 */
function startLoopbackListener(expectedState: string): Promise<LoopbackListener> {
  return new Promise((resolveListener) => {
    let settled = false
    let resolveCode!: (code: string) => void
    let rejectCode!: (err: Error) => void
    const codePromise = new Promise<string>((res, rej) => {
      resolveCode = res
      rejectCode = rej
    })

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      const state = url.searchParams.get('state')

      if (!code && !error) {
        res.writeHead(404).end()
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        `<html><body style="font-family:sans-serif;text-align:center;padding-top:80px">` +
          `<h2>${error ? 'Google Drive connection failed' : 'Google Drive connected'}</h2>` +
          `<p>You can close this tab and return to RepairDex Pro.</p></body></html>`
      )

      if (settled) return
      settled = true
      server.close()

      if (error) rejectCode(new Error(error))
      else if (state !== expectedState) rejectCode(new Error('State mismatch while connecting Google Drive — please try again'))
      else if (code) resolveCode(code)
    })

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolveListener({
        port,
        codePromise,
        close: () => server.close()
      })
    })
  })
}

/** Opens the system browser for the client to sign into and authorize *their own* Google Drive, then exchanges the resulting code for a refresh token. */
export async function connectGoogleDrive(): Promise<ConnectResult> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return {
      success: false,
      error: 'Google Drive is not configured for this build (missing OAuth client ID/secret).'
    }
  }

  const { verifier, challenge } = generatePkcePair()
  const state = base64url(randomBytes(16))
  const { port, codePromise, close } = await startLoopbackListener(state)
  const redirectUri = `http://127.0.0.1:${port}`

  try {
    const authUrl = new URL(AUTH_ENDPOINT)
    authUrl.searchParams.set('client_id', CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', SCOPE)
    authUrl.searchParams.set('access_type', 'offline')
    // Forces the consent screen every time, which is what guarantees Google
    // actually issues a refresh_token on this exchange (it's only granted
    // once per prior-consent by default, and we need it fresh every connect).
    authUrl.searchParams.set('prompt', 'consent')
    authUrl.searchParams.set('code_challenge', challenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('state', state)

    await shell.openExternal(authUrl.toString())

    const code = await Promise.race([
      codePromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out waiting for Google sign-in — please try again')), FLOW_TIMEOUT_MS)
      )
    ])

    const tokenResponse = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    })
    const tokenJson = (await tokenResponse.json()) as {
      access_token?: string
      refresh_token?: string
      id_token?: string
      error?: string
      error_description?: string
    }
    if (!tokenResponse.ok || !tokenJson.access_token) {
      throw new Error(tokenJson.error_description ?? tokenJson.error ?? 'Google rejected the authorization code')
    }
    if (!tokenJson.refresh_token) {
      throw new Error('Google did not return a refresh token — please try connecting again')
    }

    const email = tokenJson.id_token ? decodeIdTokenEmail(tokenJson.id_token) : null
    if (!email) {
      throw new Error('Could not read the connected Google account email')
    }

    saveGoogleDriveSession({
      email,
      refreshToken: tokenJson.refresh_token,
      connectedAt: new Date().toISOString()
    })
    return { success: true, email }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error while connecting Google Drive'
    return { success: false, error: message }
  } finally {
    close()
  }
}

/**
 * Exchanges the stored refresh token for a short-lived access token before
 * every Drive API call — access tokens expire in ~1 hour so nothing caches
 * one. An `invalid_grant` response means the client revoked access (or the
 * token expired) from the Google account side: the stored session is
 * cleared right here so the very next Settings status check reflects
 * "disconnected" without any separate polling.
 */
export async function getFreshAccessToken(): Promise<AccessTokenResult> {
  const session = loadGoogleDriveSession()
  if (!session) return { error: 'not_connected', message: 'Google Drive is not connected' }
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return { error: 'network', message: 'Google Drive is not configured for this build' }
  }

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: session.refreshToken,
        grant_type: 'refresh_token'
      })
    })
    const json = (await response.json()) as { access_token?: string; error?: string; error_description?: string }

    if (!response.ok || !json.access_token) {
      if (json.error === 'invalid_grant') {
        clearGoogleDriveSession()
        return { error: 'revoked', message: 'Google Drive access was revoked' }
      }
      return { error: 'network', message: json.error_description ?? json.error ?? 'Google Drive token refresh failed' }
    }

    return { accessToken: json.access_token }
  } catch (err) {
    return { error: 'network', message: err instanceof Error ? err.message : 'Network error while contacting Google' }
  }
}

/** Best-effort revoke on Google's side; the local encrypted session is always removed regardless of whether the network call succeeds. */
export async function disconnectGoogleDrive(): Promise<void> {
  const session = loadGoogleDriveSession()
  clearGoogleDriveSession()
  if (!session) return

  try {
    await fetch(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: session.refreshToken })
    })
  } catch {
    // Local disconnect must succeed even if Google's revoke endpoint is unreachable.
  }
}
