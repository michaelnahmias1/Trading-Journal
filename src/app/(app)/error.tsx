"use client";

import { useEffect } from "react";

// App-group error boundary. Without it, a client-side exception anywhere under
// (app) renders Next's bare "Application error" white screen. Here we catch it,
// log it for the console, and give the user a way to recover in place.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real cause in the browser console for diagnosis.
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="bg-surface border border-border rounded-xl p-6 max-w-sm w-full text-center space-y-4">
        <h2 className="text-lg font-semibold">משהו השתבש</h2>
        <p className="text-muted text-sm">
          אירעה שגיאה בטעינת המסך. אפשר לנסות שוב.
        </p>
        {/* Show the real error so it can be screenshotted on mobile (no console
            access). This is the user's own private app, so it's safe here. */}
        <pre
          dir="ltr"
          className="text-start text-neg text-xs bg-surface-2 border border-border rounded-md p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words"
        >
          {error?.name ? `${error.name}: ` : ""}
          {error?.message || "Unknown error"}
          {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={reset}
            className="bg-accent text-white rounded-md px-4 py-2 text-sm font-medium"
          >
            נסה שוב
          </button>
          <button
            onClick={() => window.location.reload()}
            className="text-muted text-sm px-3 py-2"
          >
            רענון הדף
          </button>
        </div>
      </div>
    </div>
  );
}
