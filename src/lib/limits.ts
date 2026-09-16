/**
 * 일일 분석 한도 (투표 기간 9/21~10/5 비용 보호).
 *
 * 분석 1건 = 세션 1개 업로드이므로, "오늘(서울 기준) 만들어진 sessions 수"를
 * 전체·사용자별로 센다. 태깅(LLM 비용)의 입구가 업로드라서 여기 하나면 충분하다.
 *
 * 기본값은 코드에 있고 env로 조절한다 (Vercel 재배포 없이 바꾸려면 env 수정 후
 * Redeploy). 카운트 조회가 실패하면 막지 않고 통과시킨다 — 심사 기간에
 * 일시 오류로 심사위원을 차단하는 쪽이 더 큰 손실이다.
 */
import type { Db } from "./supabase/server";

const DEFAULT_TOTAL_PER_DAY = 30;
const DEFAULT_PER_USER_PER_DAY = 5;

function limit(envName: string, fallback: number): number {
  const raw = Number(process.env[envName]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

/** 오늘 서울 자정의 ISO 시각 (created_at 비교 기준). */
export function seoulDayStartIso(now: Date = new Date()): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
  }).format(now); // "YYYY-MM-DD"
  return `${day}T00:00:00+09:00`;
}

export interface LimitResult {
  allowed: boolean;
  /** 사용자에게 그대로 보여줄 한국어 사유. */
  reason?: string;
}

export async function checkDailyLimit(
  db: Db,
  userId: string,
): Promise<LimitResult> {
  const since = seoulDayStartIso();
  const totalLimit = limit("BLOG_DAILY_LIMIT_TOTAL", DEFAULT_TOTAL_PER_DAY);
  const userLimit = limit("BLOG_DAILY_LIMIT_USER", DEFAULT_PER_USER_PER_DAY);

  const [total, mine] = await Promise.all([
    db
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    db
      .from("sessions")
      .select("id, projects!inner(owner_id)", { count: "exact", head: true })
      .gte("created_at", since)
      .eq("projects.owner_id", userId),
  ]);

  // 조회 실패 시 통과 (가용성 우선 — 파일 상단 주석 참고).
  if (total.error || mine.error) return { allowed: true };

  if ((mine.count ?? 0) >= userLimit) {
    return {
      allowed: false,
      reason: `오늘의 개인 분석 한도(${userLimit}회)에 도달했습니다. 내일 다시 시도해주세요.`,
    };
  }
  if ((total.count ?? 0) >= totalLimit) {
    return {
      allowed: false,
      reason: "오늘의 전체 분석 한도에 도달했습니다. 내일 다시 시도해주세요.",
    };
  }
  return { allowed: true };
}
