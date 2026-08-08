import type { KeyboardEvent } from 'react'

/**
 * Keyboard-driven form flow (Part J#15): pressing Enter in a text/number/select
 * field moves focus to the next field instead of submitting, so non-technical
 * staff can fill a form end-to-end without the mouse (Tab already does this
 * natively; this makes Enter behave the same way, which is what most people
 * reach for). Textareas keep their normal Enter-for-newline behaviour.
 *
 * Attach to either a <form onKeyDown={…}> (Enter on the final field then
 * submits the form) or a plain container like a <div onKeyDown={…}> for
 * screens that aren't a <form> — e.g. POS Mode — where the final field simply
 * stops advancing (the user triggers the action button themselves).
 */
export function advanceOnEnter(event: KeyboardEvent<HTMLElement>): void {
  if (event.key !== 'Enter' || event.shiftKey) return

  const target = event.target as HTMLElement
  // Textareas (multi-line) and buttons keep their native Enter behaviour.
  if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return
  if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return

  event.preventDefault()
  const container = event.currentTarget
  const controls = Array.from(
    container.querySelectorAll<HTMLElement>('input, select, textarea')
  ).filter((el) => !(el as HTMLInputElement).disabled && el.tabIndex !== -1 && el.offsetParent !== null)

  const next = controls[controls.indexOf(target) + 1]
  if (next) next.focus()
  else if (container instanceof HTMLFormElement) container.requestSubmit()
}
