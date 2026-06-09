import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';

const sizeClasses = {
  xs: 'h-8 w-8',
  sm: 'h-10 w-10',
  md: 'h-12 w-12',
  lg: 'h-20 w-20',
  xl: 'h-28 w-28',
};

const iconSizes = {
  xs: 15,
  sm: 18,
  md: 22,
  lg: 34,
  xl: 44,
};

export default function UserAvatar({ profile, src, name, email, size = 'sm', className = '' }) {
  const avatarUrl = src || profile?.avatar_url || '';
  const label = name || profile?.full_name || email || profile?.email || 'Usuario';
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [avatarUrl]);

  return (
    <span
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-ink/10 bg-mist text-leaf shadow-sm dark:border-white/10 dark:bg-slate-800 dark:text-blue-200 ${sizeClasses[size] || sizeClasses.sm} ${className}`}
      aria-label={label}
      title={label}
    >
      {avatarUrl && !broken ? (
        <img
          src={avatarUrl}
          alt={`Foto de perfil de ${label}`}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
        />
      ) : (
        <User size={iconSizes[size] || iconSizes.sm} aria-hidden="true" />
      )}
    </span>
  );
}
