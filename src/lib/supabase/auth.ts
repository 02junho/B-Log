import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Auth uses the public key and HttpOnly cookies, never the service-role key. */
export async function getAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const store = await cookies();
  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          /* Server Components are read-only; Proxy refreshes before rendering. */
        }
      },
    },
  });
}
export async function getAuthUser() {
  const auth = await getAuthClient();
  if (!auth) return null;
  const { data, error } = await auth.auth.getClaims();
  const id = data?.claims?.sub;
  return error || typeof id !== "string" ? null : { id };
}
