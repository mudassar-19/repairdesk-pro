/**
 * One-time QA data seed — generates a believable month of shop activity
 * (customers, repairs, payments, udhaar, expenses) via the real repository/
 * service layer, so every business rule (remaining-balance recalculation,
 * status locking, transactional payment/settlement writes) is respected
 * exactly as the real app enforces it. Timestamps are backdated afterward
 * with a direct, raw update (no repository supports a custom createdAt),
 * which is safe here since nothing else touches these rows concurrently.
 *
 * Deliberately NOT the same thing as src/main/db/seed.ts (three hardcoded
 * dev-sample rows, auto-run on every `npm run dev` behind is.dev) or
 * src/main/db/devSelfTest.ts (a self-cleaning CRUD smoke test) — this is a
 * manually-invoked, one-shot generator for QA story data, gated behind an
 * explicit --confirm flag AND a typed interactive confirmation so it can
 * never run by accident against a database with real data in it.
 *
 * Run with: npm run seed:qa -- --confirm
 */
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import readline from 'node:readline'
import { eq } from 'drizzle-orm'

import { initDatabase, getDatabasePath, type AppDatabase } from '../src/main/db/client'
import {
  customers,
  repairs,
  payments,
  expenses,
  udhaar,
  udhaarSettlements,
  type RepairStatus,
  type PaymentType,
  type UdhaarDirection
} from '../src/main/db/schema'
import { CustomerRepository } from '../src/main/db/repositories/customerRepository'
import { RepairRepository } from '../src/main/db/repositories/repairRepository'
import { ExpenseRepository } from '../src/main/db/repositories/expenseRepository'
import { UdhaarRepository } from '../src/main/db/repositories/udhaarRepository'
import { ActivityLogRepository } from '../src/main/db/repositories/activityLogRepository'
import { SettingsRepository } from '../src/main/db/repositories/settingsRepository'
import { recordPayment } from '../src/main/db/services/paymentService'
import { recordUdhaarSettlement } from '../src/main/db/services/udhaarService'
import { DashboardRepository } from '../src/main/db/repositories/dashboardRepository'
import { ReportRepository } from '../src/main/db/repositories/reportRepository'
import { AnalyticsRepository } from '../src/main/db/repositories/analyticsRepository'

// ---------------------------------------------------------------------------
// RNG / date helpers
// ---------------------------------------------------------------------------
const NOW = new Date()

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}
function pick<T>(arr: T[]): T {
  return arr[rand(0, arr.length - 1)]!
}
function pickWeighted<T>(pairs: [T, number][]): T {
  const total = pairs.reduce((s, [, w]) => s + w, 0)
  let r = randFloat(0, total)
  for (const [val, w] of pairs) {
    if (r < w) return val
    r -= w
  }
  return pairs[pairs.length - 1]![0]
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(0, i)
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** n days before NOW; negative n means n days in the future. */
function daysAgoDate(n: number): Date {
  const d = new Date(NOW)
  d.setDate(d.getDate() - n)
  return d
}
function atTime(date: Date, hour: number, minute: number): Date {
  const d = new Date(date)
  d.setHours(hour, minute, rand(0, 59), 0)
  return d
}
function clampToNow(date: Date): Date {
  return date.getTime() > NOW.getTime() ? new Date(NOW) : date
}
function isoOf(date: Date): string {
  return date.toISOString()
}
function dateOnlyOf(date: Date): string {
  return date.toISOString().slice(0, 10)
}
function someDateBetween(a: Date, b: Date): Date {
  const lo = Math.min(a.getTime(), b.getTime())
  const hi = Math.max(a.getTime(), b.getTime(), lo + 1)
  return new Date(rand(lo, hi))
}
function randomImei(): string {
  return Array.from({ length: 15 }, () => rand(0, 9)).join('')
}

// ---------------------------------------------------------------------------
// Data pools
// ---------------------------------------------------------------------------
const MALE_FIRST = [
  'Ahmed', 'Muhammad Ali', 'Bilal', 'Usman', 'Hamza', 'Zeeshan', 'Faisal', 'Imran', 'Kashif', 'Adeel',
  'Waqas', 'Asad', 'Fahad', 'Junaid', 'Shahzad', 'Naveed', 'Rizwan', 'Tariq', 'Saad', 'Umair',
  'Hassan', 'Hussain', 'Arslan', 'Danish', 'Farhan', 'Salman', 'Nabeel', 'Awais', 'Talha', 'Yasir'
]
const FEMALE_FIRST = [
  'Ayesha', 'Sana', 'Mehwish', 'Sadia', 'Rabia', 'Amna', 'Hina', 'Iqra', 'Sobia', 'Nadia',
  'Faiza', 'Zainab', 'Maria', 'Anum', 'Sidra', 'Bushra', 'Sundas', 'Kiran', 'Naila', 'Uzma'
]
const LAST_NAMES = [
  'Khan', 'Ali', 'Malik', 'Sheikh', 'Butt', 'Chaudhry', 'Raza', 'Iqbal', 'Farooq', 'Abbasi',
  'Qureshi', 'Siddiqui', 'Awan', 'Baig', 'Hashmi', 'Rana', 'Javed', 'Akhtar', 'Mahmood', 'Yousaf'
]
function randomName(): string {
  const first = Math.random() < 0.65 ? pick(MALE_FIRST) : pick(FEMALE_FIRST)
  return `${first} ${pick(LAST_NAMES)}`
}

const PHONE_PREFIXES = [
  '0300', '0301', '0302', '0303', '0304', '0305', '0306', '0307', '0308', '0309',
  '0320', '0321', '0322', '0323', '0324', '0325', '0333', '0334', '0335', '0336',
  '0337', '0340', '0341', '0342', '0343', '0344', '0345', '0312', '0313', '0314'
]
const usedPhones = new Set<string>()
function randomPhone(): string {
  let phone: string
  do {
    phone = pick(PHONE_PREFIXES) + String(rand(1000000, 9999999))
  } while (usedPhones.has(phone))
  usedPhones.add(phone)
  return phone
}

const ADDRESSES = [
  'Gulberg III, Lahore', 'DHA Phase 5, Karachi', 'F-10 Markaz, Islamabad', 'Johar Town, Lahore',
  'Saddar, Rawalpindi', 'Clifton Block 5, Karachi', 'Model Town, Lahore', 'Bahria Town Phase 4, Rawalpindi',
  'North Nazimabad, Karachi', 'G-9 Markaz, Islamabad', 'Faisal Town, Lahore', 'Gulshan-e-Iqbal, Karachi',
  'Satellite Town, Rawalpindi', 'Wapda Town, Lahore', 'PECHS, Karachi'
]
const CUSTOMER_NOTES = ['Prefers WhatsApp updates', 'Regular customer', 'Referred by a friend', 'Cash only']
const ACCESSORIES = ['Charger', 'Charger, Box', 'Case', 'Charger, Earphones', 'Box']
const DELIVERY_TIMES = ['5:00 PM', 'After 6 PM', 'Evening', '2:00 PM', 'Before Maghrib']
const REPAIR_NOTES = [
  'Customer in a hurry', 'Handle with care - screen already cracked in corner', 'Call before starting repair', 'Under budget constraint'
]

const DEVICES: { brand: string; models: string[] }[] = [
  { brand: 'Samsung', models: ['Galaxy A14', 'Galaxy A54', 'Galaxy S21', 'Galaxy Note 10', 'Galaxy A34', 'Galaxy M14'] },
  { brand: 'Xiaomi', models: ['Redmi Note 11', 'Redmi 10', 'Poco X3', 'Redmi Note 12', 'Mi 11 Lite'] },
  { brand: 'Apple', models: ['iPhone 11', 'iPhone 12', 'iPhone 13', 'iPhone XR', 'iPhone 12 Pro', 'iPhone SE'] },
  { brand: 'Oppo', models: ['A57', 'Reno 8', 'A17', 'F19'] },
  { brand: 'Vivo', models: ['Y21', 'V23', 'Y16', 'Y33s'] },
  { brand: 'Infinix', models: ['Hot 12', 'Note 12', 'Smart 7', 'Zero 20'] },
  { brand: 'Realme', models: ['C35', 'Narzo 50', '9 Pro'] },
  { brand: 'Tecno', models: ['Spark 9', 'Camon 19'] }
]

interface IssueDef {
  issue: string
  costRange: [number, number]
  priceRange: [number, number]
  weight: number
}
const ISSUES: IssueDef[] = [
  { issue: 'Screen replacement', costRange: [2500, 7000], priceRange: [4000, 10000], weight: 30 },
  { issue: 'Battery replacement', costRange: [900, 2200], priceRange: [1800, 4000], weight: 22 },
  { issue: 'Charging port repair', costRange: [500, 1400], priceRange: [1000, 2500], weight: 16 },
  { issue: 'Water damage', costRange: [1500, 9000], priceRange: [2500, 15000], weight: 8 },
  { issue: 'Software issue / unresponsive', costRange: [200, 700], priceRange: [500, 2000], weight: 12 },
  { issue: 'Camera not working', costRange: [1200, 3500], priceRange: [2000, 5500], weight: 6 },
  { issue: 'Speaker/mic issue', costRange: [500, 1300], priceRange: [900, 2200], weight: 8 },
  { issue: 'Back glass replacement', costRange: [1200, 3800], priceRange: [2000, 6000], weight: 7 },
  { issue: 'Motherboard repair', costRange: [3000, 14000], priceRange: [5000, 20000], weight: 4 },
  { issue: 'SIM tray / button repair', costRange: [150, 500], priceRange: [300, 900], weight: 5 }
]
function pickIssue(): IssueDef {
  const total = ISSUES.reduce((s, i) => s + i.weight, 0)
  let r = randFloat(0, total)
  for (const i of ISSUES) {
    if (r < i.weight) return i
    r -= i.weight
  }
  return ISSUES[0]!
}

const STANDALONE_NAMES_RECEIVABLE = ['Rashid Traders (walk-in loan)', 'Kamran (neighbor)', 'Ayesha Malik (advance salary)']
const STANDALONE_NAMES_PAYABLE = ['Al-Falah Mobile Parts Supplier', 'Uncle Rasheed (shop renovation loan)', 'Zafar Electronics Wholesaler']

// ---------------------------------------------------------------------------
// Safety gate
// ---------------------------------------------------------------------------
function ask(promptText: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(promptText, (answer) => { rl.close(); resolve(answer) }))
}

/** Returns true if the operator confirmed and seeding should proceed, false otherwise. Callers must check the return value — see comment below on why app.exit() alone isn't a reliable enough guard in Electron's main process. */
async function runSafetyGate(db: AppDatabase): Promise<boolean> {
  const dbPath = getDatabasePath()
  const hasConfirmFlag = process.argv.includes('--confirm')

  const counts = {
    customers: db.select().from(customers).all().length,
    repairs: db.select().from(repairs).all().length,
    payments: db.select().from(payments).all().length,
    expenses: db.select().from(expenses).all().length,
    udhaar: db.select().from(udhaar).all().length,
    udhaarSettlements: db.select().from(udhaarSettlements).all().length
  }

  console.log('='.repeat(72))
  console.log('RepairDex Pro — QA Seed Script')
  console.log('='.repeat(72))
  console.log(`Target database: ${dbPath}`)
  console.log('Current row counts (including soft-deleted):')
  console.log(`  customers=${counts.customers} repairs=${counts.repairs} payments=${counts.payments}`)
  console.log(`  expenses=${counts.expenses} udhaar=${counts.udhaar} udhaarSettlements=${counts.udhaarSettlements}`)
  console.log('\nThis will permanently write ~90 customers, ~130-155 repairs, matching payments,')
  console.log('~10 udhaar entries, and ~22 expenses into the database above.')

  // Neither process.exit() nor app.exit() reliably halts the REST of this
  // function's synchronous execution in Electron's main process (both
  // schedule teardown rather than guaranteeing an immediate hard stop) — so
  // the real guard is the boolean return value below, which the caller must
  // check before doing anything else. Confirmed by an earlier run of this
  // exact script printing its refusal message and then continuing on to
  // print the confirmation prompt anyway.
  if (!hasConfirmFlag) {
    console.log('\nRefusing to run without --confirm.')
    console.log('Re-run as: npm run seed:qa -- --confirm\n')
    return false
  }

  const settingsRepo = new SettingsRepository(db)
  const priorSeed = settingsRepo.get<{ appliedAt: string }>('qaSeed.state')
  if (priorSeed) {
    console.log(
      `\n⚠ WARNING: QA seed data was already generated on ${priorSeed.appliedAt}. Running again will ADD a ` +
        'second batch on top of the first (duplicate story data), not replace it.'
    )
  }

  console.log('\nType exactly SEED THIS DATABASE to proceed, or anything else to cancel.')
  const answer = await ask('> ')
  if (answer.trim() !== 'SEED THIS DATABASE') {
    console.log('Cancelled — no changes made.')
    return false
  }
  return true
}

function safetyBackupCopy(dbPath: string): string | null {
  if (!fs.existsSync(dbPath)) return null
  const dir = path.dirname(dbPath)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dest = path.join(dir, `pre-qa-seed-safety-copy-${stamp}.sqlite`)
  fs.copyFileSync(dbPath, dest)
  for (const suffix of ['-wal', '-shm']) {
    if (fs.existsSync(dbPath + suffix)) fs.copyFileSync(dbPath + suffix, dest + suffix)
  }
  return dest
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------
interface GeneratedRepair {
  id: string
  customerIdx: number
  status: RepairStatus
  createdAt: Date
  ageDays: number
  repairPrice: number
}

function generateAll(db: AppDatabase) {
  const customerRepo = new CustomerRepository(db)
  const repairRepo = new RepairRepository(db)
  const expenseRepo = new ExpenseRepository(db)
  const udhaarRepo = new UdhaarRepository(db)

  function backdate(table: typeof customers | typeof repairs | typeof payments | typeof expenses | typeof udhaar | typeof udhaarSettlements, id: string, createdAt: Date, updatedAt: Date) {
    db.update(table)
      .set({ createdAt: isoOf(createdAt), updatedAt: isoOf(clampToNow(updatedAt)) } as never)
      .where(eq((table as typeof customers).id, id))
      .run()
  }

  // --- Phase 1: customer plan -----------------------------------------
  const REPEAT_COUNT = 30
  const ONETIME_COUNT = 60
  interface CustomerPlan {
    name: string
    phone: string
    address: string | null
    notes: string | null
    visits: number
  }
  const plan: CustomerPlan[] = []
  for (let i = 0; i < REPEAT_COUNT; i++) {
    const visits = pickWeighted<number>([[2, 0.4], [3, 0.35], [4, 0.25]])
    plan.push({
      name: randomName(),
      phone: randomPhone(),
      address: Math.random() < 0.7 ? pick(ADDRESSES) : null,
      notes: Math.random() < 0.15 ? pick(CUSTOMER_NOTES) : null,
      visits
    })
  }
  for (let i = 0; i < ONETIME_COUNT; i++) {
    plan.push({
      name: randomName(),
      phone: randomPhone(),
      address: Math.random() < 0.7 ? pick(ADDRESSES) : null,
      notes: null,
      visits: 1
    })
  }
  // Deliberate duplicate-sounding name, different phone (edge case).
  plan[0]!.name = 'Muhammad Bilal Khan'
  plan[REPEAT_COUNT + 5]!.name = 'Muhammad Bilal Khan'

  const T = plan.reduce((s, c) => s + c.visits, 0)

  // --- Phase 2: day-slot distribution (weekday/weekend variation) -----
  const DAY_WEIGHT: Record<number, number> = { 0: 0.55, 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.05, 5: 0.8, 6: 1.15 } // 0=Sun
  const dayOffsets = Array.from({ length: 30 }, (_, i) => 29 - i) // 29 (oldest) ... 0 (today)
  const rawWeights = dayOffsets.map((off) => DAY_WEIGHT[daysAgoDate(off).getDay()]! * randFloat(0.75, 1.25))
  const weightSum = rawWeights.reduce((a, b) => a + b, 0)
  const dayCounts = dayOffsets.map((_, idx) => Math.round((rawWeights[idx]! / weightSum) * T))
  let drift = T - dayCounts.reduce((a, b) => a + b, 0)
  while (drift !== 0) {
    const idx = rand(0, dayCounts.length - 1)
    if (drift > 0) { dayCounts[idx]!++; drift-- }
    else if (dayCounts[idx]! > 0) { dayCounts[idx]!--; drift++ }
  }
  const flatSlots: number[] = []
  dayOffsets.forEach((off, idx) => { for (let k = 0; k < dayCounts[idx]!; k++) flatSlots.push(off) })
  const pool = shuffle(flatSlots)

  function nextDaySlot(excluding: Set<number>): number {
    const idx = pool.findIndex((v) => !excluding.has(v))
    const useIdx = idx === -1 ? 0 : idx
    return pool.splice(useIdx, 1)[0]!
  }

  // --- Phase 3: assign visits to customers, then sort chronologically -
  interface VisitAssignment { customerIdx: number; dayOffset: number }
  const assignments: VisitAssignment[] = []
  plan.forEach((c, idx) => {
    const usedDays = new Set<number>()
    for (let v = 0; v < c.visits; v++) {
      const dayOffset = nextDaySlot(usedDays)
      usedDays.add(dayOffset)
      assignments.push({ customerIdx: idx, dayOffset })
    }
  })
  assignments.sort((a, b) => b.dayOffset - a.dayOffset) // oldest first

  // --- Phase 4: generate customers + repairs in chronological order ---
  function pickStatusForAge(ageDays: number): RepairStatus {
    if (ageDays <= 3) return Math.random() < 0.55 ? 'pending' : 'completed'
    if (ageDays <= 5) {
      const r = Math.random()
      if (r < 0.4) return 'delivered'
      if (r < 0.7) return 'completed'
      if (r < 0.85) return 'pending'
      return 'cancelled'
    }
    const r = Math.random()
    if (r < 0.8) return 'delivered'
    if (r < 0.92) return 'cancelled'
    if (r < 0.97) return 'completed'
    return 'pending'
  }
  function decideAdvance(status: RepairStatus, repairPrice: number): number {
    if (status === 'pending') return Math.random() < 0.4 ? Math.round(repairPrice * randFloat(0.15, 0.4)) : 0
    if (status === 'completed') return Math.random() < 0.75 ? Math.round(repairPrice * randFloat(0.2, 0.5)) : 0
    if (status === 'delivered') return Math.round(repairPrice * randFloat(0.2, 0.6))
    return 0
  }
  function decideEstimatedDeliveryDate(createdAt: Date, status: RepairStatus): string {
    const d = new Date(createdAt)
    d.setDate(d.getDate() + rand(1, 4))
    if (status === 'delivered' || status === 'cancelled') return dateOnlyOf(d)
    const today = dateOnlyOf(NOW)
    const candidate = dateOnlyOf(d)
    return candidate < today ? today : candidate
  }
  function decideUpdatedAt(status: RepairStatus, createdAt: Date): Date {
    const d = new Date(createdAt)
    if (status === 'pending') return d
    if (status === 'completed') d.setHours(d.getHours() + rand(4, 48))
    else if (status === 'delivered') d.setHours(d.getHours() + rand(24, 120))
    else d.setHours(d.getHours() + rand(2, 72)) // cancelled
    return clampToNow(d)
  }

  const createdCustomers = new Map<number, { id: string }>()
  const generated: GeneratedRepair[] = []

  const edgeTimestampIdxs = new Set<number>()
  while (edgeTimestampIdxs.size < 5) edgeTimestampIdxs.add(rand(0, assignments.length - 1))

  assignments.forEach((a, aIdx) => {
    const cPlan = plan[a.customerIdx]!
    const dayDate = daysAgoDate(a.dayOffset)

    let hour: number, minute: number
    if (edgeTimestampIdxs.has(aIdx)) {
      if (Math.random() < 0.5) { hour = 0; minute = rand(5, 45) }
      else { hour = 23; minute = rand(15, 55) }
    } else {
      hour = rand(10, 19)
      minute = rand(0, 59)
    }
    const createdAtDate = clampToNow(atTime(dayDate, hour, minute))

    let customerRow = createdCustomers.get(a.customerIdx)
    if (!customerRow) {
      const created = customerRepo.create({ name: cPlan.name, phone: cPlan.phone, address: cPlan.address, notes: cPlan.notes })
      backdate(customers, created.id, createdAtDate, createdAtDate)
      customerRow = { id: created.id }
      createdCustomers.set(a.customerIdx, customerRow)
    }

    const issueDef = pickIssue()
    const device = pick(DEVICES)
    const model = pick(device.models)
    const repairPrice = rand(issueDef.priceRange[0], issueDef.priceRange[1])
    const costPrice = rand(issueDef.costRange[0], issueDef.costRange[1])
    const priority = pickWeighted<'normal' | 'high' | 'low'>([['normal', 0.7], ['high', 0.2], ['low', 0.1]])
    const status = pickStatusForAge(a.dayOffset)
    const advanceAmount = decideAdvance(status, repairPrice)
    const estimatedDeliveryDate = decideEstimatedDeliveryDate(createdAtDate, status)

    const created = repairRepo.create({
      customerId: customerRow.id,
      deviceBrand: device.brand,
      deviceModel: model,
      issue: issueDef.issue,
      accessories: Math.random() < 0.25 ? pick(ACCESSORIES) : null,
      imei: Math.random() < 0.4 ? randomImei() : null,
      status,
      costPrice,
      repairPrice,
      advanceAmount,
      priority,
      estimatedDeliveryDate,
      deliveryTime: Math.random() < 0.3 ? pick(DELIVERY_TIMES) : null,
      notes: Math.random() < 0.1 ? pick(REPAIR_NOTES) : null
    })

    const updatedAtDate = decideUpdatedAt(status, createdAtDate)
    backdate(repairs, created.id, createdAtDate, updatedAtDate)

    generated.push({ id: created.id, customerIdx: a.customerIdx, status, createdAt: createdAtDate, ageDays: a.dayOffset, repairPrice })
  })

  // --- Phase 4.5: deliberate story overrides ---------------------------
  const specialIds = new Set<string>()
  function forceStatus(id: string, newStatus: RepairStatus, newEstimatedDeliveryDate?: string) {
    const patch: Record<string, unknown> = { status: newStatus, updatedAt: new Date().toISOString() }
    if (newEstimatedDeliveryDate) patch.estimatedDeliveryDate = newEstimatedDeliveryDate
    db.update(repairs).set(patch as never).where(eq(repairs.id, id)).run()
  }

  // A) Overdue-stuck set — triggers the Overdue Delivery Reminder.
  const overdueCandidates = shuffle(generated.filter((g) => g.ageDays >= 6 && !specialIds.has(g.id))).slice(0, 7)
  overdueCandidates.forEach((g) => {
    specialIds.add(g.id)
    const newStatus: RepairStatus = Math.random() < 0.6 ? 'pending' : 'completed'
    const overdueDate = new Date(g.createdAt)
    overdueDate.setDate(overdueDate.getDate() + rand(1, 3))
    let edd = dateOnlyOf(overdueDate)
    if (edd >= dateOnlyOf(NOW)) edd = dateOnlyOf(daysAgoDate(1))
    forceStatus(g.id, newStatus, edd)
    g.status = newStatus
  })

  // B) Today's Deliveries set (small bonus richness for the dashboard).
  const todaysCandidates = shuffle(
    generated.filter((g) => g.ageDays <= 2 && !specialIds.has(g.id) && (g.status === 'pending' || g.status === 'completed'))
  ).slice(0, 3)
  todaysCandidates.forEach((g) => {
    specialIds.add(g.id)
    db.update(repairs).set({ estimatedDeliveryDate: dateOnlyOf(NOW), updatedAt: new Date().toISOString() }).where(eq(repairs.id, g.id)).run()
  })

  // D) Near-zero and unusually-large repair prices.
  const tinyPriceRepair = generated.find((g) => !specialIds.has(g.id) && g.status !== 'cancelled')!
  specialIds.add(tinyPriceRepair.id)
  db.update(repairs)
    .set({ repairPrice: 150, costPrice: 60, advanceAmount: 0, remainingBalance: 150, status: 'delivered', updatedAt: new Date().toISOString() })
    .where(eq(repairs.id, tinyPriceRepair.id))
    .run()
  tinyPriceRepair.repairPrice = 150
  tinyPriceRepair.status = 'delivered'

  const largePriceRepair = generated.find((g) => !specialIds.has(g.id) && g.status !== 'cancelled')!
  specialIds.add(largePriceRepair.id)
  db.update(repairs)
    .set({ repairPrice: 58000, costPrice: 32000, advanceAmount: 0, remainingBalance: 58000, status: 'delivered', updatedAt: new Date().toISOString() })
    .where(eq(repairs.id, largePriceRepair.id))
    .run()
  largePriceRepair.repairPrice = 58000
  largePriceRepair.status = 'delivered'

  // C) One repeat customer with both a cancelled and a delivered repair.
  const byCustomer = new Map<number, GeneratedRepair[]>()
  generated.forEach((g) => {
    if (!byCustomer.has(g.customerIdx)) byCustomer.set(g.customerIdx, [])
    byCustomer.get(g.customerIdx)!.push(g)
  })
  for (let idx = 0; idx < REPEAT_COUNT; idx++) {
    const list = (byCustomer.get(idx) ?? []).filter((g) => !specialIds.has(g.id))
    if (list.length >= 2) {
      const [a, b] = list
      specialIds.add(a!.id)
      specialIds.add(b!.id)
      forceStatus(a!.id, 'cancelled')
      a!.status = 'cancelled'
      forceStatus(b!.id, 'delivered')
      b!.status = 'delivered'
      break
    }
  }

  // Underpaid-delivered set — feeds Udhaar (3 of the 6 get a linked receivable).
  const deliveredNotSpecial = generated.filter((g) => g.status === 'delivered' && !specialIds.has(g.id))
  const underpaidDelivered = shuffle(deliveredNotSpecial).slice(0, 6)
  underpaidDelivered.forEach((g) => specialIds.add(g.id))
  const linkedUdhaarEntries: { id: string; totalAmount: number; createdAt: Date }[] = []
  underpaidDelivered.forEach((g, i) => {
    if (i >= 3) return
    const repairRow = repairRepo.findById(g.id)!
    const customerRow = customerRepo.findById(repairRow.customerId)!
    const created = udhaarRepo.create({
      personName: customerRow.name,
      personPhone: customerRow.phone,
      customerId: customerRow.id,
      direction: 'receivable',
      totalAmount: repairRow.remainingBalance,
      repairId: repairRow.id,
      notes: null
    })
    const linkDate = clampToNow(new Date(repairRow.updatedAt))
    backdate(udhaar, created.id, linkDate, linkDate)
    linkedUdhaarEntries.push({ id: created.id, totalAmount: repairRow.remainingBalance, createdAt: linkDate })
  })

  // E) Price edited after an advance payment was already recorded.
  const priceEditCandidate = generated.find((g) => g.status === 'completed' && !specialIds.has(g.id))!
  specialIds.add(priceEditCandidate.id)
  {
    const before = repairRepo.findById(priceEditCandidate.id)!
    if (before.advanceAmount === 0) {
      const advance = Math.round(before.repairPrice * 0.3)
      db.update(repairs).set({ advanceAmount: advance, remainingBalance: before.repairPrice - advance }).where(eq(repairs.id, before.id)).run()
    }
    const refreshed = repairRepo.findById(priceEditCandidate.id)!
    const earlyPaymentDate = someDateBetween(priceEditCandidate.createdAt, clampToNow(new Date(refreshed.updatedAt)))
    const payResult = recordPayment(db, {
      repairId: priceEditCandidate.id,
      amount: Math.round(refreshed.repairPrice * 0.15),
      type: 'advance',
      paymentDate: dateOnlyOf(earlyPaymentDate)
    })
    backdate(payments, payResult.payment.id, earlyPaymentDate, earlyPaymentDate)

    const afterPayment = repairRepo.findById(priceEditCandidate.id)!
    const revisedPrice = afterPayment.repairPrice + rand(800, 2500)
    const editDate = someDateBetween(earlyPaymentDate, clampToNow(new Date(afterPayment.updatedAt)))
    repairRepo.update(priceEditCandidate.id, { repairPrice: revisedPrice })
    backdate(repairs, priceEditCandidate.id, priceEditCandidate.createdAt, editDate)
  }

  // --- Phase 5: generic payments for everything else -------------------
  generated.forEach((g) => {
    if (specialIds.has(g.id)) return
    const repairRow = repairRepo.findById(g.id)!
    const upperBound = clampToNow(new Date(repairRow.updatedAt))

    if (g.status === 'delivered' && repairRow.remainingBalance > 0) {
      const remaining = repairRow.remainingBalance
      const numPayments = remaining > 3000 && Math.random() < 0.3 ? 2 : 1
      let left = remaining
      for (let p = 0; p < numPayments; p++) {
        const amt = p === numPayments - 1 ? left : Math.round(left * randFloat(0.4, 0.7))
        left -= amt
        const paymentDate = someDateBetween(g.createdAt, upperBound)
        const type: PaymentType = p === numPayments - 1 ? 'full' : 'partial'
        const result = recordPayment(db, { repairId: g.id, amount: amt, type, paymentDate: dateOnlyOf(paymentDate) })
        backdate(payments, result.payment.id, paymentDate, paymentDate)
      }
    } else if (g.status === 'completed' && repairRow.remainingBalance > 0 && Math.random() < 0.5) {
      const extra = Math.round(repairRow.remainingBalance * randFloat(0.2, 0.5))
      if (extra > 0) {
        const paymentDate = someDateBetween(g.createdAt, upperBound)
        const result = recordPayment(db, { repairId: g.id, amount: extra, type: 'partial', paymentDate: dateOnlyOf(paymentDate) })
        backdate(payments, result.payment.id, paymentDate, paymentDate)
      }
    }
  })

  // Explicit full payment for the tiny/large price outliers.
  ;[tinyPriceRepair, largePriceRepair].forEach((g) => {
    const repairRow = repairRepo.findById(g.id)!
    if (repairRow.remainingBalance > 0) {
      const paymentDate = someDateBetween(g.createdAt, clampToNow(new Date(repairRow.updatedAt)))
      const result = recordPayment(db, { repairId: g.id, amount: repairRow.remainingBalance, type: 'full', paymentDate: dateOnlyOf(paymentDate) })
      backdate(payments, result.payment.id, paymentDate, paymentDate)
    }
  })

  // --- Phase 6: Udhaar (3 repair-linked above + 7 standalone) ---------
  function createStandaloneUdhaar(personName: string, direction: UdhaarDirection, totalAmount: number, createdDaysAgo: number, dueDateStr: string | null) {
    const createdAt = clampToNow(daysAgoDate(createdDaysAgo))
    const created = udhaarRepo.create({
      personName,
      personPhone: direction === 'receivable' && Math.random() < 0.5 ? randomPhone() : null,
      direction,
      totalAmount,
      dueDate: dueDateStr,
      notes: null
    })
    backdate(udhaar, created.id, createdAt, createdAt)
    return created
  }
  function settle(udhaarId: string, amount: number, daysAfterCreatedOffset: number) {
    const settleDate = clampToNow(daysAgoDate(daysAfterCreatedOffset))
    const result = recordUdhaarSettlement(db, { udhaarId, amount, settlementDate: dateOnlyOf(settleDate) })
    backdate(udhaarSettlements, result.settlement.id, settleDate, settleDate)
  }

  // 1) repair-linked, fully settled
  if (linkedUdhaarEntries[0]) settle(linkedUdhaarEntries[0].id, linkedUdhaarEntries[0].totalAmount, rand(2, 8))
  // 2) repair-linked, overdue & unsettled
  if (linkedUdhaarEntries[1]) udhaarRepo.update(linkedUdhaarEntries[1].id, { dueDate: dateOnlyOf(daysAgoDate(rand(3, 10))) })
  // 3) repair-linked, partially settled
  if (linkedUdhaarEntries[2]) settle(linkedUdhaarEntries[2].id, Math.round(linkedUdhaarEntries[2].totalAmount * randFloat(0.3, 0.6)), rand(2, 6))

  // 4) receivable, standalone, upcoming due date
  createStandaloneUdhaar(pick(STANDALONE_NAMES_RECEIVABLE), 'receivable', 6000, 12, dateOnlyOf(daysAgoDate(-10)))
  // 5) receivable, standalone, overdue
  createStandaloneUdhaar(pick(STANDALONE_NAMES_RECEIVABLE), 'receivable', 4500, 20, dateOnlyOf(daysAgoDate(rand(3, 9))))
  // 6) receivable, standalone, fully settled
  {
    const e6 = createStandaloneUdhaar(pick(STANDALONE_NAMES_RECEIVABLE), 'receivable', 8000, 25, dateOnlyOf(daysAgoDate(15)))
    settle(e6.id, 8000, rand(5, 12))
  }
  // 7) payable, standalone, upcoming due date
  createStandaloneUdhaar(pick(STANDALONE_NAMES_PAYABLE), 'payable', 15000, 8, dateOnlyOf(daysAgoDate(-7)))
  // 8) payable, standalone, overdue
  createStandaloneUdhaar(pick(STANDALONE_NAMES_PAYABLE), 'payable', 12000, 18, dateOnlyOf(daysAgoDate(rand(2, 6))))
  // 9) payable, standalone, partially settled
  {
    const e9 = createStandaloneUdhaar(pick(STANDALONE_NAMES_PAYABLE), 'payable', 20000, 22, dateOnlyOf(daysAgoDate(-5)))
    settle(e9.id, 8000, rand(4, 10))
  }
  // 10) receivable, standalone, no due date (open-ended)
  createStandaloneUdhaar(pick(STANDALONE_NAMES_RECEIVABLE), 'receivable', 3000, 14, null)

  // --- Phase 7: Expenses -------------------------------------------------
  function createExpense(category: string, amount: number, description: string, expenseDate: Date, isRecurring = false, recurringMonth: string | null = null) {
    const created = expenseRepo.create({ category, amount, description, expenseDate: dateOnlyOf(expenseDate), isRecurring, recurringMonth })
    backdate(expenses, created.id, expenseDate, expenseDate)
  }

  const currentMonthStr = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}`
  const prevMonthDate = new Date(NOW.getFullYear(), NOW.getMonth() - 1, 1)
  const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`

  // Rent/electricity deliberately span this month AND last month (outside the
  // 30-day window for the prior month) so month-over-month comparisons in
  // Reports have something to compare against — per the brief, not a bug.
  createExpense('rent', 50000, 'Monthly shop rent', clampToNow(new Date(NOW.getFullYear(), NOW.getMonth(), 3)), true, currentMonthStr)
  createExpense('rent', 50000, 'Monthly shop rent', new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 3), true, prevMonthStr)
  createExpense('electricity', 21000, 'Electricity bill', clampToNow(new Date(NOW.getFullYear(), NOW.getMonth(), 8)), true, currentMonthStr)
  createExpense('electricity', 17500, 'Electricity bill', new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 8), true, prevMonthStr)

  for (let i = 0; i < 7; i++) {
    createExpense(
      'supplies',
      rand(1500, 8000),
      pick(['Spare parts restock', 'Screen protectors & tools', 'Batteries wholesale purchase', 'Charging cables & adapters', 'Small parts (connectors, flex cables)']),
      clampToNow(daysAgoDate(rand(1, 29)))
    )
  }
  for (let i = 0; i < 3; i++) {
    createExpense('maintenance', rand(1000, 5000), pick(['AC servicing', 'Soldering iron replacement', 'Shop furniture repair']), clampToNow(daysAgoDate(rand(1, 29))))
  }
  for (let i = 0; i < 2; i++) {
    createExpense('personal_withdrawal', rand(5000, 15000), 'Owner withdrawal', clampToNow(daysAgoDate(rand(1, 29))))
  }
  for (let i = 0; i < 4; i++) {
    createExpense('other', rand(300, 800), pick(['Tea and refreshments', 'Office/misc supplies', 'Cleaning supplies']), clampToNow(daysAgoDate(rand(1, 29))))
  }
  // Custom (non-default) category — edge case.
  createExpense('Marketing', 6000, 'New signboard printing', clampToNow(daysAgoDate(rand(5, 20))))
  // Deliberate large outlier.
  createExpense('maintenance', 85000, 'Emergency AC compressor replacement', clampToNow(daysAgoDate(rand(8, 18))))

  // --- Summary -----------------------------------------------------------
  const finalRepairs = repairRepo.findAll()
  const repairsByStatus: Record<string, number> = {}
  finalRepairs.forEach((r) => { repairsByStatus[r.status] = (repairsByStatus[r.status] ?? 0) + 1 })

  return {
    customers: customerRepo.findAll().length,
    repairsTotal: finalRepairs.length,
    repairsByStatus,
    payments: db.select().from(payments).where(eq(payments.isDeleted, false)).all().length,
    udhaar: udhaarRepo.findAll().length,
    udhaarSettlements: db.select().from(udhaarSettlements).where(eq(udhaarSettlements.isDeleted, false)).all().length,
    expenses: expenseRepo.findAll().length
  }
}

// ---------------------------------------------------------------------------
// Post-seed verification / report
// ---------------------------------------------------------------------------
function printFinalReport(db: AppDatabase, summary: ReturnType<typeof generateAll>): void {
  const today = dateOnlyOf(NOW)
  const repairRepo = new RepairRepository(db)
  const udhaarRepo = new UdhaarRepository(db)

  const dash = new DashboardRepository(db).getSummary()
  const overdueDeliveries = repairRepo.findOverdueUnresolved(today)
  const todaysDeliveries = repairRepo.findTodaysDeliveries(today)
  const udhaarOverdue = udhaarRepo.findOverdueUnresolved(today)
  const udhaarSummary = {
    totalReceivables: udhaarRepo.sumRemainingBalanceByDirection('receivable'),
    totalPayables: udhaarRepo.sumRemainingBalanceByDirection('payable')
  }
  const monthStart = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}-01`
  const report = new ReportRepository(db).generate({
    isoFrom: new Date(NOW.getFullYear(), NOW.getMonth(), 1).toISOString(),
    isoTo: NOW.toISOString(),
    dateOnlyFrom: monthStart,
    dateOnlyTo: today
  })
  const analytics = new AnalyticsRepository(db)
  const repeatStats = analytics.repeatCustomerRate()
  const volumeTrend = analytics.repairVolumeTrend('day')
  const topSpenders = analytics.topCustomersBySpend(5)

  console.log('\n' + '='.repeat(72))
  console.log('SEED COMPLETE')
  console.log('='.repeat(72))
  console.log(`Customers: ${summary.customers}`)
  console.log(`Repairs: ${summary.repairsTotal}  (by status: ${JSON.stringify(summary.repairsByStatus)})`)
  console.log(`Payments: ${summary.payments}`)
  console.log(`Udhaar entries: ${summary.udhaar}  (settlements: ${summary.udhaarSettlements})`)
  console.log(`Expenses: ${summary.expenses}`)

  console.log('\n--- Verification ---')
  console.log(`Overdue Delivery Reminder candidates: ${overdueDeliveries.length} ${overdueDeliveries.length > 0 ? '✅ will trigger' : '❌ WILL NOT TRIGGER'}`)
  console.log(`Today's Deliveries: ${todaysDeliveries.length}`)
  console.log(`Udhaar overdue reminder candidates: ${udhaarOverdue.length} ${udhaarOverdue.length > 0 ? '✅ will trigger' : '❌ WILL NOT TRIGGER'}`)
  console.log('Dashboard summary:', dash)
  console.log('Udhaar summary:', udhaarSummary)
  console.log('Reports (this month):', {
    totalRevenue: report.totalRevenue,
    totalRepairProfit: report.totalRepairProfit,
    totalExpenses: report.totalExpenses,
    netProfit: report.netProfit,
    statusCounts: report.statusCounts
  })
  console.log('Analytics repeatCustomerRate:', repeatStats)
  console.log('Analytics repairVolumeTrend (last 5 days):', volumeTrend.slice(-5))
  console.log('Analytics topCustomersBySpend:', topSpenders)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
// Electron only auto-derives the app name (and therefore the default
// userData folder) from package.json when loaded via `electron .`; invoked
// as a bare script file the way this launcher does, it defaults to the
// generic "Electron" folder instead. Setting this explicitly to match
// package.json's "name" reproduces exactly what the real app resolves to
// (main/index.ts never calls setName() either — it gets this for free by
// being loaded through electron-vite's packaged/dev entry), so this script
// writes to the same repairdesk.sqlite the real app uses.
app.setName('repairdex-pro')

app.whenReady().then(async () => {
  app.dock?.hide()
  const db = initDatabase()

  const confirmed = await runSafetyGate(db)
  if (!confirmed) {
    app.exit(1)
    return
  }

  const backupPath = safetyBackupCopy(getDatabasePath())
  if (backupPath) console.log(`\nSafety copy of the current database saved to: ${backupPath}`)

  console.log('\nGenerating QA data...')
  const summary = generateAll(db)

  new SettingsRepository(db).set('qaSeed.state', { appliedAt: new Date().toISOString(), summary })
  new ActivityLogRepository(db).create({
    actionType: 'qa_seed_generated',
    entityType: 'system',
    description: `QA seed data generated: ${summary.customers} customers, ${summary.repairsTotal} repairs, ${summary.payments} payments, ${summary.udhaar} udhaar entries, ${summary.expenses} expenses`,
    metadata: summary
  })

  printFinalReport(db, summary)
  app.exit(0)
}).catch((err) => {
  console.error('\n[qa-seed] FAILED:', err)
  app.exit(1)
})
