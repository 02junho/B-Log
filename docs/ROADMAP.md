# B-Log 단계별 진행 문서

> 마지막 갱신: 2026-09-12 (D-8). 단계가 끝날 때마다 이 문서를 갱신한다.
> 상태 표기: ✅ 완료 · 🔄 진행 중 · ⏳ 예정 · ⚠️ 주의
> ✅ 9/10 오후 기준: **Step 1~6 완료. 백엔드 API 전 구간(업로드→파싱→태깅→매칭→마스킹→발행)이 프로덕션에서 동작한다** — 9/12 API E2E 마일스톤 이틀 조기 달성. 남은 핵심 경로는 **P3 화면**(fixtures로 개발 → 9/13 API 연결), P4 품질(마스킹 보강·프롬프트), P2 검수 플로우. 분담은 **[TEAM_PLAN.md](TEAM_PLAN.md)**, 제출서 초안은 **[SUBMISSION.md](SUBMISSION.md)**.

## 한눈에 보기

| Step | 내용 | 기한 | 상태 |
| --- | --- | --- | --- |
| 1 | 레포 · 첫 커밋 · 세션 로그 보존 | 9/4 | ✅ |
| 2 | 배포 골격 (Next.js → Vercel → Supabase) | 9/5 | ✅ (9/6 완료) |
| 3 | 파서 스파이크 (최대 리스크 먼저) | 9/6~9/7 | ✅ (9/9 완료. 마스킹은 Step 5로) |
| 4 | LLM 모델 · 프롬프트 v1 결정 | 9/7 | ✅ (9/9 Solar 단독 확정) |
| 5 | 데이터 모델 · 업로드 · 잡 파이프라인 | 9/8~9/9 | ✅ (9/10 완료 — 프로덕션 동작) |
| 6 | 4단계 태깅 · 커밋 매칭 · 하이라이트 | 9/10~9/11 | ✅ (9/10 완료 — 프롬프트 개선은 P4 계속) |
| 7 | 포트폴리오 페이지 · 마스킹 2차 · GitHub OAuth · 검수 | 9/12~9/13 | 🔄 (PR #13~17 병합: 공개·업로드·검수·OG 구현. OAuth·소유자 검사·품질·E2E 남음) |
| — | **중간 점검: 엔드투엔드 1회전** | **9/14** | ⏳ |
| 8 | 데모 3종 · 랜딩 · 모바일 · 스크린샷 | 9/15~9/16 | ⏳ |
| 9 | 제출서 작성 · '제출' 상태로 가제출 | 9/17~9/18 | ⏳ |
| 10 | 버그픽스만 · 최종 확정 | 9/19~9/20 | ⏳ |
| 11 | 심사 · 투표 기간 운영 | 9/21~10/5 | ⏳ |

핵심 링크
- 서비스: https://b-log-pink.vercel.app (제출·모니터링용. 배포별 `b-xxxx-….vercel.app` 주소는 로그인 보호가 걸려 외부에서 못 엶)
- 헬스체크: https://b-log-pink.vercel.app/api/health
- 레포: https://github.com/02junho/B-Log
- Supabase 프로젝트 ref: `btjxwvapcycfzaskxhfn` (org `b-log`, Free, Seoul)

---

## Step 1. 레포 · 첫 커밋 · 세션 로그 보존 ✅

**목표** 개발 0번째 커밋부터 AI 세션 로그가 남게 한다. 이 로그가 곧 메타 데모 데이터다.

**한 일**
- `02junho/B-Log` 공개 레포, 첫 커밋(README, .gitignore, CLAUDE.md)을 Claude Code 세션 안에서 수행.
- `.gitignore`에 `*.jsonl`, `.env*` 포함. 로그와 키는 레포에 절대 안 올라감.
- `CLAUDE.md`(Claude Code용)와 `AGENTS.md`(Codex 등 다른 도구용)에 팀 공통 규칙 기록.
- Claude Code 로그 자동 삭제 방지: `~/.claude/settings.json`에 `cleanupPeriodDays: 3650`. **팀원도 각자 설정해야 함** (기본 30일이면 10/4쯤 초기 로그가 지워짐).
- 세션 로그 위치 확인: Claude Code `~/.claude/projects/<프로젝트 폴더>/*.jsonl`, Codex `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`.

**결정**
- GitHub contributors에 AI 계정이 뜨지 않게 한다. 안전장치 3겹: `.claude/settings.json`(트레일러 비활성화), `.githooks/commit-msg`(트레일러 자동 제거, `npm install` 시 활성화), GitHub Actions `no-ai-coauthor`(푸시 검사).
- ⚠️ 강제 푸시로 지운 옛 커밋 캐시 때문에 사이드바에 `claude`가 남아 있음. 자연 소멸을 기다리기로 함. 9/18경 한 번 확인.

**팀원 온보딩 체크리스트**
1. 레포 클론 후 `npm install` (훅 자동 활성화)
2. `~/.claude/settings.json`에 `"cleanupPeriodDays": 3650`
3. 세션은 항상 `B-Log` 폴더를 열고 시작 (로그가 프로젝트 폴더에 모임)
4. 주 1회(일요일) 로그 백업: 비공개 레포 `02junho/B-Log-logs` 클론(준호에게 권한 요청) 후 `bash scripts/backup-logs.sh` — B-Log 관련 로그만 자동 선별·푸시 (준호 첫 백업 9/10 완료)
5. 새 AI 도구를 쓰면 README "사용한 AI 도구" 표에 추가

---

## Step 2. 배포 골격 ✅ (9/6 완료)

**목표** 실서비스 URL이 열리고 DB에 연결된 상태.

**한 일**
- Next.js 16.3.4 (App Router, TypeScript, Tailwind v4, `src/`, React Compiler) 생성.
- Vercel Hobby에 `02junho/B-Log` import, main 푸시마다 자동 배포. 프로덕션 도메인 `b-log-pink.vercel.app`.
- Supabase Free 프로젝트 생성 (Seoul, automatic RLS 켬). 키 3개를 로컬 `.env.local`과 Vercel 환경변수(Production + Preview)에 등록.
- `GET /api/health`: 실제 `heartbeat` 테이블을 조회해 `{app, supabase}` 상태 반환. 심사 기간 UptimeRobot이 이 주소를 5분마다 호출해 Supabase 7일 일시정지를 막는다.
- Supabase CLI 연동: `npm run db:link` / `db:push` / `db:types`. 첫 마이그레이션 `20260906000001_heartbeat.sql` 원격 적용 확인.
- `.env.example`에 필요한 키 이름 전부 기록.

**검증** 원격 `/api/health` → `{"app":"ok","supabase":"ok"}` 확인 (9/6 16:38).

**배운 것**
- Vercel 환경변수: `NEXT_PUBLIC_` 변수는 Config 타입으로 넣어야 저장됨. Secret으로 저장하면 Config로 못 바꿈. 타입은 대화상자 단위라 Config 2개 / Secret 1개를 따로 저장.
- 환경변수 추가 후 반드시 Redeploy (빌드 캐시 해제).
- 로컬 npm 캐시 일부가 root 소유라 설치가 실패할 수 있음 → `sudo chown -R $(id -u):$(id -g) ~/.npm`.

---

## Step 3. 파서 스파이크 ✅ (9/9 완료)

**목표** 실제 세션 로그가 공통 스키마로 정확히 파싱되는지 UI보다 먼저 검증한다. 여기서 안 되면 나머지가 다 무너진다.

**완료 조건 판정** 세션 1개를 넣으면 정규화 JSON이 나오고(`npm run parse`), 두 형식
각각의 합성 입력·기대 출력이 레포에 있다(`tests/fixtures/`). 충족.

### 역할 B: Codex 어댑터 (9/8)

- 담당: [@Aio1135](https://github.com/Aio1135) — Codex rollout 어댑터·fixture 테스트·실로그 검증.
- response_item 기반 발화 복원, function/custom 도구 호출·결과 ID 보존,
  시스템·reasoning 제외, event_msg 중복 방지.
- git commit 입력·출력을 보존하고, 직접 apply_patch 성공 결과의 변경 경로 추출.
  실패·미완료 패치는 변경으로 기록하지 않음. 중첩 스크립트는 보존하되 파일 변경을 추정하지 않음.
- `tests/fixtures/`: 실제 세션의 레코드 구조만 확인해 작성한 합성 JSON 입력과 기대 출력.
  실제 세션 원문·JSONL·개인정보는 포함하지 않음.
- 검증 (9/8): 합성 회귀 테스트 12개 + 실제 rollout 검증 1개 통과.
- 후속 검증 (9/9, 역할 B 작업 브랜치): Desktop 도구 JSON의 종료 코드·중첩 결과를
  해석하고, 성공/실패 혼합 실행에서 성공 커밋을 보존하도록 보강. 음수 종료 코드를
  실패로 표시하며 system-reminder·추천 플러그인·환경 안내가 발화에 남지 않도록 수정.
  합성 회귀 사례 7개 추가, 전체 기본 테스트 55개 통과(선택 실로그 2개 제외), 타입 검사 통과.
  실로그 CLI 통계 확인 완료. API/웹 통합 검증은 P2 연결 후 진행한다.

### P1: 스키마 통합 · Claude Code 어댑터 · CLI (9/9)

- **스키마 계약 하나로 통합.** `src/lib/parsers/` → `src/lib/parser/`, `NormalizedEvent` →
  TEAM_PLAN §3.1의 `BLogSession`/`BLogEvent`. 이벤트별 `source`를 세션 레벨로 올리고
  순번 ID·`gitCommit`을 추가했다. 역할 B가 이미 검증한 도구 호출 ID 짝(`id` ↔ `callId`)은
  버리지 않고 계약 쪽에 흡수했다. P2·P3·P4가 이 타입 하나만 보면 된다.
- **Claude Code 어댑터** `adapters/claude-code.ts`. user/assistant 레코드만 대화로 보고
  attachment·system·queue-operation 등 호스트 기록은 무시(모르는 타입도 동일 = 전방 호환).
  thinking 제외, 슬래시 명령 반향·`isMeta`·서브에이전트(`isSidechain`) 제외,
  `<system-reminder>` 블록은 발화와 도구 결과 양쪽에서 제거.
- **커밋 매칭 1단계 근거 확보** `git.ts`. git이 확인해 준 커밋만 기록한다(호스트가 준 sha
  또는 git의 `[branch sha]` 보고). 훅에 막힌 커밋·빈 커밋·`git log` 조회는 커밋이 아니다.
- **형식 자동 판별** `detect.ts`. 첫 줄 하나가 아니라 앞부분 30줄의 레코드 타입 어휘로 판정한다
  (실제 로그는 첫 줄이 호스트 기록인 경우가 흔하다). 판별 실패 시 범용 대화록 경로로 넘긴다.
- **CLI** `scripts/parse-session.ts` (`npm run parse`). 로그 → 정규화 JSON, `--stats`는
  원문 없이 통계만 낸다. P4의 모델 비교 입력이 된다.
- **실로그 검증에서 잡은 것 2건**: ①Codex 도구 결과 블록이 `input_text` 타입이라 출력이
  통째로 비어 있었다(기존 어댑터의 미검출 버그). ②Codex 세션 대부분이 도구 호출을
  중첩 스크립트로 감싸서 커밋이 하나도 안 잡혔다 → git 자신의 커밋 보고가 함께 있을 때만
  인정하는 경로를 추가해 실로그에서 커밋 9건 추출 확인.
- **검증 (9/9)**: 합성 테스트 35개 통과 + 실로그 검증 2개(Claude Code 세션 1개 123이벤트,
  Codex 세션 1개 1865이벤트) 통과. `npm run lint`, `npm run typecheck` 통과.

**남은 작업** 범용 대화록 어댑터(LLM 구조화)는 Step 5의 입구 3번과 함께,
정규식 마스킹은 Step 5에서 한다. 어댑터는 2개에서 늘리지 않는다.

**필요한 것** 데모 데이터로 쓸 **개인 프로젝트 로그 폴더 지정** (연구실 산출물 섞인 세션 제외).

---

## Step 4. LLM 모델 · 프롬프트 v1 결정 ✅ (9/9 완료)

**결정** 메인 LLM은 **Upstage Solar Pro 4 단독** (Anthropic API 미사용, 사용자 확정 9/9). 임베딩도 Upstage `solar-embedding-1-large`로 단일화 — 벤더 1개.

**실측 (실제 세션 로그 33청크 중 8청크 샘플, `npm run eval:models`)**

| 지표 | 텍스트 모드(1차) | JSON 모드+재시도(프로덕션 경로) |
| --- | --- | --- |
| JSON 유효율 | 25% → 프롬프트 수정 후 63% | 리포트 참조 (1회→재시도후 표기) |
| 인용 검증율 | 61~78% | 검증 실패 인용은 파이프라인이 자동 제외 |
| 세션 추정 비용 | ~$0.05 | 재시도 포함 ~$0.07 이하 |

- 프로덕션 경로: `generateObject`(JSON 모드) + zod 검증 + 실패 시 1회 재시도 (`scripts/eval/compare-models.ts`가 그대로 측정).
- 하네스는 이후 **프롬프트 A/B 도구**로 사용: 프롬프트를 바꾸면 같은 명령으로 전후 지표 비교.
- 지연 청크당 ~5-11초 → 잡 파이프라인에서 동시성 4~6 병렬 필수 (Step 5).

**감안한 리스크** 단일 벤더(장애 시 신규 분석 중단 — 데모 3종은 캐시로 무관), 투표 기간 크레딧 소진(일일 상한으로 대응).

---

## Step 5. 데이터 모델 · 업로드 · 잡 파이프라인 ✅ (9/10 완료)

**된 것 (PR #4·#7·#8·#10, 모두 머지·프로덕션 배포)**
- 테이블 8개 + storage `logs` 버킷 프로덕션 적용, 타입 생성(`db:types`).
- `POST /api/upload`: multipart → 형식 자동 판별 → Storage 저장 → session·parse 잡 생성.
- `POST /api/jobs/[id]/run`: parse(파싱·청킹·chunks 저장) → tag(배치 25청크 태깅, `next_idx` 재개, `continue` 플래그). `maxDuration 300`.
- `GET /api/jobs/[id]`: 상태·진행률 (P3 폴링용). 계약은 `src/lib/api/types.ts`.
- **토큰 가드** `BLOG_API_TOKEN`(fail-closed): 비용 라우트 보호. OAuth(Step 7)가 대체할 때까지. 브라우저에 노출 금지.
- **이중 실행 잠금**: tag는 배치 선점(next_idx 조건부 전진), parse는 queued→running 전이. 동시 3발/5발 검증 중복 0. idx 경계 버그(25청크 초과 세션 조기 종료)도 수정.
- 프로덕션 E2E: 실로그 업로드→parse→tag→ready, findings 저장 확인.

**남은 것** 범용 대화록 입구(컷 후보 2번 — 필요 시에만), 일일 분석 상한(투표 기간 전, P2).

---

## Step 6. 4단계 태깅 · 커밋 매칭 · 하이라이트 🔄 (P1 몫 완료 9/9)

**된 것 (PR #3 [계약], 머지됨)**
- **태깅 엔진** `src/lib/pipeline/tag.ts`: 청크 병렬(동시성 4~6), JSON 모드+1회 재시도, **미검증 인용 자동 제외**(원문에 그대로 없는 quote는 저장 전에 버림), runner 주입으로 네트워크 없이 테스트.
- **PortfolioView 계약 코드화** `src/lib/portfolio/view.ts`: stage 어휘를 DB와 통일(`instruction`→`instruct`), `stats.byRole` 추가("AI 기여/인간 개입" 화면 재료), commit.url 빈 문자열 규칙 명문화.
- **빌더** `src/lib/portfolio/build.ts`: findings→요약·타임라인·하이라이트 조립(결정적). 하이라이트 5개는 단계 다양성 우선.
- **전체 파이프라인 CLI** `npm run portfolio -- <로그>`: 로그→PortfolioView JSON. 데모 3종 생산 도구. 출력은 `.parsed/`(마스킹 전, 커밋 금지).
- **P3 fixtures** `fixtures/portfolio.sample.json`(합성 데이터) + 계약 검증 테스트. 테스트 총 48개 통과.
- 실측(메타 데모 후보 세션): 42청크 실패 0, 검증 findings 102개(미검증 66 제외), 82초, $0.045/세션.

**추가 완료 (9/10, PR #11)**
- 커밋↔대화 매칭: `src/lib/match/stages.ts` — 1단계(청크 안 로그 sha 접두사, score 1) + 2단계(인용 이벤트 ±30분 창). 3단계(임베딩)는 컷 확정으로 미구현.
- GitHub 커밋 조회: `src/lib/github/commits.ts` (표준 fetch, 최대 300개, `GITHUB_TOKEN` 선택).
- **match·publish 잡 + `POST /api/sessions/[id]/publish`**: ready 세션 → 매칭 → PortfolioView 조립 → **정규식 마스킹(maskDeep)** → slug → portfolios 저장. E2E로 발행·마스킹(/Users 미노출) 확인.
- 마스킹 1차 시작점: `src/lib/masking/rules.ts` (이메일·API키·JWT·홈경로·전화번호).

**남은 것** 태깅 프롬프트 개선(인용 검증율 ↑) — P4, `npm run eval:models`로 전후 비교. 마스킹 규칙 보강·테스트 — P4.

---

## Step 7. 포트폴리오 페이지 · 마스킹 2차 · 인증 · 검수 🔄 (9/12~9/13)

**9/12 화면 지원 — 역할 B (@Aio1135), `codex/public-portfolio-ui` (main 미반영)**
- 공개 `/p/[slug]`: 4단계 요약, 하이라이트·선정 근거, 단계 필터 타임라인, 이벤트 통계, 도구·분석 등급, 링크 공유.
- 합성 fixture 데모, 랜딩, 모바일 대응, 로딩·오류·없는 페이지 처리. 발행된 데이터만 서버 조회하고 한글 slug를 지원.
- 테스트 74개 통과(선택 실로그 2개 제외). 실제 발행 데이터의 화면 E2E와 배포 확인은 후속 작업.
- 팀 현황과 API 연결 과제: [FRONTEND_HANDOFF.md](FRONTEND_HANDOFF.md).

백엔드는 발행까지 준비됨 — 이 단계는 화면·인증·검수가 전부다.
지금 publish는 **검수 없이 즉시 발행**이므로, 검수 화면이 생기면 P2·P3가 "검수 확정 후 발행"으로 연결한다.

**할 일**
- 공개 포트폴리오 페이지: 타임라인 + 하이라이트 카드 + "AI 기여/인간 개입" 요약 + 사용 도구 목록 + 분석 등급 배지. OG 태그(`opengraph-image.tsx`).
- 마스킹 2차(LLM 검출) + 게시 전 사용자 검수 화면.
- GitHub OAuth (`@supabase/ssr`), 내 포트폴리오 목록.
- UI: shadcn/ui.

**중간 점검 9/14** 실로그 업로드 → 공유 페이지까지 엔드투엔드 1회전. 팀원 있으면 이날까지 프론트(페이지) / 백(파이프라인) 분업 합류점.

---

## Step 8. 데모 · 랜딩 · 스크린샷 ⏳ (9/15~9/16)

- 데모 포트폴리오 3종: ①B-Log 자체 개발 로그(메타 데모) ②팀원 기존 개인 프로젝트 ③"AI에 통째로 맡긴 나쁜 예". 로그인 없이 30초 안에 보이게.
- 랜딩(서비스 소개 + "내 로그 분석하기" CTA), 에러·로딩 상태, 모바일 뷰(투표자는 폰).
- 스크린샷 4장: 랜딩 / 업로드·분석 진행 / 포트폴리오 타임라인+하이라이트 / 메타 데모.
- 대표 이미지 1200×630 (무료 상업용 폰트).
- `/licenses` 페이지 (오픈소스 라이선스 목록).

---

## Step 9. 제출 ⏳ (9/17~9/18) — 초안 준비됨

**[SUBMISSION.md](SUBMISSION.md)** 에 폼 필드 그대로 초안 작성됨(9/10): 제목 후보 3, 500자 본문 429자, 체크박스 7개 지정, 절차 체크리스트. ⚠️ 제출 폼 체크박스에 Upstage가 없어 **500자 본문의 "Upstage Solar Pro 4" 명시가 유일한 기재처** — 지우지 말 것.

- 제출서 작성 후 **'제출' 상태로 가제출** (임시저장은 미제출 처리). 마감 전까지 수정 가능.
- 필수 항목: 대표 이미지, 제목, 해결 문제 한 줄, **AI 활용 방식 500자(사용 도구 실명 필수)**, 서비스 링크, 스크린샷.
- 문구: "Claude Code 세션 로그 분석"이 아니라 **"AI 코딩 도구 무관, 세션 로그와 대화록을 분석"**.
- 9/18 참가 접수 마감 — 팀원 가입·등록 최종 확인.

---

## Step 10. 버퍼 · 확정 ⏳ (9/19~9/20)

- 새 기능 금지, 버그픽스만. 타인 2~3명 첫 사용 테스트.
- 9/20 오전 최종 스크린샷·문구 갱신 → 제출 최종 확정. 이후 수정 불가.

---

## Step 11. 심사 · 투표 기간 운영 ⏳ (9/21~10/5)

- UptimeRobot(5분) → `/api/health`. Vercel Cron은 Hobby에서 하루 1회라 보조.
- LLM 크레딧 잔량 모니터링, 일일 분석 횟수 상한, 데모 3종 결과 캐싱.
- 매일 아침 링크 수동 확인 1회 (접속 불가 시 심사 제외).
- 홍보는 하되 대가성 투표 요청 금지.
- 10/7 TOP20 발표 → 이메일 회신 기한 엄수. 10/17 Demo Day (발표 1장차에 메타 데모, 시연은 사전 녹화 백업).

---

## 확정된 결정 요약

| 항목 | 결정 |
| --- | --- |
| 제품 정체성 | AI 도구 무관(tool-agnostic). 입력 입구 3개(Claude Code · Codex · 범용 대화록), 스키마 1개 |
| MVP 밖 | Cursor/Gemini/Cline/Aider 어댑터, 팀 분석, PDF, 실시간 연동, 다국어 → 확장 로드맵으로만 |
| 스택 | Next.js 16 + Vercel Hobby + Supabase Free, Vercel AI SDK, Octokit, shadcn/ui |
| 안 쓰는 것 | ORM, pgvector(필요 시), 큐 서비스(필요 시), Vercel Supabase 통합 |
| 커밋 규칙 | AI 공동 작성자 트레일러 금지 (훅 + CI 강제) |
| 데모 데이터 | 개인 프로젝트 로그만. 연구실 산출물·타인 개인정보 포함 로그 금지 |
