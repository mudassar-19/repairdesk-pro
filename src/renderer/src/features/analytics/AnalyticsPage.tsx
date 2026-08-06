import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { Card } from '@shared/components/Card'
import { PageHeader } from '@shared/components/PageHeader'
import { dictionary } from '@shared/i18n'
import type { BilingualString } from '@shared/i18n'
import { getChartColors } from '@shared/lib/chartColors'
import type {
  TimeSeriesGranularity,
  TimeSeriesPoint,
  RepairVolumePoint,
  RepeatCustomerStats,
  TopCustomer
} from '../../../../main/db/repositories/analyticsRepository'

const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 13,
  padding: '8px 12px'
}

function formatBucketLabel(bucket: string, granularity: TimeSeriesGranularity): string {
  if (granularity === 'month') {
    const [year, month] = bucket.split('-')
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    })
  }
  return new Date(`${bucket}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function TrendChartCard({
  title,
  granularity,
  loading,
  children
}: {
  title: BilingualString
  granularity: TimeSeriesGranularity
  loading: boolean
  children: React.ReactNode
}) {
  return (
    <Card>
      <BilingualText text={title} as="div" size="lg" className="mb-md" />
      {loading ? (
        <div className="flex h-60 items-center justify-center">
          <BilingualText text={dictionary.common.loading} size="sm" className="items-center text-ink-muted" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          {children as React.ReactElement}
        </ResponsiveContainer>
      )}
      <span className="sr-only">{granularity}</span>
    </Card>
  )
}

export function AnalyticsPage() {
  const [granularity, setGranularity] = useState<TimeSeriesGranularity>('day')
  const [revenue, setRevenue] = useState<TimeSeriesPoint[] | null>(null)
  const [profit, setProfit] = useState<TimeSeriesPoint[] | null>(null)
  const [volume, setVolume] = useState<RepairVolumePoint[] | null>(null)
  const [newCustomers, setNewCustomers] = useState<TimeSeriesPoint[] | null>(null)
  const [repeatRate, setRepeatRate] = useState<RepeatCustomerStats | null>(null)
  const [topCustomers, setTopCustomers] = useState<TopCustomer[] | null>(null)
  const [brands, setBrands] = useState<{ brand: string; count: number }[] | null>(null)

  const colors = getChartColors()

  useEffect(() => {
    setRevenue(null)
    setProfit(null)
    setVolume(null)
    setNewCustomers(null)
    window.api.analytics.revenueTrend(granularity).then(setRevenue)
    window.api.analytics.profitTrend(granularity).then(setProfit)
    window.api.analytics.repairVolumeTrend(granularity).then(setVolume)
    window.api.analytics.newCustomersTrend(granularity).then(setNewCustomers)
  }, [granularity])

  useEffect(() => {
    window.api.analytics.repeatCustomerRate().then(setRepeatRate)
    window.api.analytics.topCustomersBySpend(5).then(setTopCustomers)
    window.api.analytics.brandBreakdown(8).then(setBrands)
  }, [])

  const tickFormatter = (bucket: string) => formatBucketLabel(bucket, granularity)
  // Tooltip's labelFormatter receives a ReactNode (Recharts' generic label type), not a plain string like XAxis's tickFormatter.
  const tooltipLabelFormatter = (label: React.ReactNode) => formatBucketLabel(String(label), granularity)
  const axisTick = { fontSize: 12, fill: colors.inkMuted }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={dictionary.nav.analytics}
        action={
          <div className="flex gap-sm">
            {(['day', 'month'] as const).map((value) => (
              <Button
                key={value}
                variant={granularity === value ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setGranularity(value)}
              >
                <BilingualText
                  text={value === 'day' ? dictionary.reports.daily : dictionary.reports.monthly}
                  size="xs"
                  align="center"
                />
              </Button>
            ))}
          </div>
        }
      />

      <div className="mb-lg grid grid-cols-1 gap-lg lg:grid-cols-2">
        <TrendChartCard title={dictionary.analytics.revenueTrend} granularity={granularity} loading={!revenue}>
          <LineChart data={revenue ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
            <XAxis
              dataKey="bucket"
              tickFormatter={tickFormatter}
              tick={axisTick}
              interval={granularity === 'day' ? 4 : 0}
            />
            <YAxis tick={axisTick} width={48} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={tooltipLabelFormatter} />
            <Line type="monotone" dataKey="value" name={dictionary.analytics.revenueTrend.en} stroke={colors.primary} strokeWidth={2} dot={false} />
          </LineChart>
        </TrendChartCard>

        <TrendChartCard title={dictionary.analytics.profitTrend} granularity={granularity} loading={!profit}>
          <LineChart data={profit ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
            <XAxis
              dataKey="bucket"
              tickFormatter={tickFormatter}
              tick={axisTick}
              interval={granularity === 'day' ? 4 : 0}
            />
            <YAxis tick={axisTick} width={48} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={tooltipLabelFormatter} />
            <Line type="monotone" dataKey="value" name={dictionary.analytics.profitTrend.en} stroke={colors.success} strokeWidth={2} dot={false} />
          </LineChart>
        </TrendChartCard>
      </div>

      <div className="mb-lg grid grid-cols-1 gap-lg lg:grid-cols-2">
        <TrendChartCard title={dictionary.analytics.repairVolume} granularity={granularity} loading={!volume}>
          <BarChart data={volume ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
            <XAxis
              dataKey="bucket"
              tickFormatter={tickFormatter}
              tick={axisTick}
              interval={granularity === 'day' ? 4 : 0}
            />
            <YAxis tick={axisTick} width={40} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={tooltipLabelFormatter} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="created" name={dictionary.analytics.created.en} fill={colors.primary} radius={[3, 3, 0, 0]} />
            <Bar dataKey="completed" name={dictionary.repairs.statusCompleted.en} fill={colors.success} radius={[3, 3, 0, 0]} />
          </BarChart>
        </TrendChartCard>

        <TrendChartCard title={dictionary.analytics.newCustomers} granularity={granularity} loading={!newCustomers}>
          <BarChart data={newCustomers ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
            <XAxis
              dataKey="bucket"
              tickFormatter={tickFormatter}
              tick={axisTick}
              interval={granularity === 'day' ? 4 : 0}
            />
            <YAxis tick={axisTick} width={40} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={tooltipLabelFormatter} />
            <Bar dataKey="value" name={dictionary.analytics.newCustomers.en} fill={colors.primaryLight} radius={[3, 3, 0, 0]} />
          </BarChart>
        </TrendChartCard>
      </div>

      <div className="mb-lg grid grid-cols-1 gap-lg lg:grid-cols-3">
        <Card>
          <BilingualText text={dictionary.analytics.repeatCustomerRate} as="div" size="sm" className="text-ink-muted" />
          <p className="mt-1 text-3xl font-medium text-primary">
            {repeatRate ? `${repeatRate.ratePercent.toFixed(0)}%` : '—'}
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            {repeatRate ? `${repeatRate.repeatCustomers} of ${repeatRate.customersWithRepairs} ` : ''}
            {dictionary.analytics.repeatCustomerRateBody.en}
          </p>
        </Card>

        <Card className="lg:col-span-2">
          <BilingualText text={dictionary.analytics.topCustomers} as="div" size="lg" className="mb-md" />
          {!topCustomers ? (
            <BilingualText text={dictionary.common.loading} size="sm" className="text-ink-muted" />
          ) : topCustomers.length === 0 ? (
            <BilingualText text={dictionary.analytics.noDataYet} size="sm" className="text-ink-muted" />
          ) : (
            <div className="flex flex-col gap-sm">
              {topCustomers.map((customer, index) => (
                <div key={customer.customerId} className="flex items-center justify-between">
                  <div className="flex items-center gap-sm">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {index + 1}
                    </span>
                    <span className="text-sm text-ink">{customer.customerName}</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-ink">{customer.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <BilingualText text={dictionary.analytics.brandBreakdown} as="div" size="lg" className="mb-md" />
        {!brands ? (
          <BilingualText text={dictionary.common.loading} size="sm" className="text-ink-muted" />
        ) : brands.length === 0 ? (
          <BilingualText text={dictionary.analytics.noDataYet} size="sm" className="text-ink-muted" />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, brands.length * 40)}>
            <BarChart data={brands} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} horizontal={false} />
              <XAxis type="number" tick={axisTick} allowDecimals={false} />
              <YAxis type="category" dataKey="brand" tick={axisTick} width={100} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name={dictionary.reports.repairCount.en} fill={colors.primary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  )
}
