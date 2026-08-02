import { healthCheck } from './schema'
import { getDatabase } from './client'

/**
 * Round-trips a row through the SQLite/Drizzle stack to prove the connection
 * is real, not just "did open() throw". Used by the system:getHealth IPC
 * handler so the renderer can show a boot self-check.
 */
export function verifyDatabaseConnection(): { ok: boolean; checkedAt: string } {
  const db = getDatabase()
  const checkedAt = new Date().toISOString()

  db.insert(healthCheck).values({ checkedAt }).run()
  const rows = db.select().from(healthCheck).all()

  return { ok: rows.length > 0, checkedAt }
}
