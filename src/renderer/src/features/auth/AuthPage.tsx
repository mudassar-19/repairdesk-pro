import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { firebaseAuth } from '@shared/lib/firebase'
import { BilingualText } from '@shared/components/BilingualText'
import { dictionary } from '@shared/i18n'
import { useAuthStore } from '@shared/hooks/useAuthStore'
import { Button } from '@shared/components/Button'
import { describeAuthError } from './lib/authErrors'
import repairdeskLogo from '../../assets/images/repairdesk-logo.png'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required')
})

type LoginFormValues = z.infer<typeof loginSchema>

/**
 * Reachable directly by route. There is exactly one source of truth for
 * "the user is authenticated": the isAuthenticated flag in useAuthStore.
 * Login here only ever calls setAuthenticated(); AppRoutes reacts to that
 * flag to swap this page out for the Dashboard (see AppRoutes.tsx). There is
 * no imperative navigate() call here — a second navigation mechanism racing
 * the reactive one is exactly what caused the previous "stuck on Logging
 * in" bug (see below).
 */
export function AuthPage() {
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated)
  const [formError, setFormError] = useState<string | null>(null)
  // Not just `() => () => { mountedRef.current = false }` — under StrictMode's
  // dev-only mount→cleanup→remount cycle, that form flips this to false at
  // initial mount and never back, silently no-op-ing every guarded call below
  // for the component's entire real lifetime. Resetting it true on setup too
  // makes the ref correctly track "mounted right now" through that cycle.
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => void (mountedRef.current = false)
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null)
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password)
      const deviceId = await window.api.auth.getDeviceId()

      await window.api.auth.saveLocalSession({
        uid: credential.user.uid,
        email: credential.user.email ?? email,
        deviceId,
        refreshToken: credential.user.refreshToken,
        issuedAt: new Date().toISOString()
      })

      // Auth is fully established the moment the encrypted session is on
      // disk — flip state right here so the Dashboard redirect fires
      // immediately. Activity logging is an auxiliary side effect (local log
      // entry only); it isn't awaited in the critical path, and can't throw
      // into the catch below and strand the user on this screen after the
      // real work already succeeded — that mismatch (session saved, but a
      // later best-effort step throwing before setAuthenticated ran) was
      // the actual bug.
      if (mountedRef.current) setAuthenticated({ uid: credential.user.uid, email: credential.user.email ?? email }, deviceId)

      window.api
        .logActivity({
          actionType: 'login',
          entityType: 'auth',
          entityId: credential.user.uid,
          description: `Signed in on device ${deviceId}`,
          metadata: { deviceId }
        })
        .catch(() => {
          // Best-effort — the activity hook must never affect login success.
        })
    } catch (error) {
      if (mountedRef.current) setFormError(describeAuthError(error))
    }
  })

  return (
    <div className="relative flex min-h-screen w-screen items-center justify-center overflow-hidden bg-bg p-lg">
      {/* Soft decorative glows only — stays within the light theme, no bold color blocks or dark backgrounds. */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -right-32 h-[32rem] w-[32rem] rounded-full bg-primary/5 blur-3xl" />

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-lg border border-border/60 bg-surface shadow-raised md:grid-cols-2">
        {/* Branding panel — primary-tint (a near-white teal tint) rather than a solid brand color, since the logo's own background isn't transparent and would show as a visible box on anything darker. */}
        <div className="hidden flex-col items-center justify-center gap-xl bg-primary-tint p-2xl md:flex">
          <img src={repairdeskLogo} alt={dictionary.app.name.en} className="w-full max-w-[300px]" />
          <BilingualText text={dictionary.auth.tagline} as="div" size="lg" className="items-center text-center text-ink" />
        </div>

        {/* Form panel */}
        <div className="flex flex-col justify-center p-2xl">
          <div className="mb-xl flex flex-col items-center text-center md:hidden">
            <img src={repairdeskLogo} alt={dictionary.app.name.en} className="mb-md w-full max-w-[220px]" />
            <BilingualText text={dictionary.auth.tagline} as="div" size="sm" className="items-center text-ink-muted" />
          </div>

          <BilingualText text={dictionary.auth.signIn} as="div" size="xl" className="mb-xl" />

          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-md">
            {formError && (
              <p role="alert" className="rounded-md bg-danger/10 px-sm py-sm text-sm text-danger">
                {formError}
              </p>
            )}

            <label className="flex flex-col gap-1">
              <BilingualText text={dictionary.auth.email} size="sm" className="text-ink-muted" />
              <input
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                className="rounded-md border border-border bg-surface px-sm py-sm text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                {...register('email')}
              />
              {errors.email && <span className="text-xs text-danger">{errors.email.message}</span>}
            </label>

            <label className="flex flex-col gap-1">
              <BilingualText text={dictionary.auth.password} size="sm" className="text-ink-muted" />
              <input
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                className="rounded-md border border-border bg-surface px-sm py-sm text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                {...register('password')}
              />
              {errors.password && <span className="text-xs text-danger">{errors.password.message}</span>}
            </label>

            <Button type="submit" variant="primary" size="md" disabled={isSubmitting} className="mt-xs">
              {isSubmitting && (
                <span className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-primary-ink/30 border-t-primary-ink" />
              )}
              <BilingualText
                text={isSubmitting ? dictionary.auth.loggingIn : dictionary.auth.submit}
                size="sm"
                align="center"
              />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
