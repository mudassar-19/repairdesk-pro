import fs from 'node:fs'
import { SHARED_PROFILE_DIR, seedQaData } from './fixtures/support'

/**
 * Runs once before the whole suite. Wipes and reseeds the shared profile
 * (see fixtures/support.ts) with the repo's own QA data generator, which
 * already produces overdue-delivery and overdue-Udhaar cases, edge-case
 * prices, partially-settled Udhaar entries, etc. — exactly the states the
 * reminder-banner and lifecycle specs need, without hand-rolling fixtures.
 */
export default async function globalSetup(): Promise<void> {
  fs.rmSync(SHARED_PROFILE_DIR, { recursive: true, force: true })
  fs.mkdirSync(SHARED_PROFILE_DIR, { recursive: true })
  await seedQaData(SHARED_PROFILE_DIR)
}
