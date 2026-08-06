import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '../layout/AppLayout'
import { DashboardPage } from '@features/dashboard/DashboardPage'
import { CustomersPage } from '@features/customers/CustomersPage'
import { CustomerFormPage } from '@features/customers/CustomerFormPage'
import { CustomerDetailPage } from '@features/customers/CustomerDetailPage'
import { RepairsPage } from '@features/repairs/RepairsPage'
import { RepairFormPage } from '@features/repairs/RepairFormPage'
import { RepairDetailPage } from '@features/repairs/RepairDetailPage'
import { PaymentsPage } from '@features/payments/PaymentsPage'
import { ExpensesPage } from '@features/expenses/ExpensesPage'
import { ExpenseFormPage } from '@features/expenses/ExpenseFormPage'
import { UdhaarPage } from '@features/udhaar/UdhaarPage'
import { AddUdhaarPage } from '@features/udhaar/AddUdhaarPage'
import { ReportsPage } from '@features/reports/ReportsPage'
import { AnalyticsPage } from '@features/analytics/AnalyticsPage'
import { ActivityTimelinePage } from '@features/activity/ActivityTimelinePage'
import { SettingsPage } from '@features/settings/SettingsPage'
import { AuthPage } from '@features/auth/AuthPage'
import { useAuthBootstrap } from '@features/auth/hooks/useAuthBootstrap'
import { useAuthStore } from '@shared/hooks/useAuthStore'
import { SplashScreen } from '@shared/components/SplashScreen'

export function AppRoutes() {
  useAuthBootstrap()
  const sessionLoading = useAuthStore((state) => state.sessionLoading)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (sessionLoading) return <SplashScreen />

  return (
    <Routes>
      <Route path="/auth" element={isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route element={isAuthenticated ? <AppLayout /> : <Navigate to="/auth" replace />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/new" element={<CustomerFormPage />} />
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
        <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
        <Route path="/repairs" element={<RepairsPage />} />
        <Route path="/repairs/new" element={<RepairFormPage />} />
        <Route path="/repairs/:id" element={<RepairDetailPage />} />
        <Route path="/repairs/:id/edit" element={<RepairFormPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/expenses/new" element={<ExpenseFormPage />} />
        <Route path="/udhaar" element={<UdhaarPage />} />
        <Route path="/udhaar/new" element={<AddUdhaarPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/activity" element={<ActivityTimelinePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
