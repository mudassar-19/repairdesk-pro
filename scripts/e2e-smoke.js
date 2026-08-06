const { _electron: electron } = require('playwright')
const path = require('node:path')

const SHOTS = '/private/tmp/claude-501/-Users-mudassarnaeem-RepairDesk/55e37bc0-3c0a-461c-8287-82f669c58fbe/scratchpad/shots'

async function main() {
  const app = await electron.launch({ args: ['.'], cwd: '/Users/mudassarnaeem/RepairDesk' })
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  await win.waitForTimeout(2000)
  const title = await win.title()
  const url = win.url()
  console.log('Window title:', title)
  console.log('Window url:', url)
  const bodyText = await win.evaluate(() => document.body.innerText.slice(0, 500))
  console.log('Body text sample:', bodyText)
  await win.screenshot({ path: path.join(SHOTS, '00-initial.png') })
  console.log('Screenshot saved.')
  await app.close()
}
main().catch((err) => { console.error('FAILED', err); process.exit(1) })
