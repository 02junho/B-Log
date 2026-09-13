import { NextResponse } from "next/server";
import { getAuthClient } from "@/lib/supabase/auth";
import { sameOrigin } from "@/lib/auth/policy";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return new Response("Invalid origin", { status: 403 });
  try {
    const auth = await getAuthClient();
    if (!auth)
      return NextResponse.redirect(
        new URL("/login?error=logout", request.url),
        303,
      );
    const { error } = await auth.auth.signOut({ scope: "local" });
    if (error)
      return NextResponse.redirect(
        new URL("/login?error=logout", request.url),
        303,
      );
    return NextResponse.redirect(new URL("/", request.url), 303);
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=logout", request.url),
      303,
    );
  }
}
