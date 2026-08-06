const { _electron: electron } = require('playwright')

async function main() {
  const app = await electron.launch({ args: ['.'], cwd: '/Users/mudassarnaeem/RepairDesk' })
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  await win.waitForTimeout(1500)

  const deviceId = await win.evaluate(() => window.api.auth.getDeviceId())
  console.log('deviceId:', deviceId)

  await win.evaluate(async (deviceId) => {
    await window.api.auth.saveLocalSession({
      uid: 'qa-e2e-test-uid',
      email: 'qa-e2e-test@repairdesk.local',
      deviceId,
      refreshToken: 'qa-e2e-test-refresh-token-not-real',
      issuedAt: new Date().toISOString()
    })
  }, deviceId)
  console.log('Test session saved.')

  const verify = await win.evaluate(() => window.api.auth.getLocalSession())
  console.log('Verify read-back (same process):', JSON.stringify(verify))

  await app.close()
}
main().catch((err) => { console.error('FAILED', err.message); process.exit(1) })
