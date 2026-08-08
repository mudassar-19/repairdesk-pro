import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { Card } from '@shared/components/Card'
import { EmptyState } from '@shared/components/EmptyState'
import { PageHeader } from '@shared/components/PageHeader'
import { ExpensesIcon } from '@shared/components/icons'
import { dictionary } from '@shared/i18n'
import { useExpenseSearch } from '@shared/hooks/useExpenseSearch'
import { expenseCategoryValues, expenseCategoryLabel, categoryLabel } from '@shared/lib/expenseCategory'
import type { DateRangePreset } from '@shared/lib/dateRangePresets'

const selectClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

export function ExpensesPage() {
  const navigate = useNavigate()
  const [category, setCategory] = useState<string>('all')
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const { results, loading } = useExpenseSearch({ category, datePreset, customFrom, customTo })
  const hasActiveFilters = category !== 'all' || datePreset !== 'all'
  const total = results.reduce((sum, expense) => sum + expense.amount, 0)

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={dictionary.nav.expenses}
        action={
          <Button variant="primary" onClick={() => navigate('/expenses/new')}>
            <BilingualText text={dictionary.expenses.addNew} size="sm" align="center" />
          </Button>
        }
      />

      <Card padding="md" className="mb-lg flex flex-wrap items-end gap-md">
        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.expenses.category} size="sm" className="text-ink-muted" />
          <select value={category} onChange={(event) => setCategory(event.target.value)} className={selectClass}>
            <option value="all">
              {dictionary.expenses.allCategories.en} — {dictionary.expenses.allCategories.ur}
            </option>
            {expenseCategoryValues.map((value) => (
              <option key={value} value={value}>
                {expenseCategoryLabel[value].en} — {expenseCategoryLabel[value].ur}
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

        <div className="ml-auto flex flex-col items-end gap-1">
          <BilingualText text={dictionary.expenses.runningTotal} size="sm" className="text-ink-muted" />
          <p className="text-xl font-medium tabular-nums text-primary">{total.toFixed(2)}</p>
        </div>
      </Card>

      {results.length === 0 && !loading ? (
        hasActiveFilters ? (
          <div className="flex flex-1 items-center justify-center">
            <BilingualText text={dictionary.expenses.noMatches} size="sm" className="items-center text-ink-muted" />
          </div>
        ) : (
          <EmptyState
            title={dictionary.expenses.emptyTitle}
            body={dictionary.expenses.emptyBody}
            icon={ExpensesIcon}
          />
        )
      ) : (
        <Card padding="none" className="max-h-[32rem] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 border-b border-border bg-surface-raised">
              <tr>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.expenses.category} size="sm" className="text-ink-muted" />
                </th>
                <th className="px-lg py-sm text-right">
                  <BilingualText text={dictionary.expenses.amount} size="sm" className="items-end text-ink-muted" />
                </th>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.expenses.expenseDate} size="sm" className="text-ink-muted" />
                </th>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.expenses.description} size="sm" className="text-ink-muted" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {results.map((expense) => (
                <tr key={expense.id}>
                  <td className="px-lg py-md text-sm font-medium text-ink">{categoryLabel(expense.category)}</td>
                  <td className="px-lg py-md text-right text-sm tabular-nums text-ink">
                    {expense.amount.toFixed(2)}
                  </td>
                  <td className="px-lg py-md text-sm text-ink-muted">{expense.expenseDate}</td>
                  <td className="px-lg py-md text-sm text-ink-muted">{expense.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
