import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { dictionary } from '@shared/i18n'
import { logActivity } from '@shared/lib/activityLog'
import { expenseCategoryValues, expenseCategoryLabel } from '@shared/lib/expenseCategory'
import { formatLocalDate } from '@shared/lib/dateRangePresets'

const CUSTOM_SENTINEL = '__custom__'

const todayDateString = (): string => formatLocalDate(new Date())
const currentMonthString = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const expenseFormSchema = z
  .object({
    category: z.string().min(1, 'Category is required'),
    customCategory: z.string().trim().optional(),
    amount: z
      .string()
      .trim()
      .min(1, 'Amount is required')
      .refine((value) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0, 'Enter a valid amount'),
    description: z.string().trim().optional(),
    expenseDate: z.string().trim().min(1, 'Expense date is required'),
    isRecurring: z.boolean(),
    recurringMonth: z.string().trim().optional()
  })
  .refine((data) => data.category !== CUSTOM_SENTINEL || Boolean(data.customCategory?.trim()), {
    message: 'Enter a custom category name',
    path: ['customCategory']
  })

type ExpenseFormValues = z.infer<typeof expenseFormSchema>

const inputClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

export function ExpenseFormPage() {
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      category: 'rent',
      customCategory: '',
      amount: '',
      description: '',
      expenseDate: todayDateString(),
      isRecurring: false,
      recurringMonth: ''
    }
  })

  const categoryValue = watch('category')
  const isRecurringValue = watch('isRecurring')

  useEffect(() => {
    if (isRecurringValue) setValue('recurringMonth', currentMonthString())
  }, [isRecurringValue, setValue])

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)
    const category = values.category === CUSTOM_SENTINEL ? values.customCategory!.trim() : values.category

    try {
      const created = await window.api.expenses.create({
        category,
        amount: Number(values.amount),
        description: values.description?.trim() || null,
        expenseDate: values.expenseDate,
        isRecurring: values.isRecurring,
        recurringMonth: values.isRecurring ? values.recurringMonth || currentMonthString() : null
      })
      logActivity({
        actionType: 'create',
        entityType: 'expense',
        entityId: created.id,
        description: `Expense logged: ${category} — ${created.amount.toFixed(2)}`
      })
      navigate('/expenses', { replace: true })
    } catch {
      setSubmitError('Could not save expense. Please try again.')
    }
  })

  return (
    <div className="flex max-w-lg flex-1 flex-col">
      <BilingualText text={dictionary.expenses.addNew} as="div" size="xl" className="mb-xl" />

      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-md rounded-lg border border-border/60 bg-surface p-xl shadow-card"
      >
        {submitError && (
          <p role="alert" className="rounded-md bg-danger/10 px-sm py-sm text-sm text-danger">
            {submitError}
          </p>
        )}

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.expenses.category} size="sm" className="text-ink-muted" />
          <select className={inputClass} {...register('category')}>
            {expenseCategoryValues.map((value) => (
              <option key={value} value={value}>
                {expenseCategoryLabel[value].en}
              </option>
            ))}
            <option value={CUSTOM_SENTINEL}>{dictionary.expenses.categoryCustom.en}</option>
          </select>
        </label>

        {categoryValue === CUSTOM_SENTINEL && (
          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.expenses.customCategoryLabel} size="sm" className="text-ink-muted" />
            <input type="text" autoFocus className={inputClass} {...register('customCategory')} />
            {errors.customCategory && <span className="text-xs text-danger">{errors.customCategory.message}</span>}
          </label>
        )}

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.expenses.amount} size="sm" className="text-ink-muted" />
          <input type="text" inputMode="decimal" className={inputClass} {...register('amount')} />
          {errors.amount && <span className="text-xs text-danger">{errors.amount.message}</span>}
        </label>

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.expenses.description} size="sm" className="text-ink-muted" />
          <input type="text" className={inputClass} {...register('description')} />
        </label>

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.expenses.expenseDate} size="sm" className="text-ink-muted" />
          <input type="date" className={inputClass} {...register('expenseDate')} />
          {errors.expenseDate && <span className="text-xs text-danger">{errors.expenseDate.message}</span>}
        </label>

        <label className="flex items-center gap-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20"
            {...register('isRecurring')}
          />
          <BilingualText text={dictionary.expenses.isRecurring} size="sm" />
        </label>

        {isRecurringValue && (
          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.expenses.recurringMonth} size="sm" className="text-ink-muted" />
            <input type="month" className={inputClass} {...register('recurringMonth')} />
          </label>
        )}

        <div className="mt-sm flex justify-end gap-sm">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            <BilingualText text={dictionary.expenses.cancel} size="sm" align="center" />
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            <BilingualText text={dictionary.expenses.save} size="sm" align="center" />
          </Button>
        </div>
      </form>
    </div>
  )
}
