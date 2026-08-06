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
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex flex-1 flex-col overflow-y-auto bg-bg p-xl">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
