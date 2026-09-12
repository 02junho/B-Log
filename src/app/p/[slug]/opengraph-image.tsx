import { ImageResponse } from "next/og";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  isPortfolioSlug,
  portfolioDisplaySchema,
} from "@/lib/portfolio/presentation";
import { notoSansKr } from "@/lib/og/font";
import sample from "../../../../fixtures/portfolio.sample.json";

export const alt = "B-Log 과정 포트폴리오";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type OgData = {
  title: string;
  fidelity: string;
  events: number;
  toolCalls: number;
  commits: number;
};

async function loadOgData(slug: string): Promise<OgData | null> {
  if (slug === sample.slug) {
    const view = portfolioDisplaySchema.parse(sample);
    return {
      title: view.title,
      fidelity: view.fidelity,
      events: view.stats.events,
      toolCalls: view.stats.toolCalls,
      commits: view.stats.commits,
    };
  }
  if (!isPortfolioSlug(slug)) return null;
  const db = getSupabaseServerClient();
  if (!db) return null;
  const { data } = await db
    .from("portfolios")
    .select("view")
    .eq("slug", slug)
    .not("published_at", "is", null)
    .maybeSingle();
  if (!data) return null;
  const parsed = portfolioDisplaySchema.safeParse(data.view);
  if (!parsed.success) return null;
  return {
    title: parsed.data.title,
    fidelity: parsed.data.fidelity,
    events: parsed.data.stats.events,
    toolCalls: parsed.data.stats.toolCalls,
    commits: parsed.data.stats.commits,
  };
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = (await loadOgData(slug)) ?? {
    title: "B-Log 과정 포트폴리오",
    fidelity: "structured",
    events: 0,
    toolCalls: 0,
    commits: 0,
  };
  const badge = data.fidelity === "structured" ? "정밀 분석" : "요약 분석";
  const statLine = `이벤트 ${data.events} · 도구 호출 ${data.toolCalls} · 커밋 ${data.commits}`;
  const font = await notoSansKr(
    `${data.title}${badge}${statLine}A BUILD STORY0123456789`,
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 96px",
          background: "#f4f4ef",
          color: "#1f2a1e",
          fontFamily: "NotoSansKR",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "#2f4d2f",
                color: "#f4f4ef",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
              }}
            >
              b·
            </div>
            <div style={{ fontSize: 34 }}>B-Log</div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              padding: "10px 22px",
              borderRadius: 999,
              background: "rgba(47,77,47,0.12)",
              color: "#2f4d2f",
            }}
          >
            {badge}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 24, letterSpacing: 6, color: "#5f6b5d", marginBottom: 14 }}>
            A BUILD STORY
          </div>
          <div style={{ fontSize: 54, lineHeight: 1.3, maxWidth: 1000 }}>
            {data.title.length > 40 ? `${data.title.slice(0, 40)}…` : data.title}
          </div>
        </div>
        <div style={{ fontSize: 28, color: "#5f6b5d" }}>{statLine}</div>
      </div>
    ),
    { ...size, fonts: [{ name: "NotoSansKR", data: font, weight: 700, style: "normal" }] },
  );
}
