"use client";

import { useActionState, useState } from "react";
import { authenticate, signInWithGoogle } from "./actions";

export default function LoginPage() {
  const [message, action, pending] = useActionState(authenticate, null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-3xl font-bold">Gym Tracker</h1>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="mode" value={mode} />
        <input name="email" type="email" placeholder="Email" autoComplete="email" required />
        <input
          name="password"
          type="password"
          placeholder="Password (8+ characters)"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
        />
        {message && <p className="text-sm text-red-400">{message}</p>}
        <button
          disabled={pending}
          className="rounded-xl bg-accent py-3 font-semibold text-black disabled:opacity-60"
        >
          {pending ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
      <form action={signInWithGoogle}>
        <button className="w-full rounded-xl bg-card2 py-3 font-semibold">Continue with Google</button>
      </form>
      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="text-sm text-muted"
      >
        {mode === "signin" ? "No account? Create one" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
