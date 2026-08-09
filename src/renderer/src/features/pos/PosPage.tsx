import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { dictionary } from '@shared/i18n'
import type { BilingualString } from '@shared/i18n'
import { useBrandingSettings } from '@shared/hooks/useBrandingSettings'
import { PosNewOrder } from './PosNewOrder'
import { PosDeliverOrder } from './PosDeliverOrder'
import repairdexLogo from '../../assets/images/repairdesk-logo.png'

type PosTab = 'new' | 'deliver'

/**
 * POS Mode shell: an iPhone-style header "notch" carrying the shop's logo (its
 * own uploaded logo if set, else the default), a two-tab switcher, and the two
 * tabs — New Order (fast order creation) and Deliver Order (search existing
 * not-yet-delivered repairs and hand them over). Both tabs reuse existing
 * components/logic; the shell just hosts them.
 */
export function PosPage() {
  const navigate = useNavigate()
  const { logoDataUrl } = useBrandingSettings()
  const [tab, setTab] = useState<PosTab>('new')

  // Shop's own uploaded logo takes priority; fall back to the default RepairDex logo.
  const logoSrc = logoDataUrl ?? repairdexLogo

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg">
      <header className="flex flex-shrink-0 items-center justify-between gap-md border-b border-border bg-surface px-xl py-sm">
        <div className="flex-1">
          <BilingualText text={dictionary.pos.title} as="div" size="lg" className="items-start" />
        </div>

        {/* Centered logo — shop's own if set, else the default. */}
        <div className="flex flex-1 justify-center">
          <img
            data-testid="pos-logo"
            src={logoSrc}
            alt={dictionary.app.name.en}
            className="h-16 w-auto max-w-[260px] object-contain"
          />
        </div>

        <div className="flex flex-1 justify-end">
          <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
            <BilingualText text={dictionary.pos.switchToDashboard} size="xs" align="center" />
          </Button>
        </div>
      </header>

      {/* Tab switcher */}
      <div className="flex flex-shrink-0 gap-1 border-b border-border bg-surface px-xl">
        <TabButton active={tab === 'new'} label={dictionary.pos.tabNewOrder} onClick={() => setTab('new')} />
        <TabButton active={tab === 'deliver'} label={dictionary.pos.tabDeliverOrder} onClick={() => setTab('deliver')} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {tab === 'new' ? <PosNewOrder /> : <PosDeliverOrder />}
      </div>
    </div>
  )
}

function TabButton({ active, label, onClick }: { active: boolean; label: BilingualString; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-md py-sm transition-colors ${
        active ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink'
      }`}
    >
      <BilingualText text={label} size="sm" align="center" />
    </button>
  )
}
