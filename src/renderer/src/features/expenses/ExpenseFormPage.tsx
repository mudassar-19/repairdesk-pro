import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { dictionary } from '@shared/i18n'
import { logActivity } from '@shared/lib/activityLog'
import { expenseCategoryValues, expenseCategoryLabel, type ExpenseCategory } from '@shared/lib/expenseCategory'
import { formatLocalDate } from '@shared/lib/dateRangePresets'
import { todayLocalDate } from '@shared/lib/phone'
import { advanceOnEnter } from '@shared/lib/formKeyboardFlow'
import { MAX_NOTES, MAX_SHORT_TEXT, TOO_LONG } from '@shared/lib/textLimits'

const CUSTOM_SENTINEL = '__custom__'

const todayDateString = (): string => formatLocalDate(new Date())

/** Bilingual option label for the category <select>, since <option> can't hold BilingualText. */
const categoryOptionLabel = (value: ExpenseCategory): string =>
  `${expenseCategoryLabel[value].en} — ${expenseCategoryLabel[value].ur}`

const expenseFormSchema = z
  .object({
    category: z.string().min(1, 'Category is required'),
    customCategory: z.string().trim().max(MAX_SHORT_TEXT, TOO_LONG(MAX_SHORT_TEXT)).optional(),
    amount: z
      .string()
      .trim()
      .min(1, 'Amount is required')
      .refine((value) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0, 'Enter a valid amount'),
    description: z.string().trim().max(MAX_NOTES, TOO_LONG(MAX_NOTES)).optional(),
    // An expense is money already spent; it can't be dated in the future.
    expenseDate: z
      .string()
      .trim()
      .min(1, 'Expense date is required')
      .refine((value) => value <= todayLocalDate(), 'Expense date cannot be in the future'),
    isRecurring: z.boolean()
  })
  .refine((data) => data.category !== CUSTOM_SENTINEL || Boolean(data.customCategory?.trim()), {
    message: 'Enter a custom category name',
    path: ['customCategory']
  })

type ExpenseFormValues = z.infer<typeof expenseFormSchema>

/** Pre-fill payload passed from the Dashboard recurring-draft "Add" button (Part J#16). */
interface ExpensePrefill {
  category?: string
  amount?: number
}

const inputClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

const isKnownCategory = (category: string): category is ExpenseCategory =>
  (expenseCategoryValues as readonly string[]).includes(category)

export function ExpenseFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const prefill = (useLocation().state as ExpensePrefill | null) ?? null
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState(false)

  // A recurring draft may target a built-in category or a custom one.
  const prefillIsCustom = Boolean(prefill?.category) && !isKnownCategory(prefill!.category!)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      category: prefill?.category ? (prefillIsCustom ? CUSTOM_SENTINEL : prefill.category) : 'rent',
      customCategory: prefillIsCustom ? prefill!.category! : '',
      amount: prefill?.amount != null ? String(prefill.amount) : '',
      description: '',
      expenseDate: todayDateString(),
      // Arriving from a recurring draft means this category repeats monthly.
      isRecurring: Boolean(prefill)
    }
  })

  // Edit mode: load the existing expense and prefill the form. A custom category
  // (not one of the built-in values) maps back to the "Custom…" option.
  useEffect(() => {
    if (!id) return
    window.api.expenses.getById(id).then((expense) => {
      if (!expense) {
        setLoadError(true)
        setLoading(false)
        return
      }
      const custom = !isKnownCategory(expense.category)
      reset({
        category: custom ? CUSTOM_SENTINEL : expense.category,
        customCategory: custom ? expense.category : '',
        amount: String(expense.amount),
        description: expense.description ?? '',
        expenseDate: expense.expenseDate,
        isRecurring: expense.isRecurring
      })
      setLoading(false)
    })
  }, [id, reset])

  const categoryValue = watch('category')

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)
    const category = values.category === CUSTOM_SENTINEL ? values.customCategory!.trim() : values.category
    const payload = {
      category,
      amount: Number(values.amount),
      description: values.description?.trim() || null,
      expenseDate: values.expenseDate,
      isRecurring: values.isRecurring,
      // recurringMonth is no longer captured — "recurring" now simply means
      // "repeats every month" (Part K#20); the auto-draft finds it by flag.
      recurringMonth: null
    }

    try {
      if (isEdit && id) {
        const updated = await window.api.expenses.update(id, payload)
        if (!updated) {
          setSubmitError('Could not save expense. Please try again.')
          return
        }
        logActivity({
          actionType: 'update',
          entityType: 'expense',
          entityId: updated.id,
          description: `Expense updated: ${category} — ${updated.amount.toFixed(2)}`
        })
      } else {
        const created = await window.api.expenses.create(payload)
        logActivity({
          actionType: 'create',
          entityType: 'expense',
          entityId: created.id,
          description: `Expense logged: ${category} — ${created.amount.toFixed(2)}`
        })
      }
      navigate('/expenses', { replace: true })
    } catch {
      setSubmitError('Could not save expense. Please try again.')
    }
  })

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <BilingualText text={dictionary.common.loading} size="sm" className="items-center text-ink-muted" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-sm text-center">
        <BilingualText text={dictionary.expenses.notFound} as="div" size="lg" align="center" />
        <Button variant="ghost" onClick={() => navigate('/expenses')}>
          <BilingualText text={dictionary.repairs.backToList} size="sm" align="center" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex max-w-lg flex-1 flex-col">
      <BilingualText text={isEdit ? dictionary.expenses.editExpense : dictionary.expenses.addNew} as="div" size="xl" className="mb-xl" />

      <form
        onSubmit={onSubmit}
        onKeyDown={advanceOnEnter}
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
                {categoryOptionLabel(value)}
              </option>
            ))}
            <option value={CUSTOM_SENTINEL}>
              {dictionary.expenses.categoryCustom.en} — {dictionary.expenses.categoryCustom.ur}
            </option>
          </select>
        </label>

        {categoryValue === CUSTOM_SENTINEL && (
          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.expenses.customCategoryLabel} size="sm" className="text-ink-muted" />
            <input type="text" autoFocus maxLength={MAX_SHORT_TEXT} className={inputClass} {...register('customCategory')} />
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
          <input type="text" maxLength={MAX_NOTES} className={inputClass} {...register('description')} />
        </label>

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.expenses.expenseDate} size="sm" className="text-ink-muted" />
          <input type="date" className={inputClass} {...register('expenseDate')} />
          {errors.expenseDate && <span className="text-xs text-danger">{errors.expenseDate.message}</span>}
        </label>

        <label className="flex items-start gap-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20"
            {...register('isRecurring')}
          />
          <span className="flex flex-col">
            <BilingualText text={dictionary.expenses.isRecurring} size="sm" />
            <BilingualText text={dictionary.expenses.isRecurringHint} size="xs" className="text-ink-muted" />
          </span>
        </label>

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
