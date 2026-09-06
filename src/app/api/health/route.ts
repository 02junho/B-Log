import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/health
 * - app: 서버가 살아 있는지
 * - supabase: 환경변수가 설정되어 있고 실제로 응답하는지
 * 심사 기간 UptimeRobot이 이 엔드포인트를 5분마다 호출한다 (Step 11).
 */
export async function GET() {
  const supabase = getSupabaseServerClient();

  let supabaseStatus: "ok" | "no-schema" | "not-configured" | "error" =
    "not-configured";
  let supabaseError: string | undefined;

  if (supabase) {
    // 실제 DB 쿼리를 날려야 Supabase 무료 티어의 "7일 비활성 일시정지" 타이머가 리셋된다.
    // heartbeat 테이블은 첫 마이그레이션에서 만든다. 그 전에는 "relation does not exist"를
    // 연결은 됐지만 스키마가 없는 상태로 취급한다.
    const { error } = await supabase.from("heartbeat").select("id").limit(1);
    if (!error) {
      supabaseStatus = "ok";
    } else if (error.code === "42P01" || error.code === "PGRST205") {
      supabaseStatus = "no-schema";
    } else {
      supabaseStatus = "error";
      supabaseError = error.message;
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
