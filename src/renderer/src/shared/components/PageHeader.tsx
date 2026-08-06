import type { ReactNode } from 'react'
import { BilingualText } from './BilingualText'
import type { BilingualString } from '@shared/i18n'

/** The title + primary-action row at the top of every list/index screen — one place so every page's title weight and action placement stays identical. */
export function PageHeader({ title, action }: { title: BilingualString; action?: ReactNode }) {
  return (
    <div className="mb-xl flex flex-wrap items-center justify-between gap-md">
      <BilingualText text={title} as="div" size="xl" />
      {action}
    </div>
  )
}
