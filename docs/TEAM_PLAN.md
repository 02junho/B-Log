# B-Log 4인 역할 분담 · 일정 (9/8 → 9/20)

> 기준일 2026-09-08(월). 제출 마감 **9/20(일)** 까지 13일. 단계 정의는 [ROADMAP.md](ROADMAP.md)를 따른다.
> 이 문서는 "누가 · 무엇을 · 언제까지"만 다룬다. 결정 근거는 ROADMAP과 [CLAUDE.md](../CLAUDE.md)에 있다.
> 진행 상황 갱신: 2026-09-12, main `e5bcbc2` 및 `codex/public-portfolio-ui` 작업 기준. 최신 팀 현황·역할 B의 공개 UI 지원·연결 과제는 [FRONTEND_HANDOFF.md](FRONTEND_HANDOFF.md)를 우선 확인한다. 아래 9/9 현황과 날짜별 표는 당시 기록이다.

## 0. 전제

최신 코드 점검(`03b53a2`): PR #13~17 병합으로 업로드·검수·공개 UI와 OG, 커밋 매칭 표시까지 추가됐다.
역할 B는 `codex/review-flow-hardening`에서 검수 화면의 공유·확인 동작을 보강한다.
OAuth와 소유자 검사 및 실제 화면 E2E가 다음 우선순위다. 세부 내용은 [FRONTEND_HANDOFF.md](FRONTEND_HANDOFF.md)를 따른다.

9/13 역할 B 후속: `codex/github-auth-ownership`에서 GitHub OAuth와 소유자 검사를 구현했다.
Supabase GitHub provider와 프로덕션·로컬 Redirect URL은 9/13에 설정했다. 실제 계정 E2E와 Vercel 환경은 팀 인프라 담당과 함께 확인한다.

- 현재 위치 (9/9 저녁): Step 1~4 완료. **파서 통합·CLI와 Solar Pro 4 단독 결정, 태깅 엔진·PortfolioView·합성 fixtures까지 완료**했다. Step 5는 DB 초안 검토 단계이며 업로드·잡 API가 9/12 API E2E의 병목이다.
- 4개 역할은 **서로 다른 폴더를 소유**한다. 겹치는 부분은 9/8 킥오프에서 정하는 "계약(§3)"으로만 연결한다. 계약이 정해지면 각자 상대를 기다리지 않고 진행할 수 있다.
- 전원 AI 코딩 도구(Claude Code 또는 Codex)로 개발하고 세션 로그를 보존한다. 4명의 로그 전부가 메타 데모(데모 ①)의 재료다.

### 팀 작업 현황 (9/9 당시 기록 — 최신은 FRONTEND_HANDOFF.md)

| 영역               | 확인된 완료 내용                                                                                                              | 다음 작업                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| P1 파서·파이프라인 | PR #1~3 main 반영. 스키마 통합·Claude Code 어댑터·자동 판별·CLI, 청킹·Solar 태깅·인용 검증, PortfolioView 빌더·화면용 fixture | P2 잡 API 연결 지원, 통합 오류 대응                          |
| P2 데이터·백엔드   | DB 초안은 `origin/feat/p2-db-schema`에 있음. ROADMAP은 PR #4 검토 대기로 기록하며 main에는 아직 미반영                        | DB 초안 검토·적용, 업로드·잡 API, GitHub 조회·커밋 매칭      |
| P3 화면            | `fixtures/portfolio.sample.json`과 PortfolioView 계약 사용 가능. main에는 제품 화면 완료 구현이 확인되지 않음                 | fixture로 랜딩·업로드·검수·공개 페이지 구현, 이후 API 연결   |
| P4 품질·데모       | 모델 결정과 평가 도구는 P1 작업으로 확보. 마스킹 구현은 main에서 확인되지 않음                                                | Solar 프롬프트 전후 평가, 정규식 마스킹, 데모 검수·제출 준비 |

위 표는 원격 main과 확인 가능한 브랜치 기준이며 팀원의 미공개 로컬 작업 여부를 뜻하지 않는다.
PR #4의 실시간 리뷰 상태는 별도 확인이 필요하다. ROADMAP의 테스트 48개 통과 기록은
팀원의 기존 검증 결과이며, 이번 문서 갱신에서 테스트나 유료 LLM 호출을 재실행한 것은 아니다.

## 1. 역할

| 역할                              | 담당자          | 한 줄 책임                                                                                     | 소유 폴더                                                                                                                          |
| --------------------------------- | --------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **P1 리드 · 파이프라인 코어**     | 준호 (@02junho) | 로그를 공통 스키마로 바꾸고 4단계 태깅까지 돌리는 엔진. 인프라 계정 소유, 최종 결정, main 머지 | `src/lib/parser/`, `src/lib/pipeline/`, `scripts/parse-*.ts`, `docs/`                                                              |
| **P2 백엔드 · 데이터**            | (이름)          | DB 스키마, 업로드→저장→잡 처리, 커밋 조회·매칭, 인증                                           | `supabase/migrations/`, `src/lib/supabase/`, `src/lib/jobs/`, `src/lib/github/`, `src/lib/match/`, `src/app/api/`, `src/app/auth/` |
| **P3 프론트 · 포트폴리오 페이지** | (이름)          | 랜딩, 업로드·진행 화면, 검수 화면, 공개 포트폴리오 페이지, OG, 모바일                          | `src/app/(site)/`, `src/app/p/`, `src/components/`, `src/app/opengraph-image.tsx`, `fixtures/`                                     |
| **P4 품질 · 데모 · 제출**         | (이름)          | 모델 비교와 프롬프트, 마스킹 규칙, 데모 3종, 제출서·스크린샷·운영                              | `scripts/eval/`, `src/lib/prompts/`, `src/lib/masking/`, `docs/SUBMISSION.md`, `public/demo/`                                      |

역할 간 의존은 아래 한 방향으로만 흐른다. 거꾸로 기다리는 일이 생기면 계약(§3)이 덜 정해진 것이니 그날 저녁 싱크에서 푼다.

**역할 B — Codex 파서 담당: [@Aio1135](https://github.com/Aio1135)**

기존 실행계획의 역할 B는 P1 파서 산출물 중 Codex 어댑터·fixture 검증을 담당한다.
P2~P4의 전체 역할을 배정한 의미는 아니다.

- 완료 (9/8): `src/lib/parsers/codex.ts`, 공통 이벤트 타입 `schema.ts`,
  `tests/codex.test.ts`, 합성 입력·기대 출력 fixture, README·ROADMAP 갱신.
- 검증: 합성 테스트 12개와 실제 B-Log rollout 검증 1개 통과. pull 후 합성 테스트
  12개와 타입 검사 재통과(선택 실행하는 실제 로그 검증은 재실행하지 않음).
- 통합 완료 (9/9, P1): `src/lib/parsers/`의 `NormalizedEvent` 구현을 §3.1의
  `src/lib/parser/`·`BLogEvent`/`BLogSession` 계약으로 합치고 CLI·자동 판별에 연결했다.
  도구 호출 ID 짝은 계약 쪽으로 흡수했다(§3.1 참고). 이후 Codex 어댑터는
  `src/lib/parser/adapters/codex.ts`에 있고, 회귀 테스트는 그대로 유지된다.

**다음 할 일 — 역할 B (@Aio1135), 우선순위 순**

9/9 후속 작업: `codex/codex-rollout-regressions`에서 실로그 통계 재검증 및 회귀 사례
7개 보강. Desktop JSON 종료 코드·성공/실패 혼합 결과·음수 종료 코드·호스트 안내 제거를
수정했다. 전체 회귀 테스트 55개 통과(선택 실로그 테스트 2개 기본 제외), 타입 검사 통과.
이번 B-Log 로그를 CLI로 확인한 시점의 통계는 이벤트 175, 호출 74, 결과 73,
실패 결과 10, 커밋 1이다. 진행 중인 로그이므로 수치는 이후 달라진다.
실제 이벤트 전수 대조와 API/웹 E2E 검증은 아직 남아 있다.

1. **통합 후 본인 Codex 실로그 재검증 (9/10 우선).** 개인 프로젝트 로그로
   `npm run parse -- <로그경로> --stats`와 `BLOG_CODEX_LOG` 선택 테스트를 실행한다.
   발화 순서·호출/결과 짝·실패 표시·커밋 추출을 실제 기록과 대조한다.
   완료 기준: 로그별 이벤트/호출/결과/커밋 수와 누락 사례를 원문 없이 기록.
2. **Codex 경계 사례 회귀 테스트 보강 (9/10~9/11 권장).** P1이 고친 `input_text`
   도구 결과·중첩 커밋 처리는 유지한다. 실제 Windows/중첩 실행에서 종료 코드 전달,
   성공·실패 혼합 결과, 사용자 발화에 섞인 호스트 지침, 조회 결과의 커밋 오인 가능성을
   우선 점검한다. 확인된 문제만 합성 fixture로 재현하고 수정한다.
   완료 기준: 재현 테스트·수정 후 전체 테스트/린트/타입 검사 통과.
3. **Codex 기반 통합 검증 지원 (9/12 API, 9/14 웹).** P2 API가 준비되기 전에는
   파서→청킹→포트폴리오의 Codex 입력 검증 계획과 샘플을 준비한다. 준비 후 업로드부터
   결과까지 대조하고 파서 원인 오류를 담당한다. 실제 `npm run portfolio`는 Solar를
   호출하므로 평가용 개인 로그로 수행하고 결과는 비공개로 보관한다.
4. **메타 데모용 개인 로그 정리 (9/15 취합 전 권장).** B-Log 개발 세션 중 지시·실패·복구가
   드러나는 후보와 커밋을 정리해 P4 검수에 연결한다. 원본 JSONL과 마스킹 전 결과는 커밋하지 않는다.

스키마 이전·자동 판별·CLI를 다시 구현할 필요는 없다. 업로드 API·화면·마스킹 전체를
역할 B가 인수한 것도 아니다. 공통 `schema.ts`/`git.ts` 변경이 필요하면 P1과 계약 영향을
확인하고 브랜치→PR로 진행한다. 위 일정은 역할 B의 다음 작업 제안이며 완료 표시는 아니다.

```
P1 파서·태깅 ──▶ P2 저장·잡·매칭 ──▶ P3 페이지 렌더
      ▲                                     ▲
      └──── P4 프롬프트·평가 ────────────────┘ (fixtures·데모 데이터)
```

### P1 준호 — 리드 · 파이프라인 코어

- **산출물**
  - `src/lib/parser/schema.ts` 공통 스키마(`BLogEvent`, zod) — **9/8 안에 확정**
  - `src/lib/parser/adapters/claude-code.ts`, `codex.ts`, `transcript.ts`(LLM 구조화) + `detect.ts`(앞부분 레코드 타입으로 형식 판별)
  - `src/lib/pipeline/chunk.ts`(청킹), `tag.ts`(AI SDK로 4단계 태깅, provider 무관), `highlight.ts`(P4 프롬프트 사용)
  - `scripts/parse-session.ts` CLI: 로그 파일 → 정규화 JSON. Step 3 산출물이자 P4 평가 입력
- **완료 기준**: 본인 Claude Code 로그와 Codex 로그 각 1개가 CLI로 정규화되고(9/9), 태깅까지 CLI로 끝까지 돈다(9/12)
- **리드 업무**: 계약 확정, PR 머지, Vercel·Supabase 계정, 매일 저녁 싱크 진행, 범위 컷 결정
- **AI 도구 지침 유지**: `CLAUDE.md`/`AGENTS.md` 갱신

### P2 — 백엔드 · 데이터

- **산출물**
  - 마이그레이션: `projects, sessions, chunks, findings, commits, matches, portfolios, jobs` (§3.2) — **9/9**
  - `POST /api/upload`: Storage 저장 + sessions 행 + jobs 행 생성
  - `POST /api/jobs/[id]/run`: 청크 단위 처리, `maxDuration=300`, 남으면 자기 자신 재호출(체인), 진행률 기록
  - `GET /api/jobs/[id]`: 상태 폴링
  - `src/lib/github/commits.ts`: Octokit으로 공개 레포 커밋 목록·파일 목록
  - `src/lib/match/`: 매칭 3단계(로그 내 커밋 호출 → 타임스탬프 창 → 임베딩 코사인). 임베딩은 인메모리
  - `POST /api/portfolios`: 검수 결과로 공개 페이지 데이터(`PortfolioView`) 생성·발행
  - GitHub OAuth(`@supabase/ssr`), `/auth/callback`, 내 포트폴리오 목록 쿼리
  - 일일 분석 횟수 상한(투표 기간용, env로 켜고 끔)
- **완료 기준**: 9/12에 CLI 없이 API만으로 업로드 → 잡 완료 → 포트폴리오 행 생성이 된다
- **필요 권한**: Supabase org 멤버 초대(준호가 9/8 처리). Vercel은 Hobby라 멤버 추가 불가 → 배포는 main 머지로만

### P3 — 프론트 · 포트폴리오 페이지

- **산출물**
  - `fixtures/portfolio.sample.json`: §3.3 `PortfolioView` 형태의 가짜 데이터 — **9/8 P1과 함께 확정, 이걸로 백엔드 없이 개발**
  - 랜딩 `/`: 서비스 한 줄 + 데모 3종 카드 + "내 로그 분석하기" CTA (로그인 없이 데모가 30초 안에 보여야 함)
  - 업로드 `/new`: 파일 드롭 + 형식 자동 인식 표시 + GitHub 레포 URL 입력 + 진행률(잡 폴링)
  - 검수 `/sessions/[id]/review`: 태깅 결과·하이라이트·마스킹 후보를 보고 수정/제외 후 "발행"
  - 공개 페이지 `/p/[slug]`: 타임라인 뷰 + 하이라이트 카드(원문 인용) + 4단계 요약 + 분석 등급 배지(정밀/요약) + 사용 도구 목록 + 커밋 링크
  - `opengraph-image.tsx`(Next 내장), 모바일 뷰(투표자는 폰으로 봄), 로딩·에러·빈 상태
  - shadcn/ui 세팅과 공용 컴포넌트
- **완료 기준**: 9/11에 fixtures로 4개 화면이 다 열리고, 9/14에 실데이터로 붙는다
- **주의**: Next.js 16은 학습 데이터와 다르다. 코드 전에 `node_modules/next/dist/docs/` 확인

### P4 — 품질 · 데모 · 제출

- **산출물**
  - `scripts/eval/compare-models.ts`: Solar Pro 4 단독 결정 완료(9/9). 같은 평가 청크로 프롬프트 변경 전후 JSON 유효율·인용 검증율·비용 비교
  - `src/lib/prompts/`: 4단계 태깅 프롬프트 v1(few-shot), 하이라이트 추출 프롬프트, 대화록 구조화 프롬프트, 마스킹 2차(LLM 검출) 프롬프트. zod 출력 스키마 포함
  - `src/lib/masking/rules.ts` + 테스트: 이메일·API 키·토큰·경로 속 사용자명 정규식. 대회 규정 "타인 개인정보·기밀 금지"의 직접 대응
  - 데모 3종 데이터: ① B-Log 개발 로그(4명 로그 취합, 준호와) ② 팀원 개인 프로젝트 로그 1개 ③ "AI에 통째로 맡긴 나쁜 예"(직접 제작). 게시 전 수동 검수
  - `docs/SUBMISSION.md`: 제목, 문제 한 줄, AI 활용 방식 500자(도구 실명), 스크린샷 4장 구성, 대표 이미지 1200×630
  - `/licenses` 페이지 내용, README "사용한 AI 도구" 표 최신화
  - QA: 9/14·9/16 전체 시나리오 테스트, 9/19 외부인 2~3명 첫 사용 테스트
  - 운영 준비: UptimeRobot 등록(9/20), 커뮤니티 홍보 문안(대가성 투표 요청 금지)
- **완료 기준**: 9/10 모델·프롬프트 v1 확정, 9/16 데모 3종 공개 URL, 9/17 제출서 '제출' 상태
- **필요 키**: Upstage API 키를 본인 `.env.local`에 (Anthropic API 미사용, 9/9 확정)

## 2. 마일스톤

| 날짜          | 마일스톤                     | 판정 기준                                                              |
| ------------- | ---------------------------- | ---------------------------------------------------------------------- |
| 9/8(월)       | 킥오프 · 계약 확정           | §3의 4개 계약이 레포에 커밋됨. 4명 모두 로컬 `npm run dev` 성공        |
| 9/10(수)      | 모델 결정                    | 비교표 기반으로 메인 모델·프롬프트 v1 확정, 세션당 비용 추정           |
| 9/12(금)      | 파이프라인 E2E (API)         | 실제 로그 업로드 → 잡 완료 → portfolios 행 생성. UI 없이 curl로        |
| 9/14(일)      | **웹 E2E 1회전 (중간 점검)** | 브라우저에서 업로드 → 검수 → 공개 페이지까지. 실행계획서의 중간 점검일 |
| 9/16(화)      | 데모 3종 공개                | 로그인 없이 랜딩에서 30초 안에 데모가 보임. 스크린샷 4장 촬영          |
| 9/17(수)      | **가제출**                   | 대회 사이트에 '제출' 상태(임시저장 아님). 상태 스크린샷 보관           |
| 9/18(목)      | 참가 접수 마감               | 4명 모두 대회 사이트 팀 등록 확인                                      |
| 9/20(일) 오전 | 최종 확정                    | 새 기능 금지, 최종 스크린샷·문구 갱신, 이후 수정 불가                  |

## 3. 계약 (9/8 킥오프에서 확정, 이후 변경은 저녁 싱크에서만)

### 3.1 공통 스키마 `BLogEvent` (P1 소유) — 9/9 확정, `src/lib/parser/schema.ts`

문서가 아니라 **코드가 계약의 원본**이다. 아래는 확정된 실제 정의다.
초안과 달라진 곳은 두 군데뿐이고, 둘 다 역할 B의 Codex 어댑터에서 이미 검증된 정보다.
① 도구 호출·결과를 `id` ↔ `callId`로 짝지어 병렬 호출을 구분한다(초안은 `name`뿐이라 구분 불가).
② 실패한 도구 결과에 `isError`를 남긴다. 4단계 태깅의 "실패·복구" 입구다.

```ts
type BLogEvent = {
  id: string; // 세션 내 순번 기반 ("e0001")
  role: "user" | "assistant" | "tool";
  ts?: string; // ISO. 대화록 등급은 없을 수 있음
  text: string;
  toolCalls?: { id: string; name: string; input: unknown }[];
  toolResults?: { callId: string; output: string; isError?: boolean }[];
  filesChanged?: string[]; // 성공한 쓰기 도구의 보고에서만
  gitCommit?: { sha?: string; message: string }; // git이 확인해 준 커밋만 (매칭 1단계)
};
type BLogSession = {
  source: {
    tool: "claude-code" | "codex" | "transcript";
    fidelity: "structured" | "transcript";
  };
  cwd?: string;
  startedAt?: string;
  events: BLogEvent[];
};
type SessionAdapter = (lines: readonly string[]) => BLogSession;
```

`PortfolioView.stats`의 재료는 `src/lib/parser/stats.ts`의 `sessionStats(session)`가 계산한다.

### 3.2 DB 테이블 (P2 소유)

`projects(id, owner_id, name, repo_url)` · `sessions(id, project_id, source_tool, fidelity, storage_path, status, stats jsonb)` · `chunks(id, session_id, idx, start_ts, end_ts, text, tool_calls jsonb)` · `findings(id, session_id, chunk_id, stage, summary, quote, confidence)` (stage = `problem | instruct | evidence | recovery`) · `commits(id, project_id, sha, message, authored_at, files jsonb)` · `matches(finding_id, commit_id, method, score)` (method = `log | time | embed`) · `portfolios(id, session_id, slug, title, published_at, view jsonb)` · `jobs(id, session_id, kind, status, progress, next_idx, error)` · `heartbeat`. 전 테이블 RLS 켬, 접근은 서버(service_role)만.

### 3.3 공개 페이지 데이터 `PortfolioView` (P2 생산 · P3 소비 · P4 fixtures 검수)

```ts
type PortfolioView = {
  slug: string;
  title: string;
  tools: string[];
  fidelity: "structured" | "transcript";
  summary: {
    problem: string;
    instruct: string;
    evidence: string;
    recovery: string;
  };
  timeline: {
    ts?: string;
    stage: Stage;
    summary: string;
    quote?: string;
    commit?: { sha: string; message: string; url: string };
  }[];
  highlights: { stage: Stage; title: string; quote: string; why: string }[];
  stats: {
    events: number;
    toolCalls: number;
    commits: number;
    durationMin?: number;
    byRole: { user: number; assistant: number; tool: number };
  }; // "AI 기여/인간 개입" 재료
};
```

(9/9 갱신: `stats.byRole` 추가 — ROADMAP Step 7의 "AI 기여/인간 개입" 요약 화면 요구사항. 원본은 `src/lib/portfolio/view.ts`.)

### 3.4 API 라우트 (P2 소유, P3 소비)

`POST /api/upload` · `GET /api/jobs/[id]` · `POST /api/jobs/[id]/run` · `GET /api/sessions/[id]/review` · `POST /api/sessions/[id]/publish` · `GET /api/health`. 요청·응답 타입은 `src/lib/api/types.ts` 한 파일에 모은다.

## 4. 날짜별 계획

| 날짜        | P1 준호                                                                                           | P2 백엔드                                                                 | P3 프론트                                                     | P4 품질·데모                                                    |
| ----------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| **9/8 월**  | 킥오프 진행. `schema.ts` 확정·커밋. Claude Code 어댑터 시작. Supabase 멤버 초대, API 키 발급·전달 | 환경 세팅. 3.2 마이그레이션 초안 작성                                     | 환경 세팅. shadcn 세팅. `fixtures/portfolio.sample.json` 작성 | 환경 세팅. 정규식 마스킹 규칙·테스트. 태깅 프롬프트 v0 초안     |
| **9/9 화**  | Claude Code 어댑터 완성 → Codex 어댑터. CLI로 정규화 JSON 출력                                    | 마이그레이션 적용. `/api/upload` + Storage. jobs 테이블·상태 API          | 랜딩 + 업로드 화면(fixtures)                                  | P1 JSON으로 평가 청크 10~20개 선별. `compare-models.ts` 작성    |
| **9/10 수** | 청킹 + AI SDK provider 추상화. 대화록 어댑터(LLM 구조화)                                          | `/api/jobs/[id]/run` 청크 처리·체인. Octokit 커밋 조회                    | 공개 페이지 `/p/[slug]` 타임라인·하이라이트(fixtures)         | **모델 비교 실행 → 결정**. 프롬프트 v1 + zod 스키마 확정        |
| **9/11 목** | `tag.ts` 4단계 태깅을 P4 프롬프트로 연결. CLI로 태깅까지                                          | 매칭 1·2단계(로그 커밋·타임스탬프). findings/matches 저장                 | 검수 화면 `/review`(fixtures). 모바일 뷰                      | 하이라이트 프롬프트. 마스킹 2차(LLM) 프롬프트. 데모 ② 로그 확보 |
| **9/12 금** | **파이프라인 E2E(API)** 합류·디버깅                                                               | `/publish` → `PortfolioView` 생성. **API E2E**                            | 실제 API 연결 시작(업로드·폴링)                               | 데모 ③ "나쁜 예" 로그 제작. 태깅 품질 수정 요청 정리            |
| **9/13 토** | 통합 버그 수정. 등급 배지·통계 계산                                                               | GitHub OAuth(`@supabase/ssr`), 내 목록. 매칭 3단계(임베딩, 대화록 등급만) | 검수·공개 페이지 실데이터 연결. OG 이미지                     | 전체 시나리오 QA 1차. `/licenses` 내용                          |
| **9/14 일** | **웹 E2E 1회전** 주관. 범위 컷 결정                                                               | 성능(300초 안), 에러 처리, 일일 상한                                      | 로딩·에러·빈 상태. 접근성 기본                                | QA 결과 이슈화. 데모 ① 4명 로그 취합                            |
| **9/15 월** | 데모 ① 메타 포트폴리오 생성·검수                                                                  | 데모 3종 발행 지원. 버그                                                  | 랜딩에 데모 카드. UI 다듬기                                   | 데모 3종 검수(개인정보). 제출서 초안                            |
| **9/16 화** | 최종 코드 리뷰                                                                                    | 안정화                                                                    | 모바일 최종. **스크린샷 4장** 촬영 지원                       | **데모 3종 공개**. 대표 이미지. 스크린샷 4장                    |
| **9/17 수** | 제출 내용 승인                                                                                    | 버그                                                                      | 버그                                                          | **가제출('제출' 상태)**. 스크린샷 보관                          |
| **9/18 목** | 팀원 등록 최종 확인                                                                               | 버그                                                                      | 버그                                                          | 참가 접수 마감 대응. 홍보 문안                                  |
| **9/19 토** | 버그픽스만. 외부 테스트 피드백 분류                                                               | 버그픽스만                                                                | 버그픽스만                                                    | 외부인 2~3명 첫 사용 테스트                                     |
| **9/20 일** | **오전 최종 확정**                                                                                | 대기                                                                      | 최종 스크린샷                                                 | 문구·스크린샷 갱신 후 제출 확정. UptimeRobot 등록               |

## 5. 협업 규칙

- **브랜치**: `main`은 항상 배포 가능. 각자 `feat/<역할>-<주제>` 브랜치에서 PR. 리뷰는 의존 방향의 상대 1명(P1↔P2, P2↔P3, P4는 아무나).
- **머지는 준호가 "Create a merge commit"으로.** Vercel Hobby는 프로젝트 소유자가 아닌 사람의 커밋을 배포하지 않을 수 있어서, main에 올라가는 커밋의 작성자가 준호여야 안전하다. PR 본문에 "Generated with ..." 문구 금지, 커밋에 AI 공동 작성자 표기 금지(훅과 CI가 막음).
- **데일리 싱크 15분(저녁 22:00 권장)**: 어제 한 것 · 오늘 할 것 · 막힌 것. 계약(§3) 변경은 여기서만.
- **세션 로그 보존**: 4명 모두 `~/.claude/settings.json`에 `"cleanupPeriodDays": 3650`. Codex 사용자는 `~/.codex/sessions/`를 지우지 않는다. **주 1회(일요일) 백업**: 비공개 레포 `02junho/B-Log-logs`를 클론(준호에게 권한 요청) 후 `bash scripts/backup-logs.sh` 실행 — B-Log 관련 로그만 자동 선별해 커밋·푸시한다. 백업 레포는 절대 공개로 바꾸지 않는다.
- **키 관리**: API 키는 각자 `.env.local`에만. 슬랙·노션에 붙여넣지 않는다. Vercel 환경변수는 준호만 수정.
- **도구 기록**: 새 AI 도구를 쓰면 README "사용한 AI 도구" 표에 바로 추가. 제출서 필수 항목.
- **폴더 경계**: 남의 소유 폴더를 고쳐야 하면 PR에 이유를 쓰고 소유자 리뷰를 받는다. `src/lib/api/types.ts`와 `schema.ts`는 변경 시 4명 모두에게 알린다.

## 6. 범위 컷 순서 (일정이 밀리면 위에서부터 뺀다)

1. 매칭 3단계(임베딩) → 1·2단계만으로 감
2. 대화록(transcript) 어댑터 → Claude Code·Codex만 지원, 범용 입구는 "확장 로드맵"
3. GitHub OAuth → 로그인 없이 업로드·발행(URL만 알면 보이는 비공개 슬러그)
4. 검수 화면의 편집 기능 → 제외/포함 토글만
5. 마스킹 2차(LLM) → 정규식 1차 + 수동 검수

**절대 안 빼는 것**: Claude Code 어댑터, 4단계 태깅, 하이라이트(원문 인용), 공개 페이지, 정규식 마스킹, 데모 3종, 헬스체크.

## 6.5 Git 브랜치 규칙 (9/9 확정)

main만 프로덕션에 배포되므로 **main은 항상 배포 가능한 상태**여야 한다. 그래서:

- **main에 직접 푸시 금지.** 모든 작업은 브랜치 → PR → 준호가 머지. (예외: 준호의 `docs/` 단독 수정은 직접 커밋 허용)
- **브랜치 이름**: `feat/p{역할}-{주제}` (예: `feat/p2-upload-api`, `feat/p3-landing`). 버그픽스는 `fix/`, 문서는 `docs/`.
- **브랜치는 그날 만들고 그날(늦어도 다음 날) PR.** 오래 사는 브랜치 금지 — 소유 폴더가 갈라져 있어 충돌은 드물지만, 늦게 합칠수록 `schema.ts` 같은 계약 변경과 어긋난다.
- **PR은 작게, 소유 폴더 안에서.** 다른 역할의 폴더를 고쳐야 하면 PR 설명에 멘션하고 저녁 싱크에서 말한다.
- **시작 전 `git pull origin main`, PR 전 rebase**(`git rebase origin/main`). 머지 후 브랜치 삭제.
- **계약 파일(`src/lib/parser/schema.ts`, `PortfolioView`, DB 마이그레이션, API 경로)을 바꾸는 PR은 제목에 `[계약]`**을 달고, 머지 전에 영향받는 역할의 확인을 받는다.
- PR에서 CI(`no-ai-coauthor`)가 실패하면 해당 커밋 메시지에서 AI 트레일러를 지우고 다시 푸시.
- Vercel이 PR마다 Preview 배포 URL을 달아준다. 프론트 PR은 그 URL로 확인. (Preview에도 Supabase 환경변수가 들어가 있음)

## 7. 오늘(9/8) 각자 체크리스트

**전원**

- [ ] 레포 클론 → `npm install`(훅 자동 설치) → `.env.example`을 `.env.local`로 복사
- [ ] Claude Code 또는 Codex 로그인. 레포 폴더에서 세션 열기(CLAUDE.md/AGENTS.md 자동 적용 확인)
- [ ] `~/.claude/settings.json`에 `cleanupPeriodDays` 설정
- [ ] `npm run dev` 후 `localhost:3000/api/health`가 열림
- [ ] 대회 사이트 팀 참가 등록 확인
- [ ] README 팀원 표에 본인 핸들·역할 기입(PR)

**준호**

- [ ] Supabase org에 P2 초대, Supabase URL·anon·service_role을 안전한 경로로 P2·P3에 전달
- [ ] Anthropic·Upstage API 키 발급 → P4에 전달
- [ ] `schema.ts` 커밋, P3와 `fixtures/portfolio.sample.json` 합의
- [ ] 저녁 싱크 시간 확정
