import React, { useState } from 'react';
import { Bell, Headset, Home, LogOut, Settings, User } from 'lucide-react';

export default function UserMenu({ authProfile, menuItems = [], onNavigate, onSignOut, onOpenSupport, onOpenSettings }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex items-center gap-2">
      <button type="button" className="brand-icon-button hidden sm:inline-grid" onClick={onOpenSupport} aria-label="Suporte" title="Suporte">
        <Headset size={18} />
      </button>
      <button type="button" className="brand-icon-button hidden sm:inline-grid" onClick={onOpenSettings} aria-label="Configurações" title="Configurações">
        <Settings size={18} />
      </button>
      <button type="button" className="brand-icon-button hidden sm:inline-grid" onClick={() => setOpen((current) => !current)} aria-label="Notificações" title="Notificações">
        <Bell size={18} />
      </button>
      <button type="button" className="brand-icon-button" onClick={() => setOpen((current) => !current)} aria-label="Abrir menu do usuário" title="Perfil">
        <User size={19} />
      </button>
      {open ? (
        <div className="absolute right-0 top-full mt-2 w-[min(18rem,calc(100vw-1rem))] overflow-hidden rounded-md bg-white text-ink shadow-soft ring-1 ring-ink/10 dark:bg-slate-900 dark:text-white dark:ring-white/10">
          <div className="border-b border-ink/10 px-4 py-3 text-sm dark:border-white/10">
            <p className="font-black">{authProfile?.full_name || 'Usuário'}</p>
            <p className="truncate text-xs text-ink/55 dark:text-white/55">{authProfile?.email}</p>
          </div>
          {menuItems.map(([label, action, Icon]) => (
            <button
              key={label}
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold hover:bg-mist dark:hover:bg-white/5"
              onClick={() => {
                action();
                setOpen(false);
              }}
            >
              <Icon size={17} className="text-leaf dark:text-blue-300" />
              {label}
            </button>
          ))}
          <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold hover:bg-mist dark:hover:bg-white/5" onClick={() => onNavigate('/casas')}>
            <Home size={17} className="text-leaf dark:text-blue-300" />
            Ver hospedagens
          </button>
          <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-400/10" onClick={onSignOut}>
            <LogOut size={17} />
            Sair
          </button>
        </div>
      ) : null}
    </div>
  );
}
