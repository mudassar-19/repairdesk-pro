import path from 'node:path'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { _electron as electron, type ElectronApplication, type Page } from 'playwright'

export const REPO_ROOT = path.resolve(__dirname, '..', '..')
export const MAIN_ENTRY = path.join(REPO_ROOT, 'out/main/index.js')

/**
 * One profile directory shared across the ordered spec files (00, 01, 02, ...)
 * so later specs build on state created by earlier ones — a repair created in
 * 03-repairs depends on a customer from 02-customers, exactly like a real shop
 * using the app day to day. Playwright is configured with workers: 1 and
 * fullyParallel: false so specs never touch this concurrently.
 */
export const SHARED_PROFILE_DIR = path.join(REPO_ROOT, 'e2e/.profiles/shared')

/** Used by specs that need a throwaway, unauthenticated profile (e.g. login validation). */
export function freshProfileDir(name: string): string {
  const dir = path.join(REPO_ROOT, 'e2e/.profiles', `${name}-${Date.now()}`)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export async function launchApp(profileDir: string): Promise<{ app: ElectronApplication; window: Page }> {
  fs.mkdirSync(profileDir, { recursive: true })
  const app = await electron.launch({
    args: [MAIN_ENTRY, `--user-data-dir=${profileDir}`],
    cwd: REPO_ROOT
  })
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  return { app, window }
}

/** Runs scripts/seedQaData.ts (the repo's own QA data generator) against a given profile dir. */
export function seedQaData(profileDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      path.join(REPO_ROOT, 'node_modules/.bin/electron'),
      ['scripts/runSeedQaData.js', `--user-data-dir=${profileDir}`, '--confirm'],
      { cwd: REPO_ROOT, stdio: ['pipe', 'pipe', 'pipe'] }
    )
    let out = ''
    child.stdout.on('data', (d) => (out += d.toString()))
    child.stderr.on('data', (d) => (out += d.toString()))
    child.stdin.write('SEED THIS DATABASE\n')
    child.stdin.end()
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`seedQaData exited with code ${code}:\n${out}`))
    })
  })
}

/**
 * Establishes an authenticated session WITHOUT Firebase (offline-first): injects
 * a local session via the app's own IPC, then reloads so useAuthBootstrap picks
 * it up — mirrors scripts/e2e-setup-session.js. Lets a spec run on a fresh
 * profile without real credentials.
 */
export async function authenticateOffline(window: Page): Promise<void> {
  const deviceId = await window.evaluate(() => window.api.auth.getDeviceId())
  await window.evaluate(async (id) => {
    await window.api.auth.saveLocalSession({
      uid: 'qa-e2e-test-uid',
      email: 'qa-e2e@repairdesk.local',
      deviceId: id,
      refreshToken: 'not-real',
      issuedAt: new Date().toISOString()
    })
  }, deviceId)
  await window.reload()
  await window.waitForLoadState('domcontentloaded')
}

export const SHOTS_DIR = path.join(REPO_ROOT, 'e2e/report/screenshots')

export async function shoot(window: Page, name: string): Promise<void> {
  fs.mkdirSync(SHOTS_DIR, { recursive: true })
  await window.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: true })
}
