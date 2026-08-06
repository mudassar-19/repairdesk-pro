import type { ComponentType, SVGProps } from 'react'
import { BilingualText } from './BilingualText'
import { InboxIcon } from './icons'
import { dictionary } from '@shared/i18n'
import type { BilingualString } from '@shared/i18n'

export interface EmptyStateProps {
  title?: BilingualString
  body?: BilingualString
  icon?: ComponentType<SVGProps<SVGSVGElement>>
}

/**
 * Shared empty-state component. Defaults to the generic Phase 1 placeholder
 * copy so every still-unbuilt module page keeps working unchanged; pass
 * title/body/icon to give a screen (e.g. an empty customer list) its own
 * specific copy instead.
 */
export function EmptyState({
  title = dictionary.common.emptyStateTitle,
  body = dictionary.common.emptyStateBody,
  icon: Icon = InboxIcon
}: EmptyStateProps = {}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-2xl text-center">
      <span className="mb-lg flex h-16 w-16 items-center justify-center rounded-full bg-primary/5 text-primary/40">
        <Icon width={30} height={30} />
      </span>
      <BilingualText text={title} size="lg" align="center" />
      <BilingualText text={body} size="sm" align="center" className="mt-sm max-w-md text-ink-muted" />
    </div>
  )
}
