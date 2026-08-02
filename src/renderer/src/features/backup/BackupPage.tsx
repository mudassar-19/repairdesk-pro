import { BilingualText } from '@shared/components/BilingualText'
import { EmptyState } from '@shared/components/EmptyState'
import { dictionary } from '@shared/i18n'

export function BackupPage() {
  return (
    <div className="flex flex-1 flex-col">
      <BilingualText text={dictionary.nav.backup} as="div" size="xl" className="mb-lg" />
      <EmptyState />
    </div>
  )
}
