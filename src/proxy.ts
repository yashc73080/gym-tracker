import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static assets and the token-authenticated API routes (they do their own auth).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/import|api/mcp|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
