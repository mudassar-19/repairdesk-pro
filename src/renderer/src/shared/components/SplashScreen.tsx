import { BilingualText } from './BilingualText'
import { dictionary } from '@shared/i18n'

/** Shown only while the local encrypted session is being checked on startup — should resolve in well under a second. */
export function SplashScreen() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-lg bg-bg">
      <BilingualText text={dictionary.app.name} as="div" size="xl" className="items-center" />
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
    </div>
  )
}
