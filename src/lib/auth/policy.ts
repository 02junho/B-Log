export function loginDestination(value: unknown): string {
  if (typeof value !== "string") return "/new";
  return value === "/new" || /^\/sessions\/[0-9a-f-]{36}\/review$/i.test(value)
    ? value
    : "/new";
}
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const given = new URL(origin);
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers
      .get("x-forwarded-host")
      ?.split(",")[0]
      ?.trim();
    const host =
      forwardedHost || request.headers.get("host") || requestUrl.host;
    const forwardedProtocol = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim();
    const protocol = forwardedProtocol
      ? `${forwardedProtocol}:`
      : requestUrl.protocol;
    return given.protocol === protocol && given.host === host;
  } catch {
    return false;
  }
}
export function isOwner(
  ownerId: string | null | undefined,
  userId: string,
): boolean {
  return Boolean(ownerId && userId && ownerId === userId);
}

/** Injectable identity lookup lets security behavior be tested without live credentials. */
export async function authenticateRequest(
  request: Request,
  lookup: () => Promise<{ id: string } | null>,
): Promise<{ userId: string } | Response> {
  if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request)) {
    return Response.json({ error: "invalid request origin" }, { status: 403 });
  }
  try {
    const user = await lookup();
    if (user?.id) return { userId: user.id };
    return Response.json({ error: "login required" }, { status: 401 });
  } catch {
    return Response.json(
      { error: "authentication unavailable" },
      { status: 503 },
    );
  }
}
