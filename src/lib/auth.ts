import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user's id, or redirect to /login. Every query filters by it.
 * Uses getUser() (asks Supabase Auth) rather than trusting the token alone, so a session for a
 * deleted account is rejected instead of failing later on a foreign-key error.
 */
// cache(): the layout and page both call this in one request; ask Supabase once.
export const requireUserId = cache(async (): Promise<string> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return data.user.id;
});
