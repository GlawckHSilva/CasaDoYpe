import React from 'react';

export default function NavbarShell({ transparent = false, brand, nav, themeToggle, account }) {
  return (
    <header className={`site-header sticky top-0 z-30 border-b backdrop-blur ${transparent ? 'site-header--transparent' : ''}`}>
      <div className="header-inner mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
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
