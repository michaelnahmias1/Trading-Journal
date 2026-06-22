"use client";

import { useEffect, useState } from "react";

// Captures the browser's install prompt and exposes an explicit
// "התקן למסך הבית" button, so the journal can be added to the home screen and
// run like a native app. Also registers the service worker (required for the
// Android install prompt) and shows iOS-specific instructions where there is no
// programmatic prompt.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallApp() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    // Register the service worker (best-effort).
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    setInstalled(isStandalone());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-sm uppercase tracking-wide text-muted mb-1">האפליקציה מותקנת</h2>
        <p className="text-muted text-sm">היומן רץ כאפליקציה עצמאית מהמסך הבית. אפשר להמשיך לעבוד.</p>
      </div>
    );
  }

  async function install() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      return;
    }
    if (isIos()) setShowIosHelp((v) => !v);
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm uppercase tracking-wide text-muted mb-1">התקנה למסך הבית</h2>
          <p className="text-muted text-sm">
            התקינו את היומן כאפליקציה — אייקון משלו, פתיחה במסך מלא ותחושה של אפליקציה רגילה.
          </p>
        </div>
        <button
          onClick={install}
          className="bg-accent text-white rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap"
        >
          התקנה
        </button>
      </div>

      {showIosHelp && (
        <div className="text-sm text-muted bg-surface-2 rounded-md p-3 leading-relaxed">
          באייפון: הקישו על כפתור השיתוף{" "}
          <span className="text-text">⬆️</span> בתחתית הדפדפן, ואז בחרו{" "}
          <span className="text-text">״הוסף למסך הבית״</span>.
        </div>
      )}

      {!deferred && !isIos() && (
        <p className="text-xs text-muted">
          אם הכפתור לא מגיב — פתחו את תפריט הדפדפן ובחרו ״התקן אפליקציה״ / ״הוסף למסך הבית״.
        </p>
      )}
    </div>
  );
}
