// Instant, correctly-shaped placeholder for the trades screen so navigation
// feels immediate instead of waiting on the server render.
export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-28 rounded-md bg-surface-2" />
        <div className="h-9 w-32 rounded-md bg-surface-2" />
      </div>
      <div className="h-9 w-48 rounded-lg bg-surface-2" />
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-6 rounded bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
