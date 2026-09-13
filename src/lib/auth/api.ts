import { getAuthUser } from "../supabase/auth";
import { authenticateRequest } from "./policy";

/** Cookie authentication only; the former shared x-blog-token grants no access. */
export async function authenticate(
  request: Request,
): Promise<{ userId: string } | Response> {
  return authenticateRequest(request, getAuthUser);
}
