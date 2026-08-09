import assert from 'node:assert/strict'
import {
  verifyDeviceBinding,
  DeviceLockOfflineError,
  type DeviceBinding,
  type DeviceLockGateway,
  type DeviceLockIdentity
} from '../src/renderer/src/features/auth/lib/deviceLockDecision.ts'

const OWNER: DeviceLockIdentity = { uid: 'uid-A', email: 'a@shop.pk', deviceId: 'dev-1' }
const INTRUDER: DeviceLockIdentity = { uid: 'uid-B', email: 'b@shop.pk', deviceId: 'dev-1' }

/** Build a fake gateway. `firestore`: 'offline' throws, DeviceBinding|null = server state. */
function gateway(opts: {
  firestore: DeviceBinding | null | 'offline'
  cache?: DeviceBinding | null
}): DeviceLockGateway & { created: DeviceLockIdentity[] } {
  const created: DeviceLockIdentity[] = []
  return {
    created,
    async fetchBinding(): Promise<DeviceBinding | null> {
      if (opts.firestore === 'offline') throw new DeviceLockOfflineError()
      return opts.firestore
    },
    async createBinding(identity): Promise<void> {
      created.push(identity)
    },
    async readLocalCache(): Promise<DeviceBinding | null> {
      return opts.cache ?? null
    }
  }
}

let passed = 0
async function check(name: string, fn: () => Promise<void>): Promise<void> {
  await fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('Device-lock decision logic:')

// 1. Online, no binding yet -> first-bind this account, allow.
await check('online + no binding  -> first-bind + allow', async () => {
  const g = gateway({ firestore: null })
  const v = await verifyDeviceBinding(OWNER, g)
  assert.deepEqual(v, { status: 'allowed', source: 'firestore-new' })
  assert.equal(g.created.length, 1)
  assert.equal(g.created[0].uid, 'uid-A')
})

// 2. Online, binding matches -> allow (same device, same account).
await check('online + binding == uid  -> allow', async () => {
  const g = gateway({ firestore: { ownerUid: 'uid-A', ownerEmail: 'a@shop.pk' } })
  const v = await verifyDeviceBinding(OWNER, g)
  assert.deepEqual(v, { status: 'allowed', source: 'firestore-existing' })
  assert.equal(g.created.length, 0)
})

// 3. Online, binding mismatch -> LOCKED (same device, different account).
await check('online + binding != uid  -> locked', async () => {
  const g = gateway({ firestore: { ownerUid: 'uid-A', ownerEmail: 'a@shop.pk' } })
  const v = await verifyDeviceBinding(INTRUDER, g)
  assert.deepEqual(v, { status: 'locked', ownerEmail: 'a@shop.pk' })
  assert.equal(g.created.length, 0)
})

// 4. TAMPER (online): local file deleted, but Firestore still binds A. Intruder B
//    is STILL rejected — proves deleting device-owner.json can't bypass the lock.
await check('online TAMPER (no local cache) + Firestore==A, login B  -> locked', async () => {
  const g = gateway({ firestore: { ownerUid: 'uid-A', ownerEmail: 'a@shop.pk' }, cache: null })
  const v = await verifyDeviceBinding(INTRUDER, g)
  assert.deepEqual(v, { status: 'locked', ownerEmail: 'a@shop.pk' })
})

// 5. Offline + cache matches -> allow (already-verified device keeps working).
await check('offline + cache == uid  -> allow (offline-cache)', async () => {
  const g = gateway({ firestore: 'offline', cache: { ownerUid: 'uid-A', ownerEmail: 'a@shop.pk' } })
  const v = await verifyDeviceBinding(OWNER, g)
  assert.deepEqual(v, { status: 'allowed', source: 'offline-cache' })
  assert.equal(g.created.length, 0)
})

// 6. Offline + cache mismatch -> LOCKED.
await check('offline + cache != uid  -> locked', async () => {
  const g = gateway({ firestore: 'offline', cache: { ownerUid: 'uid-A', ownerEmail: 'a@shop.pk' } })
  const v = await verifyDeviceBinding(INTRUDER, g)
  assert.deepEqual(v, { status: 'locked', ownerEmail: 'a@shop.pk' })
})

// 7. TAMPER (offline): local file deleted AND no internet -> fail closed. The
//    intruder can't bind offline, so deleting the file is strictly worse for them.
await check('offline TAMPER (no cache) -> fail closed (offline-first-login)', async () => {
  const g = gateway({ firestore: 'offline', cache: null })
  const v = await verifyDeviceBinding(INTRUDER, g)
  assert.equal(v.status, 'error')
  assert.equal((v as { code: string }).code, 'offline-first-login')
  assert.equal(g.created.length, 0, 'must NOT create a binding offline')
})

// 8. Non-offline Firestore error -> surfaced as verification-failed (fail closed, no bind).
await check('firestore error (not offline) -> verification-failed', async () => {
  const g: DeviceLockGateway = {
    async fetchBinding() {
      throw new Error('permission-denied')
    },
    async createBinding() {
      throw new Error('should not be called')
    },
    async readLocalCache() {
      return null
    }
  }
  const v = await verifyDeviceBinding(OWNER, g)
  assert.equal(v.status, 'error')
  assert.equal((v as { code: string }).code, 'verification-failed')
})

console.log(`\n${passed}/8 device-lock decision assertions passed.`)
