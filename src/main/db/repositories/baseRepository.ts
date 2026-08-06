import type { Db } from '../client'

/**
 * The shared transactional-write wrapper every business repository extends.
 * Originally also enqueued a sync_queue entry per write (the Firestore sync
 * engine); that was removed in favor of scheduled full-database cloud
 * backups, so this now just runs the mutation inside a transaction — which
 * still matters on its own: drizzle's better-sqlite3 driver implements
 * db.transaction() as a real BEGIN/COMMIT when this.db is the top-level
 * connection, or as a SAVEPOINT when this.db is already a transaction (e.g.
 * paymentService.recordPayment's outer transaction), so read-then-write
 * mutate callbacks (e.g. RepairRepository.update's status-lock check) still
 * commit or roll back atomically either way.
 */
export abstract class BaseRepository {
  protected constructor(protected readonly db: Db) {}

  protected write<T extends { id: string }>(mutate: (tx: Db) => T | null): T | null {
    return this.db.transaction((tx) => mutate(tx))
  }
}
