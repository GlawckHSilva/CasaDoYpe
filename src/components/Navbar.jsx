import React from 'react';

export default function NavbarShell({ transparent = false, brand, nav, themeToggle, account }) {
  return (
    <header
      className={`sticky top-0 z-30 border-b backdrop-blur ${
        transparent ? 'border-white/15 bg-ink/75 text-white' : 'border-ink/10 bg-white/95 text-ink shadow-sm dark:border-white/10 dark:bg-slate-950/95 dark:text-white'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        {brand}
        {nav}
        <div className="flex items-center gap-2">
          {themeToggle}
          {account}
        </div>
      </div>
    </header>
  );
}
