import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getAuthUser } from "@/lib/supabase/auth";
import { loginDestination } from "@/lib/auth/policy";
export const metadata = {
  title: "로그인 | B-Log",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const query = await searchParams;
  const next = loginDestination(query.next);
  if (!query.error && (await getAuthUser())) redirect(next);
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="upload-page">
        <h1>내 작업 기록을 시작하세요.</h1>
        <p className="upload-lede">
          GitHub로 로그인하면 로그를 분석하고, 공개 전에 나만 볼 수 있는
          화면에서 결과를 검수할 수 있습니다.
        </p>
        {query.error && (
          <p role="alert">
            {query.error === "logout"
              ? "로그아웃을 완료하지 못했습니다. 다시 시도해주세요."
              : "로그인을 완료하지 못했습니다. 다시 시도해주세요."}
          </p>
        )}
        {query.error === "logout" ? (
          <form action="/auth/logout" method="post">
            <button className="button button-dark">로그아웃 다시 시도</button>
          </form>
        ) : (
          <form action="/auth/login" method="post">
            <input type="hidden" name="next" value={next} />
            <button className="button button-dark">GitHub로 로그인</button>
          </form>
        )}
      </main>
    </>
  );
}
