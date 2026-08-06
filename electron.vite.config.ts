import { resolve } from 'path'
import { cpSync, existsSync } from 'node:fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

/**
 * drizzle-kit's migration .sql files aren't JS/TS, so Rollup never bundles
 * them into out/main/index.js on its own. Copy them alongside it after every
 * build (dev and packaged) so db/client.ts's runtime path resolution
 * (path.join(__dirname, 'db/migrations')) finds them either way.
 */
function copyMigrationsPlugin(): Plugin {
  return {
    name: 'copy-migrations',
    closeBundle() {
      const src = resolve('src/main/db/migrations')
      if (existsSync(src)) cpSync(src, resolve('out/main/db/migrations'), { recursive: true })
    }
  }
}

/**
 * build/icon.png is electron-builder's source for the packaged app's
 * icon (auto-converted to .icns/.ico at package time) — it isn't otherwise
 * part of the source tree Rollup bundles. Copying it next to out/main/index.js
 * makes the same file available at runtime too, for BrowserWindow's own
 * `icon` option (the window/taskbar icon while the app is actually running,
 * in both dev and packaged builds — a separate concern from the packaged
 * app's installer/dock icon).
 */
function copyIconPlugin(): Plugin {
  return {
    name: 'copy-icon',
    closeBundle() {
      const src = resolve('build/icon.png')
      if (existsSync(src)) cpSync(src, resolve('out/main/icon.png'))
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyMigrationsPlugin(), copyIconPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@preload': resolve('src/preload')
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@app': resolve('src/renderer/src/app'),
        '@features': resolve('src/renderer/src/features'),
        '@shared': resolve('src/renderer/src/shared')
      }
    },
    plugins: [react()]
  }
})
