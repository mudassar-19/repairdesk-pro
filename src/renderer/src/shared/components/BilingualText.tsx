import type { BilingualString } from '@shared/i18n'

export interface BilingualTextProps {
  /** A dictionary entry, e.g. dictionary.nav.customers */
  text: BilingualString
  /** Render as inline (default) or block flow container. */
  as?: 'span' | 'div'
  size?: 'sm' | 'base' | 'lg' | 'xl'
  className?: string
  /** Hide the Urdu line (rare — headings inside a fixed-width icon rail, etc). */
  urduHidden?: boolean
}

const sizeClass: Record<Required<BilingualTextProps>['size'], string> = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl'
}

/** Urdu always renders one step below its English counterpart, so it reads as a secondary line. */
const urduSizeClass: Record<Required<BilingualTextProps>['size'], string> = {
  sm: 'text-xs',
  base: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg'
}

/**
 * Always renders English above Urdu below — there is no language toggle in
 * this app. Only the Urdu line is flipped to RTL; the English line and the
 * container stay LTR so bilingual rows stack predictably in any layout.
 *
 * Neither line sets its own text color — both inherit `currentColor` from
 * the container, only dimmed via opacity for the Urdu line. That lets the
 * same component sit correctly on a light card (inherits --color-ink from
 * body) or an active/colored surface like the selected sidebar item
 * (inherits text-primary-ink from its NavLink wrapper) without a prop.
 */
export function BilingualText({
  text,
  as = 'span',
  size = 'base',
  className = '',
  urduHidden = false
}: BilingualTextProps) {
  const Container = as

  return (
    <Container className={`flex flex-col gap-0.5 ${className}`}>
      <span dir="ltr" lang="en" className={`${sizeClass[size]} font-medium leading-tight`}>
        {text.en}
      </span>
      {!urduHidden && (
        <span dir="rtl" lang="ur" className={`${urduSizeClass[size]} font-urdu leading-snug opacity-70`}>
          {text.ur}
        </span>
      )}
    </Container>
  )
}
