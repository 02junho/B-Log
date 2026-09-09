# B-Log 단계별 진행 문서

> 마지막 갱신: 2026-09-09 (D-11). 단계가 끝날 때마다 이 문서를 갱신한다.
> 상태 표기: ✅ 완료 · 🔄 진행 중 · ⏳ 예정 · ⚠️ 주의
> ⚠️ 9/9 기준 Step 3·4 완료(모델: Upstage Solar Pro 4 단독). Step 5(데이터·업로드)부터 진행. 4인 병렬 분담과 날짜별 계획은 **[TEAM_PLAN.md](TEAM_PLAN.md)** 를 따른다(Step 4~7을 역할별로 동시 진행).

## 한눈에 보기

| Step | 내용 | 기한 | 상태 |
| --- | --- | --- | --- |
| 1 | 레포 · 첫 커밋 · 세션 로그 보존 | 9/4 | ✅ |
| 2 | 배포 골격 (Next.js → Vercel → Supabase) | 9/5 | ✅ (9/6 완료) |
| 3 | 파서 스파이크 (최대 리스크 먼저) | 9/6~9/7 | ✅ (9/9 완료. 마스킹은 Step 5로) |
| 4 | LLM 모델 · 프롬프트 v1 결정 | 9/7 | ✅ (9/9 Solar 단독 확정) |
| 5 | 데이터 모델 · 업로드 · 잡 파이프라인 | 9/8~9/9 | ⏳ |
| 6 | 4단계 태깅 · 커밋 매칭 · 하이라이트 | 9/10~9/11 | ⏳ |
| 7 | 포트폴리오 페이지 · 마스킹 · GitHub OAuth | 9/12~9/13 | ⏳ |
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
4. 주 1회 로그를 레포 밖 비공개 저장소에 백업
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

## Step 5. 데이터 모델 · 업로드 · 잡 파이프라인 ⏳ (9/8~9/9)

**할 일**
- 테이블: `projects`, `sessions`, `chunks`, `findings`, `portfolios`, `jobs`(상태·진행률). SQL 마이그레이션으로 커밋, `db:types`로 타입 생성.
- 업로드 → Supabase Storage 저장 → 잡 생성 → 파싱·청킹 (Step 3 파서 재사용).
- 입력 입구 3개: Claude Code 어댑터, Codex 어댑터, **범용 대화록**(텍스트·마크다운·내보내기 파일을 LLM으로 공통 스키마에 구조화). 자동 판별 실패 시 범용 경로로.
- 긴 세션: 청크 병렬 태깅(동시성 제한)으로 Vercel 300초 안에 처리. 넘치면 자기 자신을 다시 호출하는 체인. 큐 서비스는 실측에서 넘칠 때만.
- 마스킹 1차(정규식: 이메일·API 키·경로).

---

## Step 6. 4단계 태깅 · 커밋 매칭 · 하이라이트 ⏳ (9/10~9/11)

**할 일**
- 4단계 태깅 프롬프트 완성(few-shot), 하이라이트 3~5개 추출(원문 인용 스팬 보존).
- 커밋↔대화 매칭 3단계: ①로그 안의 git commit 도구 호출(정확) → ②타임스탬프 창 → ③임베딩 유사도(대화록 등급). pgvector는 ③이 실제로 필요할 때만.
- GitHub 공개 레포 커밋 조회(Octokit).
- 분석 등급 배지: 정형 로그 = "정밀 분석", 대화록 = "요약 분석".

---

## Step 7. 포트폴리오 페이지 · 마스킹 · 인증 ⏳ (9/12~9/13)

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

## Step 9. 제출 ⏳ (9/17~9/18)

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
