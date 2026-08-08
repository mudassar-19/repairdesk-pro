import fs from 'node:fs'
import { SHARED_PROFILE_DIR, seedQaData, launchApp, authenticateOffline } from './fixtures/support'

/**
 * Runs once before the whole suite. Wipes and reseeds the shared profile
 * (see fixtures/support.ts) with the repo's own QA data generator, which
 * already produces overdue-delivery and overdue-Udhaar cases, edge-case
 * prices, partially-settled Udhaar entries, etc. — exactly the states the
 * reminder-banner and lifecycle specs need, without hand-rolling fixtures.
 *
 * It then establishes an OFFLINE session on the shared profile so the data
 * specs (navigation, customers, repairs, …) run without needing live Firebase
 * credentials or a network — keeping the suite self-contained and repeatable.
 * (The real-login tests in 00-auth run on their own throwaway profile, so this
 * pre-authentication never collides with the per-device account lock.)
 */
export default async function globalSetup(): Promise<void> {
  fs.rmSync(SHARED_PROFILE_DIR, { recursive: true, force: true })
  fs.mkdirSync(SHARED_PROFILE_DIR, { recursive: true })
  await seedQaData(SHARED_PROFILE_DIR)

  const { app, window } = await launchApp(SHARED_PROFILE_DIR)
  try {
    await authenticateOffline(window)
  } finally {
    await app.close()
  }
}
