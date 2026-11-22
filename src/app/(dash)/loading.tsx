export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading data from the sheet…</span>
      <div className="mb-4 h-7 w-56 rounded bg-line" />
      <div className="mb-5 h-16 rounded-xl bg-surface ring-1 ring-line" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-36 rounded-xl bg-surface ring-1 ring-line" />
        ))}
      </div>
      <div className="mt-6 h-72 rounded-xl bg-surface ring-1 ring-line" />
    </div>
  );
}
