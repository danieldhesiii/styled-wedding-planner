"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Already signed in → straight to the workspace.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/clients");
    });
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setError(error.message);
        } else if (data.session) {
          router.replace("/clients");
        } else {
          // Email confirmation is enabled on this project — try an immediate
          // sign-in; if that fails, the planner needs to confirm by email.
          const { data: s, error: e2 } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (s.session) router.replace("/clients");
          else
            setNotice(
              e2?.message?.toLowerCase().includes("confirm")
                ? "Account created. Please confirm via the email we sent, then sign in."
                : "Account created — you can now sign in."
            );
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) setError(error.message);
        else if (data.session) router.replace("/clients");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center py-10">
      <h1 className="text-center font-serif text-3xl text-ink">
        {mode === "signin" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-1 text-center text-sm text-ink/55">
        Your wedding planning & design workspace
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block">
          <span className="text-sm text-ink/70">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-sand bg-white/80 px-3 py-2 text-ink outline-none focus:border-ink"
          />
        </label>
        <label className="block">
          <span className="text-sm text-ink/70">Password</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-sand bg-white/80 px-3 py-2 text-ink outline-none focus:border-ink"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-sage">{notice}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-ink py-3 text-cream hover:bg-ink/90 disabled:opacity-50"
        >
          {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
          setNotice(null);
        }}
        className="mt-4 text-center text-sm text-ink/55 hover:text-ink"
      >
        {mode === "signin"
          ? "New here? Create an account"
          : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
