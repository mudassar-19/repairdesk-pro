import { dictionary } from '@shared/i18n'
import type { BilingualString } from '@shared/i18n'
import {
  DashboardIcon,
  CustomersIcon,
  RepairsIcon,
  PaymentsIcon,
  ExpensesIcon,
  UdhaarIcon,
  ReportsIcon,
  AnalyticsIcon,
  ActivityIcon,
  SettingsIcon
} from '@shared/components/icons'
import type { ComponentType, SVGProps } from 'react'

export interface NavItem {
  to: string
  label: BilingualString
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

export const navItems: NavItem[] = [
  { to: '/', label: dictionary.nav.dashboard, icon: DashboardIcon },
  { to: '/customers', label: dictionary.nav.customers, icon: CustomersIcon },
  { to: '/repairs', label: dictionary.nav.repairs, icon: RepairsIcon },
  { to: '/payments', label: dictionary.nav.payments, icon: PaymentsIcon },
  { to: '/expenses', label: dictionary.nav.expenses, icon: ExpensesIcon },
  { to: '/udhaar', label: dictionary.nav.udhaar, icon: UdhaarIcon },
  { to: '/reports', label: dictionary.nav.reports, icon: ReportsIcon },
  { to: '/analytics', label: dictionary.nav.analytics, icon: AnalyticsIcon },
  { to: '/activity', label: dictionary.nav.activity, icon: ActivityIcon },
  { to: '/settings', label: dictionary.nav.settings, icon: SettingsIcon }
]
