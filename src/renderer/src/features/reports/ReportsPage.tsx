import { useEffect, useState } from 'react'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { Card } from '@shared/components/Card'
import { PageHeader } from '@shared/components/PageHeader'
import { SummaryCard } from '@shared/components/SummaryCard'
import { PrintBrandingHeader } from '@shared/components/PrintBrandingHeader'
import { dictionary } from '@shared/i18n'
import type { BilingualString } from '@shared/i18n'
import { repairStatusValues, repairStatusLabel } from '@shared/lib/repairStatus'
import { categoryLabel } from '@shared/lib/expenseCategory'
import { getReportBounds, type ReportPeriod } from '@shared/lib/reportPeriod'
import { useBrandingSettings } from '@shared/hooks/useBrandingSettings'
import { formatCurrency } from '@shared/lib/currency'
import type { ReportData } from '../../../../main/db/repositories/reportRepository'

const periodOptions: { value: ReportPeriod; label: BilingualString }[] = [
  { value: 'daily', label: dictionary.reports.daily },
  { value: 'weekly', label: dictionary.reports.weekly },
  { value: 'monthly', label: dictionary.reports.monthly },
  { value: 'yearly', label: dictionary.reports.yearly },
  { value: 'custom', label: dictionary.reports.custom }
]

const selectClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

function RankedTable({
  nameLabel,
  valueLabel,
  rows,
  emptyText
}: {
  nameLabel: BilingualString
  valueLabel: BilingualString
  rows: { name: string; value: string }[]
  emptyText: BilingualString
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-surface p-lg text-center">
        <BilingualText text={emptyText} size="sm" className="items-center text-ink-muted" />
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-surface">
      <table className="w-full text-left">
        <thead className="border-b border-border bg-surface-raised">
          <tr>
            <th className="px-md py-sm">
              <BilingualText text={nameLabel} size="sm" className="text-ink-muted" />
            </th>
            <th className="px-md py-sm text-right">
              <BilingualText text={valueLabel} size="sm" className="text-ink-muted" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, index) => (
            <tr key={index}>
              <td className="px-md py-sm text-sm text-ink">{row.name}</td>
              <td className="px-md py-sm text-right text-sm font-medium text-ink">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ReportsPage() {
  const { branding, logoDataUrl } = useBrandingSettings()
  const currency = branding?.currency ?? 'PKR'
  const [period, setPeriod] = useState<ReportPeriod>('monthly')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)

  const bounds = getReportBounds(period, { from: customFrom, to: customTo })

  useEffect(() => {
    if (!bounds) {
      setReport(null)
      return
    }
    setLoading(true)
    window.api.reports.generate(bounds).then((data) => {
      setReport(data)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds?.isoFrom, bounds?.isoTo, bounds?.dateOnlyFrom, bounds?.dateOnlyTo])

  const handleExportPdf = async () => {
    setExporting(true)
    setExportMessage(null)
    const fileName = `RepairDex-Report-${period}-${new Date().toISOString().slice(0, 10)}.pdf`
    const result = await window.api.print.exportPdf(fileName)
    setExporting(false)
    if (result.success) setExportMessage(`Saved to ${result.filePath}`)
  }

  const handlePrint = () => {
    window.api.print.direct()
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="no-print">
        <PageHeader
          title={dictionary.nav.reports}
          action={
            <div className="flex gap-sm">
              <Button variant="secondary" onClick={handlePrint} disabled={!report}>
                <BilingualText text={dictionary.reports.print} size="sm" align="center" />
              </Button>
              <Button variant="primary" onClick={handleExportPdf} disabled={!report || exporting}>
                <BilingualText text={dictionary.reports.exportPdf} size="sm" align="center" />
              </Button>
            </div>
          }
        />

        <Card padding="md" className="mb-lg flex flex-wrap items-end gap-md">
          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.reports.dateRangeLabel} size="sm" className="text-ink-muted" />
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as ReportPeriod)}
              className={selectClass}
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label.en}
                </option>
              ))}
            </select>
          </label>

          {period === 'custom' && (
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
        </Card>

        {exportMessage && (
          <p className="mb-lg rounded-md bg-success/10 px-sm py-sm text-sm text-success">{exportMessage}</p>
        )}
      </div>

      {!bounds ? (
        <div className="flex flex-1 items-center justify-center">
          <BilingualText text={dictionary.reports.selectCustomRange} size="sm" className="items-center text-ink-muted" />
        </div>
      ) : loading || !report ? (
        <div className="flex flex-1 items-center justify-center">
          <BilingualText text={dictionary.common.loading} size="sm" className="items-center text-ink-muted" />
        </div>
      ) : (
        <Card padding="xl" className="flex flex-col gap-lg">
          <PrintBrandingHeader
            shopName={branding?.shopName}
            logoUrl={logoDataUrl}
            phone={branding?.phone}
            address={branding?.address}
          />

          <p className="text-sm text-ink-muted">
            {dictionary.reports.reportGeneratedOn.en}: {new Date().toLocaleString()}
          </p>

          <div className="grid grid-cols-2 gap-lg md:grid-cols-4">
            <SummaryCard
              label={dictionary.reports.totalRevenue}
              value={formatCurrency(report.totalRevenue, currency)}
              tone="primary"
            />
            <SummaryCard
              label={dictionary.reports.totalRepairProfit}
              value={formatCurrency(report.totalRepairProfit, currency)}
              tone="success"
            />
            <SummaryCard
              label={dictionary.reports.totalExpenses}
              value={formatCurrency(report.totalExpenses, currency)}
              tone="warning"
            />
            <SummaryCard
              label={dictionary.reports.netProfit}
              value={formatCurrency(report.netProfit, currency)}
              tone={report.netProfit < 0 ? 'danger' : 'success'}
            />
          </div>

          <section>
            <BilingualText text={dictionary.reports.expensesByCategory} as="div" size="lg" className="mb-md" />
            <RankedTable
              nameLabel={dictionary.expenses.category}
              valueLabel={dictionary.expenses.amount}
              rows={report.expensesByCategory.map((row) => ({
                name: categoryLabel(row.category),
                value: formatCurrency(row.total, currency)
              }))}
              emptyText={dictionary.reports.noDataForPeriod}
            />
          </section>

          <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
            <section>
              <BilingualText text={dictionary.reports.topBrands} as="div" size="lg" className="mb-md" />
              <RankedTable
                nameLabel={dictionary.repairs.deviceBrand}
                valueLabel={dictionary.reports.repairCount}
                rows={report.topBrands.map((row) => ({ name: row.brand, value: String(row.count) }))}
                emptyText={dictionary.reports.noDataForPeriod}
              />
            </section>

            <section>
              <BilingualText text={dictionary.reports.topModels} as="div" size="lg" className="mb-md" />
              <RankedTable
                nameLabel={dictionary.repairs.deviceModel}
                valueLabel={dictionary.reports.repairCount}
                rows={report.topModels.map((row) => ({
                  name: `${row.brand} ${row.model}`,
                  value: String(row.count)
                }))}
                emptyText={dictionary.reports.noDataForPeriod}
              />
            </section>
          </div>

          <section>
            <BilingualText text={dictionary.reports.commonRepairTypes} as="div" size="lg" className="mb-md" />
            <RankedTable
              nameLabel={dictionary.repairs.issue}
              valueLabel={dictionary.reports.repairCount}
              rows={report.commonRepairTypes.map((row) => ({ name: row.issue, value: String(row.count) }))}
              emptyText={dictionary.reports.noDataForPeriod}
            />
          </section>

          <section>
            <BilingualText text={dictionary.reports.repairsByStatus} as="div" size="lg" className="mb-md" />
            <div className="flex flex-wrap gap-md">
              {repairStatusValues.map((status) => (
                <div key={status} className="rounded-md border border-border px-md py-sm">
                  <BilingualText text={repairStatusLabel[status]} size="xs" className="text-ink-muted" />
                  <p className="mt-0.5 text-lg font-medium text-ink">{report.statusCounts[status] ?? 0}</p>
                </div>
              ))}
            </div>
          </section>
        </Card>
      )}
    </div>
  )
}
