// Instant, correctly-shaped placeholder for the setups screen.
export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-28 rounded-md bg-surface-2" />
        <div className="h-9 w-32 rounded-md bg-surface-2" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-surface border border-border" />
        ))}
      </div>
    </div>
  );
}
