import { dictionary } from '@shared/i18n'
import type { BilingualString } from '@shared/i18n'
import {
  DashboardIcon,
  CustomersIcon,
  RepairsIcon,
  PaymentsIcon,
  ExpensesIcon,
  ReportsIcon,
  SyncIcon,
  BackupIcon,
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
  { to: '/reports', label: dictionary.nav.reports, icon: ReportsIcon },
  { to: '/sync', label: dictionary.nav.sync, icon: SyncIcon },
  { to: '/backup', label: dictionary.nav.backup, icon: BackupIcon },
  { to: '/settings', label: dictionary.nav.settings, icon: SettingsIcon }
]
