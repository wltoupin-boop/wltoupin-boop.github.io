import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FlaskConical,
  Heart,
  GitBranch,
  Building2,
  ClipboardList,
  Settings,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  subitems?: { label: string; path: string }[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'Therapy Catalog', path: '/catalog', icon: <FlaskConical className="h-5 w-5" /> },
  { label: 'My Watchlist', path: '/watchlist', icon: <Heart className="h-5 w-5" /> },
  { label: 'Pipeline View', path: '/pipeline', icon: <GitBranch className="h-5 w-5" /> },
  {
    label: 'Institution',
    path: '/institution',
    icon: <Building2 className="h-5 w-5" />,
    subitems: [
      { label: 'Dashboard', path: '/institution' },
      { label: 'Operational Tracker', path: '/operational' },
    ],
  },
  { label: 'Settings', path: '/settings', icon: <Settings className="h-5 w-5" /> },
  {
    label: 'Admin',
    path: '/admin',
    icon: <ShieldCheck className="h-5 w-5" />,
    adminOnly: true,
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const [expandedItem, setExpandedItem] = React.useState<string | null>(null);

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-neutral-200 bg-white transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex h-16 items-center border-b border-neutral-200 px-4',
          collapsed ? 'justify-center' : 'gap-3'
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-800">
          <FlaskConical className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-base font-bold text-primary-900">CellGene</span>
        )}
        {!collapsed && (
          <button
            onClick={onToggle}
            className="ml-auto rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Collapse sidebar"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {visibleItems.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
          const hasSubitems = item.subitems && item.subitems.length > 0;
          const isExpanded = expandedItem === item.path;

          return (
            <div key={item.path}>
              {hasSubitems ? (
                <button
                  onClick={() =>
                    setExpandedItem(isExpanded ? null : item.path)
                  }
                  className={cn(
                    'mb-0.5 flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-800'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                    collapsed && 'justify-center px-2'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="shrink-0 text-current">{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="ml-3 flex-1 text-left">{item.label}</span>
                      <ChevronRight
                        className={cn(
                          'h-4 w-4 transition-transform',
                          isExpanded && 'rotate-90'
                        )}
                      />
                    </>
                  )}
                </button>
              ) : (
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive: navActive }) =>
                    cn(
                      'mb-0.5 flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      navActive
                        ? 'bg-primary-50 text-primary-800'
                        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                      collapsed && 'justify-center px-2'
                    )
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!collapsed && <span className="ml-3">{item.label}</span>}
                </NavLink>
              )}

              {/* Subitems */}
              {hasSubitems && (isExpanded || isActive) && !collapsed && (
                <div className="ml-8 mb-1 border-l border-neutral-200 pl-3">
                  {item.subitems!.map((sub) => (
                    <NavLink
                      key={sub.path}
                      to={sub.path}
                      end
                      className={({ isActive: subActive }) =>
                        cn(
                          'flex items-center rounded-md px-2 py-1.5 text-sm transition-colors',
                          subActive
                            ? 'text-primary-700 font-medium'
                            : 'text-neutral-500 hover:text-neutral-800'
                        )
                      }
                    >
                      {sub.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle at bottom when collapsed */}
      {collapsed && (
        <div className="border-t border-neutral-200 p-2">
          <button
            onClick={onToggle}
            className="flex w-full items-center justify-center rounded-md p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </aside>
  );
};
