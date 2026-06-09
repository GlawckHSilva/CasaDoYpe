import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingState({ label = 'Carregando...' }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f6f8fb] p-6 text-ink dark:bg-slate-950 dark:text-white">
      <div className="grid justify-items-center gap-3 text-center">
        <Loader2 className="animate-spin text-leaf dark:text-cyan-300" size={34} aria-hidden="true" />
        <p className="text-sm font-bold text-ink/60 dark:text-white/65">{label}</p>
      </div>
    </div>
  );
}
