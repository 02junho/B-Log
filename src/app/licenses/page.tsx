import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "오픈소스 라이선스 | B-Log",
  description: "B-Log가 사용하는 오픈소스와 외부 서비스 목록입니다.",
};

/** 버전은 배포 시점 package.json 기준. 대회 규정(오픈소스·API 라이선스 준수) 대응 페이지. */
const OSS: { name: string; version: string; license: string; url: string }[] = [
  { name: "Next.js", version: "16.3.4", license: "MIT", url: "https://github.com/vercel/next.js" },
  { name: "React / React DOM", version: "19.2.8", license: "MIT", url: "https://github.com/facebook/react" },
  { name: "Vercel AI SDK (ai)", version: "7.0.94", license: "Apache-2.0", url: "https://github.com/vercel/ai" },
  { name: "@ai-sdk/openai-compatible", version: "3.0.45", license: "Apache-2.0", url: "https://github.com/vercel/ai" },
  { name: "@supabase/supabase-js", version: "2.115.0", license: "MIT", url: "https://github.com/supabase/supabase-js" },
  { name: "@supabase/ssr", version: "0.12.7", license: "MIT", url: "https://github.com/supabase/ssr" },
  { name: "Zod", version: "4.5.4", license: "MIT", url: "https://github.com/colinhacks/zod" },
  { name: "Tailwind CSS", version: "4.x", license: "MIT", url: "https://github.com/tailwindlabs/tailwindcss" },
];

const FONTS = [
  { name: "Pretendard", license: "SIL OFL 1.1", url: "https://github.com/orioncactus/pretendard" },
  { name: "Geist / Geist Mono", license: "SIL OFL 1.1", url: "https://vercel.com/font" },
  { name: "Noto Sans KR (OG 이미지)", license: "SIL OFL 1.1", url: "https://fonts.google.com/noto" },
];

const SERVICES = [
  { name: "Upstage Solar Pro 4 API", note: "세션 로그 4단계 분석·마스킹 검출 (이용약관 준수)", url: "https://www.upstage.ai" },
  { name: "Supabase", note: "데이터베이스 · 인증 · 저장소", url: "https://supabase.com" },
  { name: "Vercel", note: "호스팅 · 배포", url: "https://vercel.com" },
  { name: "GitHub REST API", note: "공개 저장소 커밋 조회 · OAuth 로그인", url: "https://docs.github.com/rest" },
];

export default function LicensesPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="licenses-page">
        <span className="eyebrow">OPEN SOURCE</span>
        <h1>오픈소스 라이선스</h1>
        <p className="upload-lede">
          B-Log는 아래 오픈소스와 외부 서비스 위에서 만들어졌습니다. 각 소프트웨어의
          라이선스 전문은 링크된 저장소에서 확인할 수 있습니다.
        </p>

        <h2>라이브러리</h2>
        <ul className="license-list">
          {OSS.map((item) => (
            <li key={item.name}>
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                {item.name}
              </a>
              <span>{item.version}</span>
              <code>{item.license}</code>
            </li>
          ))}
        </ul>

        <h2>글꼴</h2>
        <ul className="license-list">
          {FONTS.map((item) => (
            <li key={item.name}>
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                {item.name}
              </a>
              <span />
              <code>{item.license}</code>
            </li>
          ))}
        </ul>

        <h2>외부 서비스</h2>
        <ul className="license-list">
          {SERVICES.map((item) => (
            <li key={item.name}>
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                {item.name}
              </a>
              <span>{item.note}</span>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
