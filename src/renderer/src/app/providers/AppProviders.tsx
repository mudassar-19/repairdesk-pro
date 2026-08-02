import type { ReactNode } from 'react'
import { HashRouter } from 'react-router-dom'

/**
 * HashRouter, not BrowserRouter — the packaged app loads index.html via
 * file://, which has no server to resolve history-API paths on refresh.
 * Future cross-cutting providers (auth session, query cache) slot in here
 * without touching call sites.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return <HashRouter>{children}</HashRouter>
}
