import { SiteHeader } from "@/components/site-header";
export default function Loading() {
  return (
    <>
      <SiteHeader />
      <main
        id="main-content"
        className="portfolio-shell loading-shell"
        aria-busy="true"
      >
        <p role="status">작업 기록을 불러오고 있어요.</p>
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-stats" />
        <div className="stage-grid">
          {[1, 2, 3, 4].map((n) => (
            <div className="skeleton skeleton-card" key={n} />
          ))}
        </div>
      </main>
    </>
  );
}
