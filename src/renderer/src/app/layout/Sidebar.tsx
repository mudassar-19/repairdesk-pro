import { NavLink } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { dictionary } from '@shared/i18n'
import { useSidebarStore } from '@shared/hooks/useSidebarStore'
import { navItems } from './navItems'
import repairdeskIcon from '../../assets/images/repairdesk-icon.png'
import repairdeskLogo from '../../assets/images/repairdesk-logo.png'

export function Sidebar() {
  const collapsed = useSidebarStore((state) => state.collapsed)
  const mainItems = navItems.slice(0, -1)
  const settingsItem = navItems[navItems.length - 1]!

  const linkClass = (isActive: boolean) =>
    `group relative flex items-center gap-sm rounded-md px-sm py-sm transition-colors ${
      isActive ? 'bg-primary/10 text-primary' : 'text-ink-muted hover:bg-surface-raised hover:text-ink'
    }`

  const renderLink = ({ to, label, icon: Icon }: (typeof navItems)[number]) => (
    <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => linkClass(isActive)}>
      {({ isActive }) => (
        <>
          <span
            className={`absolute inset-y-1 left-0 w-[3px] rounded-full bg-primary transition-opacity ${
              isActive ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <Icon className="flex-shrink-0" />
          {!collapsed && <BilingualText text={label} size="sm" />}
        </>
      )}
    </NavLink>
  )

  return (
    <aside
      className={`no-print flex flex-shrink-0 flex-col border-r border-border bg-surface transition-[width] ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex items-center border-b border-border px-md py-lg">
        {collapsed ? (
          <img src={repairdeskIcon} alt={dictionary.app.name.en} className="h-9 w-9 flex-shrink-0 rounded-md" />
        ) : (
          <img src={repairdeskLogo} alt={dictionary.app.name.en} className="h-auto w-full max-w-[180px]" />
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-xs overflow-y-auto p-sm">
        {mainItems.map(renderLink)}
        <div className="my-xs border-t border-border" />
        {renderLink(settingsItem)}
      </nav>

      <div className="border-t border-border px-md py-md">
        {!collapsed ? (
          <div className="flex items-center gap-sm">
            <img src={repairdeskIcon} alt="" className="h-8 w-8 flex-shrink-0 rounded-md" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-ink-muted">{dictionary.app.name.en}</span>
              <span className="text-xs text-ink-muted opacity-70">Phase 1 · v0.1.0</span>
            </div>
          </div>
        ) : (
          <img src={repairdeskIcon} alt="" className="h-8 w-8 rounded-md" />
        )}
      </div>
    </aside>
  )
}
