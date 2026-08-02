function isAuthErrorCode(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string'
}

/** Firebase's own error messages are developer-facing; map the codes we expect to hit. */
export function describeAuthError(error: unknown): string {
  if (!isAuthErrorCode(error)) return 'Sign-in failed. Please try again.'

  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/network-request-failed':
      return 'No internet connection. Connect and try again to sign in for the first time on this device.'
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    default:
      return 'Sign-in failed. Please try again.'
  }
}
