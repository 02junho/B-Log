/**
 * 임시 토큰 가드 (OAuth 전까지의 비용 보호).
 *
 * 비용이 드는 라우트(upload, jobs/run)는 `x-blog-token` 헤더가
 * `BLOG_API_TOKEN` 환경변수와 일치해야 통과한다.
 * - 환경변수가 없으면 전부 거부한다(fail-closed). 배포에 변수 넣는 걸
 *   잊어도 열리는 사고가 없게.
 * - 토큰은 서버·curl·팀원 로컬용이다. 브라우저에 노출하지 말 것 —
 *   웹 화면 연결은 Step 7의 GitHub OAuth가 이 가드를 대체한 뒤에 한다.
 */
import { timingSafeEqual } from "node:crypto";

export function checkApiToken(request: Request): Response | null {
  const expected = process.env.BLOG_API_TOKEN;
  const given = request.headers.get("x-blog-token") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected ?? "");
  const ok =
    Boolean(expected) && a.length === b.length && timingSafeEqual(a, b);
  if (ok) return null;
  return Response.json(
    { error: expected ? "invalid token" : "BLOG_API_TOKEN not configured" },
    { status: 401 },
  );
}
