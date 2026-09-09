# B-Log 프로젝트 지침

이 파일은 이 레포에서 열리는 모든 Claude Code 세션에 자동으로 적용된다.

## 프로젝트 한 줄

AI 코딩 세션 로그와 Git 커밋을 분석해 "AI를 어떻게 지휘했는지"를 증명하는 과정 포트폴리오를 만드는 웹 서비스. **AI 도구 무관(tool-agnostic)**이 제품 정체성이다. 원티드 AI Championship 2026 출품작, 제출 마감 2026-09-20.

## 절대 규칙

- 커밋 메시지에 `Co-Authored-By` 등 AI 공동 작성자 트레일러를 넣지 않는다. PR 본문에도 "Generated with ..." 문구를 넣지 않는다. (GitHub contributors에 AI 계정이 뜨지 않게 하기 위함.) 안전장치 3겹: `.claude/settings.json`의 `includeCoAuthoredBy: false`, `npm install` 시 자동 활성화되는 `.githooks/commit-msg`(트레일러 자동 제거), GitHub Actions `no-ai-coauthor`(푸시된 커밋 검사).
- `*.jsonl` 세션 로그와 `.env*` 파일은 커밋하지 않는다. `.gitignore`에 이미 있으니 지우지 말 것.
- API 키는 사용자가 직접 `.env.local`에 넣는다. 키 값을 코드나 문서에 쓰지 않는다.
- 새 AI 도구를 쓰기 시작하면 `README.md`의 "사용한 AI 도구" 표에 추가한다 (제출서 필수 항목).
- 소속 기관(연구실) 산출물이나 타인 개인정보가 담긴 로그는 데모 데이터로 쓰지 않는다.

## MVP 범위 (엄수)

- In: 입력 입구 3개 — ①Claude Code JSONL 어댑터(1순위) ②Codex rollout JSONL 어댑터 ③범용 대화록(텍스트/마크다운/내보내기 파일을 LLM으로 공통 스키마에 구조화). GitHub 공개 레포 연결, 4단계 태깅(문제 정의 → AI 지시 → 근거 탐색·의사결정 → 실패·복구), 커밋↔대화 매칭, 하이라이트 3~5개(원문 인용), 정규식+LLM 2단계 마스킹, 분석 등급 배지(정밀/요약), 공개 포트폴리오 페이지, GitHub OAuth.
- Out: Cursor/Gemini CLI/Cline/Aider 등 추가 어댑터, 팀 분석, PDF 내보내기, 실시간 연동, 다국어. 요청이 와도 "확장 로드맵"으로만 기록한다. **어댑터는 정형 2개 + 범용 1개에서 늘리지 않는다.**

## 기술 스택 (2026-09-06 재검토 반영)

- **프레임워크·배포**: Next.js 16 (App Router, TypeScript, Tailwind v4, `src/`) + Vercel Hobby. Next 16은 학습 데이터와 다르니 코드 작성 전 `node_modules/next/dist/docs/`를 먼저 읽는다.
- **데이터**: Supabase Free (Postgres, Storage, Auth). 마이그레이션은 Supabase CLI SQL 파일을 레포에 커밋하고 `supabase gen types`로 타입 생성. ORM은 쓰지 않는다.
- **인증**: Supabase GitHub OAuth. App Router 쿠키 세션은 `@supabase/ssr`로 처리한다(기본 `supabase-js`만으로는 서버 컴포넌트에서 세션이 안 잡힘).
- **LLM 호출**: **Upstage Solar Pro 4 단독** (2026-09-09 확정 — Anthropic API는 쓰지 않는다). Vercel AI SDK(`ai` + `@ai-sdk/openai-compatible`)로 추상화하고 파이프라인 코드는 provider를 모른다. 태깅은 JSON 모드(`generateObject` + zod) + 실패 시 1회 재시도가 프로덕션 경로다. 검증 안 된 인용(원문에 그대로 없는 quote)은 자동 제외한다. 임베딩도 Upstage `solar-embedding-1-large`로 단일화. 프롬프트 변경은 `npm run eval:models`로 전후 지표(유효율·인용 검증율)를 비교하고 반영한다.
- **커밋↔대화 매칭 3단계**: ①로그 안의 git commit 도구 호출로 정확 매칭 → ②타임스탬프 창 → ③임베딩 코사인 유사도(대화록 등급 전용). 임베딩은 인메모리로 계산하고, **pgvector는 ③이 실제로 필요해질 때만** 컬럼 추가.
- **긴 세션 처리**: 잡 테이블 + 청크 병렬 태깅(동시성 제한)으로 Vercel 함수 한도 300초 안에 끝낸다. 넘치면 자기 자신을 다시 호출하는 체인. Inngest 등 큐 서비스는 실측에서 넘칠 때만 붙인다.
- **커밋 연동**: Octokit(GitHub REST, 공개 레포). `GITHUB_TOKEN`은 rate limit 완화용.
- **UI**: shadcn/ui. OG 이미지는 Next 내장 `opengraph-image.tsx`.

### 무료 티어 제약 (설계에 반영됨)

- Vercel Hobby: 함수 최대 300초(고정). Cron은 하루 1회만 → 심사 기간 슬립 방지는 UptimeRobot이 `/api/health`를 5분마다 호출.
- Supabase Free: **DB 쿼리가 7일간 없으면 프로젝트 일시정지**(대시보드 방문·캐시 응답은 활동 아님). `/api/health`는 반드시 실제 테이블(`heartbeat`)을 조회한다. 500MB DB, 1GB Storage.
- LLM 비용: 투표 기간(9/21~10/5)에는 일일 분석 횟수 상한 + 데모 3종 결과 캐싱.

## 작업 방식

- 파서는 "공통 정규화 스키마 + 포맷별 어댑터" 구조를 유지한다. 분석 코드는 공통 스키마만 본다. 어댑터는 함수 하나(`(lines) => BLogSession`)로 끝나야 하고, 포맷 전용 UI는 만들지 않는다.
- 공통 스키마의 원본은 문서가 아니라 **`src/lib/parser/schema.ts`의 코드**다. 세션은 `BLogSession { source: { tool, fidelity }, cwd?, startedAt?, events }`, 이벤트는 `BLogEvent { id, role, ts?, text, toolCalls?, toolResults?, filesChanged?, gitCommit? }`. 도구 호출과 결과는 `toolCalls[].id` ↔ `toolResults[].callId`로 짝짓는다. 스키마를 바꾸면 P2·P3·P4 전원에게 알린다.
- 파서가 지키는 원칙: 추정하지 않는다. `filesChanged`는 성공한 쓰기 도구의 보고에만, `gitCommit`은 git이 확인해 준 커밋에만 채운다. 모델의 내부 사고(thinking·reasoning)와 호스트 주입 텍스트(`<system-reminder>`, 슬래시 명령 반향)는 공통 스키마에 넣지 않는다.
- 커밋 메시지는 `type: 요약` 형식(feat, fix, chore, docs, refactor).
- 새 기능보다 엔드투엔드 1회전(업로드 → 포트폴리오 페이지)이 우선이다.
