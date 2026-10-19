import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Landing spot when a session is no longer valid (e.g. the account was deleted):
// clear the auth cookies, then show the login page.
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut().catch(() => {});
  return NextResponse.redirect(new URL("/login", request.url));
}
