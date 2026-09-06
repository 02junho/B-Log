-- heartbeat: /api/health 가 실제 DB 쿼리를 날리기 위한 최소 테이블.
-- Supabase Free 티어는 DB 활동이 7일간 없으면 프로젝트를 일시정지하므로,
-- UptimeRobot → /api/health → 이 테이블 조회로 활동을 유지한다.

create table if not exists public.heartbeat (
  id bigint generated always as identity primary key,
  note text,
  created_at timestamptz not null default now()
);

alter table public.heartbeat enable row level security;
-- 정책 없음: anon/authenticated 는 접근 불가, 서버(service_role)만 조회한다.

insert into public.heartbeat (note) values ('initial');
