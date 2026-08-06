const { _electron: electron } = require('playwright')
const path = require('node:path')
const fs = require('node:fs')

async function main() {
  const app = await electron.launch({ args: ['.'], cwd: '/Users/mudassarnaeem/RepairDesk' })

  const userData = await app.evaluate(({ app }) => app.getPath('userData'))
  console.log('userData:', userData)

  const sessionPath = path.join(userData, 'session.enc')
  const exists = fs.existsSync(sessionPath)
  console.log('session.enc exists at that path:', exists)

  if (exists) {
    const buf = fs.readFileSync(sessionPath)
    const base64 = buf.toString('base64')
    const result = await app.evaluate(({ safeStorage }, b64) => {
      const buffer = Buffer.from(b64, 'base64')
      const encAvailable = safeStorage.isEncryptionAvailable()
      if (!encAvailable) return { encAvailable, decrypted: null, error: 'encryption not available' }
      try {
        const decrypted = safeStorage.decryptString(buffer)
        return { encAvailable, decrypted, error: null }
      } catch (e) {
        return { encAvailable, decrypted: null, error: e.message }
      }
    }, base64)
    console.log('Decryption result:', JSON.stringify(result, null, 2))
  }

  await app.close()
}
main().catch((err) => { console.error('FAILED', err); process.exit(1) })
