export {}

declare global {
  interface ImportMetaEnv {
    readonly MAIN_VITE_GOOGLE_DRIVE_CLIENT_ID: string
    readonly MAIN_VITE_GOOGLE_DRIVE_CLIENT_SECRET: string
  }
}
