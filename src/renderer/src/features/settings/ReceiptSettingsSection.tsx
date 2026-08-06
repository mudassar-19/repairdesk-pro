import { useEffect, useState } from 'react'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { Card } from '@shared/components/Card'
import { dictionary } from '@shared/i18n'
import { useReceiptSettings } from '@shared/hooks/useReceiptSettings'

const inputClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

/** Custom header/footer text ReceiptModal (Phase 11) now reads instead of the hardcoded placeholder — plain user-typed text, not run through the bilingual dictionary (see settingsRepository.ts's receiptSettingsSchema comment). */
export function ReceiptSettingsSection() {
  const { receiptSettings, refresh } = useReceiptSettings()
  const [headerText, setHeaderText] = useState('')
  const [footerText, setFooterText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!receiptSettings) return
    setHeaderText(receiptSettings.headerText)
    setFooterText(receiptSettings.footerText)
  }, [receiptSettings])

  const handleSave = async () => {
    setSaving(true)
    await window.api.settings.setReceiptSettings({ headerText, footerText })
    setSaving(false)
    setSaved(true)
    refresh()
  }

  if (!receiptSettings) return null

  return (
    <Card>
      <BilingualText text={dictionary.receiptSettings.title} as="div" size="lg" className="mb-md" />

      <div className="mb-lg flex flex-col gap-md">
        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.receiptSettings.headerText} size="sm" className="text-ink-muted" />
          <input
            type="text"
            value={headerText}
            onChange={(event) => {
              setHeaderText(event.target.value)
              setSaved(false)
            }}
            className={inputClass}
          />
          <p className="text-xs text-ink-muted opacity-70">{dictionary.receiptSettings.headerTextHint.en}</p>
        </label>

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.receiptSettings.footerText} size="sm" className="text-ink-muted" />
          <input
            type="text"
            value={footerText}
            onChange={(event) => {
              setFooterText(event.target.value)
              setSaved(false)
            }}
            className={inputClass}
          />
          <p className="text-xs text-ink-muted opacity-70">{dictionary.receiptSettings.footerTextHint.en}</p>
        </label>
      </div>

      <div className="flex items-center gap-md">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          <BilingualText text={dictionary.branding.save} size="xs" align="center" />
        </Button>
        {saved && <span className="text-sm text-success">{dictionary.branding.saved.en}</span>}
      </div>
    </Card>
  )
}
