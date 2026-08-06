import { useEffect, useState } from 'react'
import type { BrandingSettings } from '../../../../main/db/repositories/settingsRepository'

export interface BrandingState {
  branding: BrandingSettings | null
  logoDataUrl: string | null
  refresh: () => void
}

/**
 * Read access to shop branding — used by the Receipt (Phase 11) and Report
 * PDF (Phase 9) call sites that used to render PrintBrandingHeader with no
 * props at all. The Settings screen's branding section manages its own edit
 * state and calls window.api.settings.setBranding directly rather than
 * through this hook, since it also needs to trigger a live color-token
 * update (see shared/lib/brandColor.ts) alongside the save.
 */
export function useBrandingSettings(): BrandingState {
  const [branding, setBranding] = useState<BrandingSettings | null>(null)
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)

  const refresh = () => {
    window.api.settings.getBranding().then(setBranding)
    window.api.settings.getLogoDataUrl().then(setLogoDataUrl)
  }

  useEffect(() => {
    refresh()
  }, [])

  return { branding, logoDataUrl, refresh }
}
