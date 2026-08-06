import { useEffect, useState } from 'react'
import type { ReceiptSettings } from '../../../../main/db/repositories/settingsRepository'

export function useReceiptSettings(): { receiptSettings: ReceiptSettings | null; refresh: () => void } {
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null)

  const refresh = () => {
    window.api.settings.getReceiptSettings().then(setReceiptSettings)
  }

  useEffect(() => {
    refresh()
  }, [])

  return { receiptSettings, refresh }
}
