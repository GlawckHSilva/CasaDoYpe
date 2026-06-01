export default function EmptyState({ title, text, action }) {
  return (
    <div className="rounded-md border border-dashed border-ink/20 bg-white p-6 text-center text-ink dark:border-white/15 dark:bg-slate-900 dark:text-white">
      <p className="font-black">{title}</p>
      {text ? <p className="mt-2 text-sm text-ink/60 dark:text-white/60">{text}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
