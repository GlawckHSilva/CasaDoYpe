import React from 'react';
import { ClipboardList } from 'lucide-react';

export default function EmptyState({ title, text, action }) {
  return (
    <div className="grid justify-items-center rounded-md border border-dashed border-sky-200 bg-gradient-to-br from-white to-sky-50/70 p-6 text-center text-ink shadow-sm dark:border-sky-400/20 dark:from-slate-900 dark:to-slate-900 dark:text-white">
      <span className="grid h-11 w-11 place-items-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-200">
        <ClipboardList size={20} aria-hidden="true" />
      </span>
      <p className="mt-3 font-black">{title}</p>
      {text ? <p className="mt-2 max-w-xl text-sm leading-6 text-ink/60 dark:text-white/65">{text}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
