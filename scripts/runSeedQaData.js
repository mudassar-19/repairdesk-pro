// Launcher for scripts/seedQaData.ts — registers tsx's require hook so the
// TypeScript seed script can be loaded directly, then hands off to it.
// better-sqlite3's native binding is compiled for Electron's Node ABI (see
// package.json's postinstall: electron-rebuild), not the system Node's — so
// this must run under `electron`, not plain `node`/`tsx`.
require('tsx/cjs')
require('./seedQaData.ts')
