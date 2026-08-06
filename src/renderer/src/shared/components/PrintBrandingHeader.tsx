import { BilingualText } from './BilingualText'
import { dictionary } from '@shared/i18n'

export interface PrintBrandingHeaderProps {
  /** Real shop name from Settings (Phase 15). Placeholder shown when omitted. */
  shopName?: string
  logoUrl?: string | null
  phone?: string
  address?: string
  /** Smaller logo/text sizing for the narrow ~80mm receipt — the Report PDF (a full A4 page) keeps the larger default. */
  compact?: boolean
}

/**
 * Shop branding for printed output — shared by the Report PDF/print (Phase 9)
 * and Receipt (Phase 11) call sites, both of which now pass real data from
 * Settings (Phase 15) via useBrandingSettings rather than rendering with no
 * props. Phone/address are the two fields realistically printed on a shop
 * receipt; email is shown in Settings but not here (a receipt read at the
 * counter has no use for it).
 */
export function PrintBrandingHeader({ shopName, logoUrl, phone, address, compact = false }: PrintBrandingHeaderProps) {
  return (
    <div className={`flex items-center gap-sm border-b border-border ${compact ? 'mb-sm pb-sm' : 'mb-lg gap-md pb-lg'}`}>
      <span
        className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary ${
          compact ? 'h-9 w-9 text-sm' : 'h-14 w-14 text-lg'
        }`}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          (shopName ?? 'RD').slice(0, 2).toUpperCase()
        )}
      </span>
      <div>
        {shopName ? (
          <p className={`font-medium leading-tight text-ink ${compact ? 'text-base' : 'text-xl'}`}>{shopName}</p>
        ) : (
          <BilingualText text={dictionary.reports.shopNamePlaceholder} as="div" size={compact ? 'base' : 'xl'} />
        )}
        {(phone || address) && (
          <p className={`mt-0.5 text-ink-muted ${compact ? 'text-xs' : 'text-sm'}`}>
            {[phone, address].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </div>
  )
}
