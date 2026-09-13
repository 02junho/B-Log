import { NextResponse } from "next/server";
import { getAuthClient } from "@/lib/supabase/auth";
import { loginDestination } from "@/lib/auth/policy";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = loginDestination(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  try {
    const auth = await getAuthClient();
    if (auth && code && !url.searchParams.has("error")) {
      const { error } = await auth.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, request.url), 303);
    }
  } catch {
    /* Do not expose provider error details or authorization codes. */
  }
  return NextResponse.redirect(
    new URL(`/login?error=login&next=${encodeURIComponent(next)}`, request.url),
    303,
  );
}
