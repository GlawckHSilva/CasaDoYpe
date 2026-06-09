import React, { useState } from 'react';
import { Bell, Headset, LogOut, Moon, Settings, Sun, User } from 'lucide-react';
import UserAvatar from './UserAvatar.jsx';

export default function UserMenu({
  authProfile,
  notificationCount = 0,
  onSignOut,
  onOpenProfile,
  onOpenNotifications,
  onOpenSupport,
  onOpenSettings,
  onToggleTheme,
  themeMode = 'light',
}) {
  const [open, setOpen] = useState(false);
  const pendingNotifications = Math.max(0, Number(notificationCount || 0));
  const ThemeIcon = themeMode === 'dark' ? Sun : Moon;
  const role = String(authProfile?.role || '').toLowerCase();
  const showSupport = !['hospede', 'guest', 'client'].includes(role);
  const menuItems = [
    ['Meu Perfil', onOpenProfile, User],
    ['Notificações', onOpenNotifications, Bell],
    ...(showSupport ? [['Suporte', onOpenSupport, Headset]] : []),
    ['Configurações', onOpenSettings, Settings],
    ['Alternar tema', onToggleTheme, ThemeIcon],
  ].filter(([, action]) => Boolean(action));

  const runAction = (action) => {
    action?.();
    setOpen(false);
  };

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        className="header-theme-button relative"
        onClick={() => setOpen((current) => !current)}
        aria-label="Abrir menu do usuário"
        title="Perfil"
      >
        <UserAvatar profile={authProfile} size="xs" className="border-0 bg-transparent shadow-none" />
        {pendingNotifications > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black leading-none text-white ring-2 ring-white dark:ring-slate-950">
            {pendingNotifications > 9 ? '9+' : pendingNotifications}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full mt-2 w-[min(18rem,calc(100vw-1rem))] overflow-hidden rounded-md bg-white text-ink shadow-soft ring-1 ring-ink/10 dark:bg-slate-900 dark:text-white dark:ring-white/10">
          <div className="flex items-center gap-3 border-b border-ink/10 px-4 py-3 text-sm dark:border-white/10">
            <UserAvatar profile={authProfile} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-black">{authProfile?.full_name || 'Usuário'}</p>
              <p className="truncate text-xs text-ink/55 dark:text-white/55">{authProfile?.email}</p>
            </div>
          </div>

          {menuItems.map(([label, action, Icon]) => (
            <button
              key={label}
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold hover:bg-mist dark:hover:bg-white/5"
              onClick={() => runAction(action)}
            >
              <Icon size={17} className="text-sky-600 dark:text-sky-300" />
              <span>{label}</span>
              {label === 'Notificações' && pendingNotifications > 0 ? (
                <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-xs font-black text-white">
                  {pendingNotifications}
                </span>
              ) : null}
            </button>
          ))}

          <button
            type="button"
            className="flex w-full items-center gap-3 border-t border-ink/10 px-4 py-3 text-left text-sm font-bold text-red-700 hover:bg-red-50 dark:border-white/10 dark:text-red-300 dark:hover:bg-red-400/10"
            onClick={() => runAction(onSignOut)}
          >
            <LogOut size={17} />
            Sair
          </button>
        </div>
      ) : null}
    </div>
  );
}
