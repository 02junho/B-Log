-- Core tables (TEAM_PLAN §3.2). P1이 초안 작성(9/9), P2 소유.
--
-- 원칙
-- - 전 테이블 RLS 켬 + 정책 없음 = 접근은 서버(service_role)만. heartbeat와 동일 패턴.
--   공개 포트폴리오도 서버 컴포넌트가 읽어 내려주므로 anon 정책이 필요 없다.
-- - enum 대신 text + check 제약: 마감까지 어휘가 바뀔 수 있어 ALTER TYPE보다 싸다.
-- - 자식 테이블은 ON DELETE CASCADE: 세션을 지우면 파생물이 함께 사라진다(개인정보 대응).

-- 업로드한 로그의 주인과 연결된 레포.
create table projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  name text not null,
  repo_url text,
  created_at timestamptz not null default now()
);

-- 업로드된 세션 하나. 원본 로그는 Storage에 두고 여기엔 경로만.
create table sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  source_tool text not null check (source_tool in ('claude-code', 'codex', 'transcript')),
  fidelity text not null check (fidelity in ('structured', 'transcript')),
  storage_path text not null,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'ready', 'failed')),
  -- sessionStats(session) 결과 (src/lib/parser/stats.ts)
  stats jsonb,
  created_at timestamptz not null default now()
);
create index sessions_project_idx on sessions (project_id);

-- 태깅 단위 (src/lib/pipeline/chunk.ts 출력). idx는 청크 id "c001"의 순번.
create table chunks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  idx int not null,
  start_ts timestamptz,
  end_ts timestamptz,
  text text not null,
  -- 청크에 포함된 이벤트 id 배열 등 부가 정보 (렌더링 원본은 text)
  tool_calls jsonb,
  unique (session_id, idx)
);
create index chunks_session_idx on chunks (session_id);

-- 검증된 태그 (src/lib/pipeline/tag.ts TaggedFinding). 미검증 인용은 저장 전에 이미 제외됨.
create table findings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  chunk_id uuid not null references chunks (id) on delete cascade,
  stage text not null check (stage in ('problem', 'instruct', 'evidence', 'recovery')),
  summary text not null,
  -- {"eventId": "e0031", "text": "원문 그대로"} — TaggedFinding.quote 형태 그대로
  quote jsonb not null,
  confidence real not null check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now()
);
create index findings_session_idx on findings (session_id);
create index findings_chunk_idx on findings (chunk_id);

-- GitHub에서 조회한 커밋 (Octokit, 매칭 2·3단계 재료).
create table commits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  sha text not null,
  message text not null,
  authored_at timestamptz,
  files jsonb,
  unique (project_id, sha)
);

-- 커밋↔finding 매칭. method: log(1단계 정확) | time(타임스탬프 창) | embed(임베딩).
create table matches (
  finding_id uuid not null references findings (id) on delete cascade,
  commit_id uuid not null references commits (id) on delete cascade,
  method text not null check (method in ('log', 'time', 'embed')),
  score real,
  primary key (finding_id, commit_id)
);

-- 발행된 공개 페이지. view는 PortfolioView(src/lib/portfolio/view.ts) 그대로.
create table portfolios (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  slug text not null unique,
  title text not null,
  published_at timestamptz,
  view jsonb not null,
  created_at timestamptz not null default now()
);

-- 잡 큐. next_idx = 다음에 처리할 청크 idx(체인 재개 지점).
create table jobs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  kind text not null check (kind in ('parse', 'tag', 'match', 'publish')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed')),
  progress int not null default 0 check (progress >= 0 and progress <= 100),
  next_idx int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_session_idx on jobs (session_id, status);

-- RLS: 전부 켜고 정책은 만들지 않는다 (service_role만 접근).
alter table projects enable row level security;
alter table sessions enable row level security;
alter table chunks enable row level security;
alter table findings enable row level security;
alter table commits enable row level security;
alter table matches enable row level security;
alter table portfolios enable row level security;
alter table jobs enable row level security;
