import { useEffect, useState } from 'react'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { Card } from '@shared/components/Card'
import { dictionary } from '@shared/i18n'
import { applyBrandColor } from '@shared/lib/brandColor'
import { useBrandingSettings } from '@shared/hooks/useBrandingSettings'

const inputClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

interface BrandingForm {
  shopName: string
  currency: string
  address: string
  phone: string
  email: string
}

/**
 * Shop Name/Logo/Brand Color/Currency/Address/Phone/Email (Phase 15). Feeds
 * directly into PrintBrandingHeader, consumed by ReceiptModal and
 * ReportsPage — those two screens re-fetch via their own useBrandingSettings
 * call, so a save here is reflected there the next time either renders.
 */
export function BrandingSection() {
  const { branding, logoDataUrl, refresh } = useBrandingSettings()
  const [form, setForm] = useState<BrandingForm>({ shopName: '', currency: '', address: '', phone: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    if (!branding) return
    setForm({
      shopName: branding.shopName,
      currency: branding.currency,
      address: branding.address,
      phone: branding.phone,
      email: branding.email
    })
  }, [branding])

  const updateField = (field: keyof BrandingForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await window.api.settings.setBranding(form)
    setSaving(false)
    setSaved(true)
    refresh()
  }

  // Color pickers are conventionally instant, not part of a save/submit flow
  // — apply the CSS tokens live immediately, then persist right away too.
  const handleColorChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const hex = event.target.value
    applyBrandColor(hex)
    await window.api.settings.setBranding({ primaryColor: hex })
    refresh()
  }

  const handlePickLogo = async () => {
    setUploadingLogo(true)
    await window.api.settings.pickLogo()
    setUploadingLogo(false)
    refresh()
  }

  const handleRemoveLogo = async () => {
    await window.api.settings.removeLogo()
    refresh()
  }

  if (!branding) return null

  return (
    <Card>
      <BilingualText text={dictionary.branding.title} as="div" size="lg" className="mb-md" />

      <div className="mb-lg flex flex-wrap items-center gap-md">
        <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {logoDataUrl ? (
            <img src={logoDataUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            (form.shopName || 'RD').slice(0, 2).toUpperCase()
          )}
        </span>
        <div className="flex gap-sm">
          <Button variant="secondary" size="sm" onClick={handlePickLogo} disabled={uploadingLogo}>
            <BilingualText text={dictionary.branding.uploadLogo} size="xs" align="center" />
          </Button>
          {logoDataUrl && (
            <Button variant="danger-ghost" size="sm" onClick={handleRemoveLogo}>
              <BilingualText text={dictionary.branding.removeLogo} size="xs" align="center" />
            </Button>
          )}
        </div>

        <label className="ml-auto flex flex-col items-center gap-1">
          <BilingualText text={dictionary.branding.primaryColor} size="sm" className="text-ink-muted" />
          <input
            type="color"
            value={branding.primaryColor}
            onChange={handleColorChange}
            className="h-10 w-16 cursor-pointer rounded-md border border-border"
          />
        </label>
      </div>

      <div className="mb-lg grid grid-cols-1 gap-md sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.branding.shopName} size="sm" className="text-ink-muted" />
          <input type="text" value={form.shopName} onChange={updateField('shopName')} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.branding.currency} size="sm" className="text-ink-muted" />
          <input type="text" value={form.currency} onChange={updateField('currency')} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <BilingualText text={dictionary.branding.address} size="sm" className="text-ink-muted" />
          <input type="text" value={form.address} onChange={updateField('address')} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.branding.phone} size="sm" className="text-ink-muted" />
          <input type="text" value={form.phone} onChange={updateField('phone')} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.branding.email} size="sm" className="text-ink-muted" />
          <input type="email" value={form.email} onChange={updateField('email')} className={inputClass} />
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
