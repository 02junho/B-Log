export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
        B-Log · Build-Log
      </p>
      <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
        AI를 어떻게 지휘했는지, 과정으로 증명하세요.
      </h1>
      <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        AI 코딩 세션 로그와 Git 커밋을 분석해 공유 가능한 과정 포트폴리오를
        만듭니다. 어떤 AI 도구를 썼는지는 상관없습니다.
      </p>
      <p className="rounded-full border border-zinc-200 px-4 py-1 text-sm text-zinc-500 dark:border-zinc-800">
        원티드 AI Championship 2026 · 개발 중
      </p>
    </main>
  );
}
