import type { SVGProps } from 'react'

function IconBase(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  )
}

export function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </IconBase>
  )
}

export function CustomersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17.5" cy="7.5" r="2.2" />
      <path d="M15.8 13.3c2.4.5 4.2 2.6 4.2 5.2" />
    </IconBase>
  )
}

export function RepairsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M14.5 5.5 18 2l1 1-1.5 3.5L20 9l-3 3-2.5-2.5" />
      <path d="M14.5 9.5 4.5 19.5a1.6 1.6 0 0 1-2.3-2.3l10-10" />
      <path d="M17 16l2.3 2.3a1.6 1.6 0 0 1-2.3 2.3L14.7 18.3" />
    </IconBase>
  )
}

export function PaymentsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 9.5h19" />
      <path d="M6 14.5h4" />
    </IconBase>
  )
}

export function ExpensesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M6 2.5h12v19l-2.5-1.5L13 21.5l-2.5-1.5L8 21.5l-2-1.5z" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
    </IconBase>
  )
}

export function ReportsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M3.5 20.5v-7M9.5 20.5V8M15.5 20.5v-11M21 20.5v-4.5" />
      <path d="M3.5 20.5h17.5" />
    </IconBase>
  )
}

export function AnalyticsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M3.5 20.5h17.5" />
      <path d="M3.5 15.5 9 10l3.5 3L20.5 5" />
      <path d="M15 5h5.5v5.5" />
    </IconBase>
  )
}

export function BackupIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M7 18a4.5 4.5 0 0 1-1-8.9 5.5 5.5 0 0 1 10.7-1.9A4 4 0 0 1 17 18H7z" />
      <path d="M12 12v6.5M9.5 15.5 12 13l2.5 2.5" />
    </IconBase>
  )
}

export function DatabaseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <path d="M4 5.5v6.5c0 1.7 3.6 3 8 3s8-1.3 8-3V5.5" />
      <path d="M4 12v6.5c0 1.7 3.6 3 8 3s8-1.3 8-3V12" />
    </IconBase>
  )
}

export function CloudIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M7 18h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 8.5 4.5 4.5 0 0 0 7 18z" />
    </IconBase>
  )
}

export function InboxIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 12.5 6.5 5h11L20 12.5" />
      <path d="M4 12.5v6a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 18.5v-6" />
      <path d="M4 12.5h5l1 2h4l1-2h5" />
    </IconBase>
  )
}

export function UdhaarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 8.5a2 2 0 0 1 2-2h11.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M4 8.5 12 4l6 3" />
      <circle cx="15" cy="12.5" r="1.6" />
    </IconBase>
  )
}

export function MoreVerticalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props} stroke="none">
      <circle cx="12" cy="5.5" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.6" fill="currentColor" />
    </IconBase>
  )
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  )
}

export function AuthIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M11 3.5H6a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 6 20.5h5" />
      <path d="M14.5 8 19 12l-4.5 4" />
      <path d="M19 12H9.5" />
    </IconBase>
  )
}

export function ActivityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </IconBase>
  )
}

export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1h-.2a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.6v-.2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.6 1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z" />
    </IconBase>
  )
}
