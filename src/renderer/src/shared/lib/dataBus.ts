import { useEffect, useRef } from 'react'
import type { DataEntity } from '../../../../preload'

export type { DataEntity }

/**
 * Real-time refresh (Part E). Every business write publishes the set of data
 * entities it changed (see the preload's `mutate` wrapper + `onDataChanged`);
 * a screen calls this hook with the entities it renders and a refetch, so it
 * updates the instant related data changes anywhere in the app — no manual
 * refresh, navigation, or window refocus. Fully local: the events ride the
 * existing contextBridge, introducing no network dependency, consistent with
 * the offline-first architecture.
 *
 * The callback is held in a ref so passing a fresh closure each render never
 * re-subscribes; the subscription is keyed only on the entity set.
 */
export function useDataSubscription(entities: DataEntity[], onChange: () => void): void {
  const callbackRef = useRef(onChange)
  callbackRef.current = onChange
  const key = entities.join(',')

  useEffect(() => {
    const watched = new Set(key.split(',') as DataEntity[])
    return window.api.onDataChanged((changed) => {
      if (changed.some((entity) => watched.has(entity))) callbackRef.current()
    })
  }, [key])
}
