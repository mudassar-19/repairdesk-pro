const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const Database = require('better-sqlite3')
const { drizzle } = require('drizzle-orm/better-sqlite3')
const { migrate } = require('drizzle-orm/better-sqlite3/migrator')

const REPO = path.dirname(__dirname)
const FULL = path.join(REPO, 'src/main/db/migrations')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'))
const dbPath = path.join(tmp, 'test.sqlite')

const partial = path.join(tmp, 'partial')
fs.mkdirSync(path.join(partial, 'meta'), { recursive: true })
const journal = JSON.parse(fs.readFileSync(path.join(FULL, 'meta/_journal.json'), 'utf-8'))
const partialJournal = { ...journal, entries: journal.entries.slice(0, 4) }
fs.writeFileSync(path.join(partial, 'meta/_journal.json'), JSON.stringify(partialJournal))
for (const e of partialJournal.entries) fs.copyFileSync(path.join(FULL, `${e.tag}.sql`), path.join(partial, `${e.tag}.sql`))

const applied = (f) => { const r = new Database(f); try { return r.prepare('SELECT count(*) c FROM __drizzle_migrations').get().c } finally { r.close() } }

let s = new Database(dbPath); migrate(drizzle(s), { migrationsFolder: partial }); s.close()
const afterOld = applied(dbPath)
assert.equal(afterOld, 4)
console.log(`  ok old install = ${afterOld} migrations (0000-0003)`)

s = new Database(dbPath); migrate(drizzle(s), { migrationsFolder: FULL }); s.close()
const afterUp = applied(dbPath)
assert.equal(afterUp, 7)
console.log(`  ok upgrade applied 3 skipped migrations in order -> ${afterUp} total`)

const r = new Database(dbPath)
const tables = r.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x => x.name)
r.close()
for (const t of ['customers','repairs','payments','expenses','udhaar','udhaar_settlements']) assert.ok(tables.includes(t), `missing ${t}`)
console.log('  ok full schema present after upgrade (incl. udhaar_settlements)')
fs.rmSync(tmp, { recursive: true, force: true })
console.log('Migration skip-upgrade test passed.')
