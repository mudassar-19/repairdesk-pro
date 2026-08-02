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

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyMigrationsPlugin()],
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
