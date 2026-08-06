import { useEffect } from 'react'
import { applyBrandColor } from '@shared/lib/brandColor'

/**
 * Applies the persisted brand color once when the app first mounts — covers
 * the whole app lifetime (including the login screen) since local settings
 * aren't gated behind Firebase auth state. The Settings screen calls
 * applyBrandColor directly again for live preview when the user changes it.
 */
export function useBrandColorBootstrap(): void {
  useEffect(() => {
    window.api.settings
      .getBranding()
      .then((branding) => {
        applyBrandColor(branding.primaryColor)
      })
      .catch(() => {
        // Best-effort — a missing/unreadable branding setting just leaves
        // the default color in place.
      })
  }, [])
}
