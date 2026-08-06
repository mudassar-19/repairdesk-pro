import type { BilingualString } from '@shared/i18n'

export interface BilingualTextProps {
  /** A dictionary entry, e.g. dictionary.nav.customers */
  text: BilingualString
  /** Render as inline (default) or block flow container. */
  as?: 'span' | 'div'
  /** 'xs' is for dense contexts (compact action buttons, table cells) where the default size makes rows uneven. */
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl'
  /**
   * Horizontal alignment of the English/Urdu pair relative to each other.
   * 'start' (default) is correct for labels/headings that sit in a
   * left-aligned flow. 'center' is for content inside a centered flex
   * container (buttons, menu items) — without it, a shorter line doesn't
   * center under a longer one, it just sits flush left inside its own box,
   * which reads as misaligned/cramped. Left as an explicit opt-in (rather
   * than a default) so it never fights a caller's own alignment classes.
   */
  align?: 'start' | 'center'
  className?: string
  /** Hide the Urdu line (rare — headings inside a fixed-width icon rail, etc). */
  urduHidden?: boolean
}

const sizeClass: Record<Required<BilingualTextProps>['size'], string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl'
}

/**
 * Nastaliq script (unlike the Naskh style this used to use) needs to render
 * a touch larger than Latin text at the same nominal size to stay equally
 * readable — its strokes are thinner and more diagonal. Urdu therefore now
 * matches its English counterpart's own size step exactly, rather than
 * sitting one step below it. It still reads as the secondary line through
 * dimmed opacity and regular (non-medium) weight, not through being smaller.
 */
const urduSizeClass: Record<Required<BilingualTextProps>['size'], string> = sizeClass

/** A little more breathing room at heading sizes; dense sizes stay tight so compact buttons/rows don't grow taller than their neighbors. */
const gapClass: Record<Required<BilingualTextProps>['size'], string> = {
  xs: 'gap-0.5',
  sm: 'gap-0.5',
  base: 'gap-1',
  lg: 'gap-1.5',
  xl: 'gap-1.5'
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
  align = 'start',
  className = '',
  urduHidden = false
}: BilingualTextProps) {
  const Container = as
  const alignClass = align === 'center' ? 'items-center text-center' : ''

  return (
    <Container className={`flex flex-col ${gapClass[size]} ${alignClass} ${className}`}>
      {/*
        unicode-bidi: isolate scopes each span's bidi algorithm to itself —
        without it, adjacent RTL (Urdu) and LTR (English) runs across
        different BilingualText instances on the same page can bleed into
        each other during PDF generation (Chromium's print pipeline runs its
        own layout/shaping pass, distinct from the on-screen one), which
        showed up as several unrelated Urdu labels rendering jumbled together
        into one block instead of each staying paired with its own English
        line. Harmless on screen either way — isolate only matters when
        multiple bidi runs are adjacent.
      */}
      <span dir="ltr" lang="en" className={`${sizeClass[size]} font-medium leading-tight [unicode-bidi:isolate]`}>
        {text.en}
      </span>
      {!urduHidden && (
        <span
          dir="rtl"
          lang="ur"
          className={`${urduSizeClass[size]} font-urdu leading-normal opacity-70 [unicode-bidi:isolate]`}
        >
          {text.ur}
        </span>
      )}
    </Container>
  )
}
