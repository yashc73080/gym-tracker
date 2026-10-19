"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function authenticate(_prev: string | null, formData: FormData): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const mode = formData.get("mode") === "signup" ? "signup" : "signin";
  if (!email || password.length < 8) return "Enter an email and a password of at least 8 characters.";

  const supabase = await createClient();
  if (mode === "signup") {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
    if (!data.session) return "Account created. Check your email to confirm, then sign in.";
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
  }
  redirect("/library");
}

export async function signInWithGoogle() {
  // Build the return address from the host this request actually came in on (works on Vercel and locally).
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const supabase = await createClient();
  // Start from a clean slate so a leftover session can't interfere with the OAuth exchange.
  await supabase.auth.signOut().catch(() => {});
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
