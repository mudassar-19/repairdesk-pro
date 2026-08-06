const { _electron: electron } = require('playwright')

async function main() {
  const app = await electron.launch({ args: ['.'], cwd: '/Users/mudassarnaeem/RepairDesk' })
  console.log('launched, pid:', app.process().pid)
  app.process().stdout.on('data', (d) => console.log('[main stdout]', d.toString()))
  app.process().stderr.on('data', (d) => console.log('[main stderr]', d.toString()))

  const win = await app.firstWindow()
  console.log('got first window')
  await win.waitForTimeout(3000)
  console.log('process still alive?', !app.process().killed)

  try {
    const userData = await app.evaluate(({ app }) => app.getPath('userData'))
    console.log('userData:', userData)
  } catch (e) {
    console.log('evaluate failed:', e.message)
  }

  await app.close()
}
main().catch((err) => { console.error('FAILED', err); process.exit(1) })
