import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/health
 * - app: 서버가 살아 있는지
 * - supabase: 환경변수가 설정되어 있고 실제로 응답하는지
 * 심사 기간 UptimeRobot이 이 엔드포인트를 5분마다 호출한다 (Step 11).
 */
export async function GET() {
  const supabase = getSupabaseServerClient();

  let supabaseStatus: "ok" | "not-configured" | "error" = "not-configured";
  let supabaseError: string | undefined;

  if (supabase) {
    // 테이블이 아직 없어도 동작하도록 auth 설정 조회로 연결만 확인한다.
    const { error } = await supabase.auth.getSession();
    if (error) {
      supabaseStatus = "error";
      supabaseError = error.message;
    } else {
      supabaseStatus = "ok";
    }
  }

  const healthy = supabaseStatus !== "error";

  return Response.json(
    {
      app: "ok",
      supabase: supabaseStatus,
      ...(supabaseError ? { supabaseError } : {}),
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
