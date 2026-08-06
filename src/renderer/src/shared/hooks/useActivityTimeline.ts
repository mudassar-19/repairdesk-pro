import { useEffect, useRef, useState } from 'react'
import { getDateRangeBounds, type DateRangePreset } from '@shared/lib/dateRangePresets'
import type { ActivityLogRow } from '../../../../main/db/repositories/activityLogRepository'

const PAGE_SIZE = 30

export interface ActivityTimelineFilters {
  entityType: string | 'all'
  actionType: string | 'all'
  datePreset: DateRangePreset
  customFrom?: string
  customTo?: string
  search: string
}

/**
 * Cursor-paginated activity feed. Filter changes (including debounced search
 * text) reset to a fresh first page; loadMore() appends using the id-based
 * cursor from ActivityLogRepository.findPage — see that method's comment for
 * why id (not an offset) is the right cursor for a table this keeps growing
 * into and other parts of the app keep writing to concurrently.
 */
export function useActivityTimeline(filters: ActivityTimelineFilters) {
  const [rows, setRows] = useState<ActivityLogRow[]>([])
  const [cursor, setCursor] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const requestId = useRef(0)

  const buildFilters = (cursorParam?: number) => {
    const { dateFrom, dateTo } = getDateRangeBounds(filters.datePreset, {
      from: filters.customFrom,
      to: filters.customTo
    })
    return {
      entityType: filters.entityType === 'all' ? undefined : filters.entityType,
      actionType: filters.actionType === 'all' ? undefined : filters.actionType,
      search: filters.search.trim() || undefined,
      dateFrom,
      dateTo,
      cursor: cursorParam,
      pageSize: PAGE_SIZE
    }
  }

  useEffect(() => {
    const thisRequest = ++requestId.current
    setInitialLoading(true)
    const timer = setTimeout(() => {
      window.api.activity.findPage(buildFilters()).then((result) => {
        if (requestId.current !== thisRequest) return
        setRows(result.rows)
        setCursor(result.nextCursor)
        setHasMore(result.nextCursor !== null)
        setInitialLoading(false)
      })
    }, 150)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.entityType, filters.actionType, filters.datePreset, filters.customFrom, filters.customTo, filters.search])

  const loadMore = () => {
    if (loadingMore || !hasMore || cursor === null) return
    setLoadingMore(true)
    const thisRequest = requestId.current
    window.api.activity.findPage(buildFilters(cursor)).then((result) => {
      if (requestId.current !== thisRequest) return
      setRows((current) => [...current, ...result.rows])
      setCursor(result.nextCursor)
      setHasMore(result.nextCursor !== null)
      setLoadingMore(false)
    })
  }

  return { rows, initialLoading, loadingMore, hasMore, loadMore }
}
