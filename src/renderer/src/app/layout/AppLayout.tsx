import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useBrandColorBootstrap } from '@shared/hooks/useBrandColorBootstrap'
import { useCloudBackupScheduler } from '@shared/hooks/useCloudBackupScheduler'

export function AppLayout() {
  // Mounted once for the app's whole authenticated lifetime — persists
  // across navigation since AppLayout only remounts on logout/login, not on
  // route changes within it (see AppRoutes: this element wraps every
  // authenticated <Route> via Outlet).
  useBrandColorBootstrap()
  useCloudBackupScheduler(true)

  return (
    // app-shell marks the two full-height, overflow-hidden containers so the
    // print stylesheet can lift their clipping (otherwise a report taller than
    // one screen is cut off in the PDF even though `main` itself is unclipped —
    // its ancestors still constrain it to 100vh). See @media print in theme.css.
    <div className="app-shell flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="app-shell flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex flex-1 flex-col overflow-y-auto bg-bg p-xl">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
