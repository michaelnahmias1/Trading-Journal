"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InstallApp } from "@/components/InstallApp";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Strategy } from "@/lib/types";

const field =
  "bg-surface-2 border border-border rounded-md px-3 py-2 outline-none focus:border-accent text-sm w-full";
const labelCls = "block text-xs text-muted mb-1";

export function SettingsClient({
  profile,
  strategies,
}: {
  profile: Profile | null;
  strategies: Strategy[];
}) {
  const router = useRouter();

  const [usd, setUsd] = useState(String(profile?.initial_capital_usd ?? 0));
  const [ils, setIls] = useState(String(profile?.initial_capital_ils ?? 0));
  const [commission, setCommission] = useState(String(profile?.default_commission ?? 0));
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [newSetup, setNewSetup] = useState("");
  const [setupErr, setSetupErr] = useState<string | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      initial_capital_usd: Number(usd) || 0,
      initial_capital_ils: Number(ils) || 0,
      default_commission: Number(commission) || 0,
    });
    setSavingProfile(false);
    setProfileMsg(error ? error.message : "נשמר.");
    router.refresh();
  }

  async function addSetup(e: React.FormEvent) {
    e.preventDefault();
    setSetupErr(null);
    if (!newSetup.trim()) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("strategies")
      .insert({ user_id: user.id, name: newSetup.trim() });
    if (error) {
      setSetupErr(error.message);
      return;
    }
    setNewSetup("");
    router.refresh();
  }

  async function deleteSetup(id: string) {
    const supabase = createClient();
    await supabase.from("strategies").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold">הגדרות</h1>

      <InstallApp />

      <form onSubmit={saveProfile} className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-sm uppercase tracking-wide text-muted">ערך התיק ועמלות</h2>
        <p className="text-muted text-sm">
          כמה מזומן יש בתיק בכל מטבע. זהו בסיס החישוב של שווי התיק בלוח הבקרה — אליו מתווספים
          הרווחים וההפסדים.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>מזומן בתיק — דולרים ($)</label>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              className={field}
              value={usd}
              onChange={(e) => setUsd(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>מזומן בתיק — שקלים (₪)</label>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              className={field}
              value={ils}
              onChange={(e) => setIls(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>עמלת ברירת מחדל לכל צד</label>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              className={field}
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={savingProfile}
            className="bg-accent text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {savingProfile ? "שומר…" : "שמירה"}
          </button>
          {profileMsg && <span className="text-muted text-sm">{profileMsg}</span>}
        </div>
      </form>

      <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-sm uppercase tracking-wide text-muted">סטאפים</h2>
        {strategies.length === 0 ? (
          <p className="text-muted text-sm">עדיין אין סטאפים.</p>
        ) : (
          <ul className="space-y-2">
            {strategies.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between bg-surface-2 rounded-md px-3 py-2 text-sm"
              >
                <span>{s.name}</span>
                <button
                  onClick={() => deleteSetup(s.id)}
                  className="text-muted hover:text-neg text-xs"
                >
                  מחיקה
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addSetup} className="flex items-center gap-2">
          <input
            className={field}
            value={newSetup}
            onChange={(e) => setNewSetup(e.target.value)}
            placeholder="לדוגמה: פריצה, פולבק…"
          />
          <button
            type="submit"
            className="bg-accent text-white rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap"
          >
            הוספה
          </button>
        </form>
        {setupErr && <p className="text-neg text-sm">{setupErr}</p>}
      </div>
    </div>
  );
}
