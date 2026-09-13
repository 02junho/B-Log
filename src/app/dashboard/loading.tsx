import { SiteHeader } from "@/components/site-header";

export default function DashboardLoading() {
  return (
    <>
      <SiteHeader authenticated />
      <main id="main-content" className="dashboard-page" aria-busy="true">
        <section className="dashboard-hero dashboard-loading-hero">
          <div><span className="eyebrow">MY BUILD LOG</span><h1>작업공간을 불러오는 중입니다.</h1></div>
        </section>
        <div className="dashboard-grid" aria-hidden="true">
          {[0, 1, 2].map((item) => <div className="dashboard-card dashboard-skeleton" key={item} />)}
        </div>
      </main>
    </>
  );
}
