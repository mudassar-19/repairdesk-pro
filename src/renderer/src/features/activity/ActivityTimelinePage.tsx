import { useEffect, useRef, useState } from 'react'
import { BilingualText } from '@shared/components/BilingualText'
import { Card } from '@shared/components/Card'
import { PageHeader } from '@shared/components/PageHeader'
import { EmptyState } from '@shared/components/EmptyState'
import { ActivityFeedItem } from '@shared/components/ActivityFeedItem'
import { ActivityIcon } from '@shared/components/icons'
import { dictionary } from '@shared/i18n'
import { useActivityTimeline } from '@shared/hooks/useActivityTimeline'
import {
  activityEntityTypeValues,
  activityActionTypeValues,
  entityTypeDisplayLabel,
  actionTypeDisplayLabel
} from '@shared/lib/activityTypes'
import type { DateRangePreset } from '@shared/lib/dateRangePresets'

const selectClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

export function ActivityTimelinePage() {
  const [entityType, setEntityType] = useState<string>('all')
  const [actionType, setActionType] = useState<string>('all')
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [search, setSearch] = useState('')

  const { rows, initialLoading, loadingMore, hasMore, loadMore } = useActivityTimeline({
    entityType,
    actionType,
    datePreset,
    customFrom,
    customTo,
    search
  })

  const hasActiveFilters =
    entityType !== 'all' || actionType !== 'all' || datePreset !== 'all' || search.trim() !== ''

  // Infinite scroll — a sentinel below the last row triggers loadMore() once
  // it enters the viewport, re-observed whenever the callback identity or
  // scrollable content changes (hasMore/loadingMore gate re-entrancy).
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loadingMore, rows.length])

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title={dictionary.activity.title} />

      <Card padding="md" className="mb-lg flex flex-wrap items-end gap-md">
        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.activity.entityType} size="sm" className="text-ink-muted" />
          <select value={entityType} onChange={(event) => setEntityType(event.target.value)} className={selectClass}>
            <option value="all">{dictionary.activity.allEntityTypes.en}</option>
            {activityEntityTypeValues.map((value) => (
              <option key={value} value={value}>
                {entityTypeDisplayLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.activity.actionType} size="sm" className="text-ink-muted" />
          <select value={actionType} onChange={(event) => setActionType(event.target.value)} className={selectClass}>
            <option value="all">{dictionary.activity.allActionTypes.en}</option>
            {activityActionTypeValues.map((value) => (
              <option key={value} value={value}>
                {actionTypeDisplayLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.repairs.filterDateRange} size="sm" className="text-ink-muted" />
          <select
            value={datePreset}
            onChange={(event) => setDatePreset(event.target.value as DateRangePreset)}
            className={selectClass}
          >
            <option value="all">{dictionary.repairs.dateAll.en}</option>
            <option value="today">{dictionary.repairs.dateToday.en}</option>
            <option value="week">{dictionary.repairs.dateThisWeek.en}</option>
            <option value="month">{dictionary.repairs.dateThisMonth.en}</option>
            <option value="custom">{dictionary.repairs.dateCustom.en}</option>
          </select>
        </label>

        {datePreset === 'custom' && (
          <>
            <label className="flex flex-col gap-1">
              <BilingualText text={dictionary.repairs.dateFrom} size="sm" className="text-ink-muted" />
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className={selectClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <BilingualText text={dictionary.repairs.dateTo} size="sm" className="text-ink-muted" />
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className={selectClass}
              />
            </label>
          </>
        )}

        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={dictionary.activity.searchPlaceholder.en}
          className={`ml-auto min-w-[220px] ${selectClass}`}
        />
      </Card>

      <Card padding="none" className="flex-1 overflow-hidden">
        {initialLoading ? (
          <div className="p-lg">
            <BilingualText text={dictionary.common.loading} size="sm" className="text-ink-muted" />
          </div>
        ) : rows.length === 0 ? (
          hasActiveFilters ? (
            <div className="p-2xl text-center">
              <BilingualText text={dictionary.activity.noResults} size="sm" className="items-center text-ink-muted" />
            </div>
          ) : (
            <EmptyState title={dictionary.activity.title} icon={ActivityIcon} />
          )
        ) : (
          <div className="max-h-[calc(100vh-260px)] divide-y divide-border overflow-y-auto">
            {rows.map((entry) => (
              <ActivityFeedItem key={entry.id} entry={entry} />
            ))}
            <div ref={sentinelRef} className="p-md text-center">
              {loadingMore && (
                <BilingualText text={dictionary.activity.loadingMore} size="sm" className="items-center text-ink-muted" />
              )}
              {!hasMore && !loadingMore && (
                <p className="text-xs text-ink-muted opacity-70">{dictionary.activity.endOfHistory.en}</p>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
