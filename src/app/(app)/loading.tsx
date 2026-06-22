// Shown instantly on navigation (Next streams it while the page data loads),
// so moving between screens feels immediate instead of frozen.
export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 rounded-md bg-surface-2" />
        <div className="h-9 w-56 rounded-lg bg-surface-2" />
      </div>
      <div className="h-28 rounded-xl bg-surface border border-border" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-surface border border-border" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-surface border border-border" />
    </div>
  );
}
