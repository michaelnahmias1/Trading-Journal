// Instant, correctly-shaped placeholder for the settings screen.
export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 w-32 rounded-md bg-surface-2" />
      <div className="h-40 rounded-xl bg-surface border border-border" />
      <div className="h-48 rounded-xl bg-surface border border-border" />
    </div>
  );
}
