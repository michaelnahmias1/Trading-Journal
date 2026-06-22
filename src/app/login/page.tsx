"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const supabase = createClient();

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setNotice("החשבון נוצר. אשרו את המייל ואז התחברו.");
          setMode("signin");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "משהו השתבש");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold mb-1">יומן מסחר</h1>
        <p className="text-muted text-sm mb-6">מראה לתוצאות שלך — נטו, אחרי מס.</p>

        <form onSubmit={onSubmit} className="bg-surface border border-border rounded-xl p-5 space-y-4">
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 py-1.5 rounded-md ${
                mode === "signin" ? "bg-surface-2 text-text" : "text-muted"
              }`}
            >
              התחברות
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-1.5 rounded-md ${
                mode === "signup" ? "bg-surface-2 text-text" : "text-muted"
              }`}
            >
              הרשמה
            </button>
          </div>

          <label className="block text-sm">
            <span className="text-muted">אימייל</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full bg-surface-2 border border-border rounded-md px-3 py-2 outline-none focus:border-accent"
            />
          </label>

          <label className="block text-sm">
            <span className="text-muted">סיסמה</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full bg-surface-2 border border-border rounded-md px-3 py-2 outline-none focus:border-accent"
            />
          </label>

          {error && <p className="text-neg text-sm">{error}</p>}
          {notice && <p className="text-accent text-sm">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-accent text-white rounded-md py-2 font-medium disabled:opacity-60"
          >
            {busy ? "…" : mode === "signin" ? "התחברות" : "יצירת חשבון"}
          </button>
        </form>
      </div>
    </main>
  );
}
