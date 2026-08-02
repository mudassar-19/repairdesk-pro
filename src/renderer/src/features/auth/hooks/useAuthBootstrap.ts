import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { firebaseAuth } from '@shared/lib/firebase'
import { useAuthStore } from '@shared/hooks/useAuthStore'

/**
 * Runs once for the app's lifetime. The local encrypted session (safeStorage,
 * checked via IPC) is the sole gate for isAuthenticated — it resolves in
 * milliseconds and never waits on the network. Firebase's own auth listener
 * is wired up alongside it purely as a best-effort background token refresh:
 * if it fires with a user (only possible when online), we ask for a fresh ID
 * token; if that fails (offline) or never fires at all, nothing changes —
 * the local session already granted access.
 */
export function useAuthBootstrap(): void {
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated)
  const setSessionLoading = useAuthStore((state) => state.setSessionLoading)

  useEffect(() => {
    let cancelled = false

    window.api.auth.getLocalSession().then((session) => {
      if (cancelled) return
      if (session) setAuthenticated({ uid: session.uid, email: session.email }, session.deviceId)
      setSessionLoading(false)
    })

    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (!firebaseUser) return
      firebaseUser.getIdToken(true).catch(() => {
        // Offline or refresh failed — the local encrypted session stays authoritative.
      })
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [setAuthenticated, setSessionLoading])
}
