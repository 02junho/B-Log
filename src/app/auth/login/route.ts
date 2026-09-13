import { NextResponse } from "next/server";
import { getAuthClient } from "@/lib/supabase/auth";
import { loginDestination, sameOrigin } from "@/lib/auth/policy";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return new Response("Invalid origin", { status: 403 });
  const form = await request.formData();
  const next = loginDestination(form.get("next"));
  const failure = new URL(
    `/login?error=login&next=${encodeURIComponent(next)}`,
    request.url,
  );
  try {
    const auth = await getAuthClient();
    if (!auth) return NextResponse.redirect(failure, 303);
    const callback = new URL("/auth/callback", request.url);
    callback.searchParams.set("next", next);
    const { data, error } = await auth.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
    });
    if (error || !data.url) return NextResponse.redirect(failure, 303);
    return NextResponse.redirect(data.url, 303);
  } catch {
    return NextResponse.redirect(failure, 303);
  }
}
