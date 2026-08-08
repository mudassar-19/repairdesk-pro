// Launcher for scripts/verifyFinancialFlows.ts — see runSeedQaData.js for why
// this must run under electron (better-sqlite3's native ABI), not plain node.
require('tsx/cjs')
require('./verifyFinancialFlows.ts')
