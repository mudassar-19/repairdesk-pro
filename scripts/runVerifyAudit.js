// Launcher for scripts/verifyAudit.ts — must run under electron (better-sqlite3
// native ABI), not plain node. See runVerifyFinancialFlows.js.
require('tsx/cjs')
require('./verifyAudit.ts')
