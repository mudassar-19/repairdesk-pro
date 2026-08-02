import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

/**
 * Standalone migration runner for `npm run db:migrate`, applying whatever
 * drizzle-kit has generated into src/main/db/migrations. Not invoked by the
 * app itself in Phase 1 — the main process bootstraps its own table directly
 * (see db/client.ts) since there is no schema history to replay yet.
 */
const dbPath = path.join(process.cwd(), 'repairdesk.dev.sqlite')
const sqlite = new Database(dbPath)
const db = drizzle(sqlite)

migrate(db, { migrationsFolder: path.join(process.cwd(), 'src/main/db/migrations') })
console.log(`Migrations applied to ${dbPath}`)
