"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { toast } from "@/stores/toastStore";
import { Button } from "@/components/ui/Button";

/**
 * Storage backend status. Without Supabase env vars, projects stay in this
 * browser. With them, users can sign in by email magic link to use cloud projects.
 */
export function StoragePanel() {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    void client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!configured) {
    return (
      <div className="rounded-2xl border border-line bg-panel p-5">
        <p className="text-sm font-semibold">التخزين المحلي (مفعل)</p>
        <p className="mt-1 text-sm text-muted">
          تحفظ المشاريع في هذا المتصفح. لتفعيل الحسابات والحفظ السحابي يلزم ضبط{" "}
          <code dir="ltr" className="font-mono text-xs text-fg">NEXT_PUBLIC_SUPABASE_URL</code> و{" "}
          <code dir="ltr" className="font-mono text-xs text-fg">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> وتطبيق{" "}
          <code dir="ltr" className="font-mono text-xs text-fg">supabase/migrations/0001_projects.sql</code>.
        </p>
      </div>
    );
  }

  const client = getSupabaseClient()!;
  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/setup` },
    });
    setSending(false);
    if (error) toast.error(error.message);
    else toast.success("أرسل رابط الدخول إلى البريد الإلكتروني.");
  };

  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <p className="text-sm font-semibold">التخزين السحابي Supabase (معد)</p>
      {session ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            تم الدخول بالحساب <span dir="ltr" className="text-fg">{session.user.email}</span>. يحفظ كل جديد في السحابة.
          </p>
          <Button size="sm" onClick={() => void client.auth.signOut()}>
            تسجيل الخروج
          </Button>
        </div>
      ) : (
        <form onSubmit={signIn} className="mt-3 flex flex-wrap gap-2">
          <label htmlFor="signin-email" className="sr-only">
            البريد الإلكتروني
          </label>
          <input
            id="signin-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            dir="ltr"
            className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-panel-2 px-3 text-sm"
          />
          <Button type="submit" variant="primary" disabled={sending}>
            {sending ? "جار الإرسال…" : "إرسال رابط الدخول"}
          </Button>
          <p className="w-full text-xs text-muted">قبل تسجيل الدخول تحفظ المشاريع في هذا المتصفح.</p>
        </form>
      )}
    </div>
  );
}
