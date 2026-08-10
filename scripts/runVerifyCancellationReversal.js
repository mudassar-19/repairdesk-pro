// Launcher for scripts/verifyCancellationReversal.ts — must run under electron
// (better-sqlite3's native ABI), not plain node. See runVerifyFinancialFlows.js.
require('tsx/cjs')
require('./verifyCancellationReversal.ts')
