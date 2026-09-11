import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  isPortfolioSlug,
  portfolioDisplaySchema,
} from "@/lib/portfolio/presentation";
import { PortfolioView } from "@/components/portfolio-view";
import { SiteHeader } from "@/components/site-header";
import sample from "../../../../fixtures/portfolio.sample.json";

export const dynamic = "force-dynamic";
const loadPortfolio = cache(async (slug: string) => {
  if (slug === sample.slug)
    return { view: portfolioDisplaySchema.parse(sample), demo: true };
  if (!isPortfolioSlug(slug)) notFound();
  const db = getSupabaseServerClient();
  if (!db) throw new Error("Portfolio service unavailable");
  const { data, error } = await db
    .from("portfolios")
    .select("view")
    .eq("slug", slug)
    .not("published_at", "is", null)
    .maybeSingle();
  if (error) throw new Error("Portfolio could not be loaded");
  if (!data) notFound();
  const parsed = portfolioDisplaySchema.safeParse(data.view);
  if (!parsed.success) throw new Error("Portfolio format unavailable");
  return { view: parsed.data, demo: false };
});
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { view, demo } = await loadPortfolio((await params).slug);
  return {
    title: `${view.title} | B-Log`,
    description: "AI와 협업한 판단과 실행의 과정을 살펴보세요.",
    ...(demo ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: view.title,
      description: "결과 너머, 만들어 온 과정까지. B-Log 과정 포트폴리오",
      type: "article",
    },
  };
}
export default async function PublicPortfolio({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const result = await loadPortfolio((await params).slug);
  return (
    <>
      <SiteHeader />
      <PortfolioView {...result} />
    </>
  );
}
