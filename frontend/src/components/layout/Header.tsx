import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, User, LogOut, Settings, ChevronDown, Menu, Building2 } from 'lucide-react';
import { SearchInput } from '@/components/ui/SearchInput';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const navigate = useNavigate();
  const { appUser, firebaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const { data: notifications } = useQuery({
    queryKey: queryKeys.users.notifications(),
    queryFn: usersApi.getNotifications,
    enabled: !!firebaseUser,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0;

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    queryClient.clear();
    navigate('/login');
  };

  const handleSearch = (query: string) => {
    if (query.trim()) {
      navigate(`/catalog?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const avatarInitials = appUser?.display_name
    ? appUser.display_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : firebaseUser?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <header className="flex h-16 items-center border-b border-neutral-200 bg-white px-4 gap-3">
      {/* Mobile menu toggle */}
      <button
        onClick={onMenuToggle}
        className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 lg:hidden"
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-xl">
        <SearchInput
          placeholder="Search therapies, manufacturers, indications…"
          onChange={handleSearch}
          debounceMs={500}
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Notification Bell */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setNotifOpen((prev) => !prev)}
            className="relative rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-neutral-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-neutral-900">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    className="text-xs text-primary-600 hover:underline"
                    onClick={() => {
                      void usersApi.markAllNotificationsRead().then(() => {
                        void queryClient.invalidateQueries({ queryKey: queryKeys.users.notifications() });
                      });
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {!notifications || notifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-neutral-500">No notifications</p>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        'border-b border-neutral-100 px-4 py-3 last:border-0',
                        !n.is_read && 'bg-primary-50'
                      )}
                    >
                      <p className="text-sm font-medium text-neutral-900">{n.title}</p>
                      <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-neutral-200 px-4 py-2">
                <button
                  className="w-full text-center text-xs text-primary-600 hover:underline"
                  onClick={() => { setNotifOpen(false); navigate('/settings?tab=notifications'); }}
                >
                  Manage notification settings
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setUserMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-700 text-xs font-bold text-white">
              {avatarInitials}
            </div>
            <span className="hidden max-w-[120px] truncate font-medium sm:block">
              {appUser?.display_name ?? firebaseUser?.email ?? 'User'}
            </span>
            <ChevronDown className="h-4 w-4 text-neutral-400" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-neutral-200 bg-white shadow-lg">
              <div className="border-b border-neutral-200 px-4 py-3">
                <p className="text-sm font-medium text-neutral-900 truncate">
                  {appUser?.display_name ?? 'User'}
                </p>
                <p className="text-xs text-neutral-500 truncate">{firebaseUser?.email}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  <User className="h-4 w-4" /> Profile
                </button>
                {appUser?.institution_id && (
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/institution'); }}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    <Building2 className="h-4 w-4" /> Institution
                  </button>
                )}
                <button
                  onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  <Settings className="h-4 w-4" /> Settings
                </button>
              </div>
              <div className="border-t border-neutral-200 py-1">
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
