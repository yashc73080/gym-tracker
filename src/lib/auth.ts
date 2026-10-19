import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user's id (verified JWT claims), or redirect to /login. Every query filters by it. */
export async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) redirect("/login");
  return id;
}
