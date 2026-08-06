import { AppProviders } from './providers/AppProviders'
import { AppRoutes } from './routes/AppRoutes'
import { useBrandColorBootstrap } from '@shared/hooks/useBrandColorBootstrap'

export function App() {
  useBrandColorBootstrap()

  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  )
}
