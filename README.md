# B-Log (Build-Log)

> AI 코딩 도구와 협업한 세션 로그를 분석해, **"AI를 어떻게 지휘했는지"를 증명하는 공유 가능한 과정 포트폴리오**를 만들어주는 서비스. **어떤 AI 도구를 썼는지는 상관없습니다.**

누구나 AI로 결과물을 만들 수 있는 시대, 정작 개발자가 'AI를 어떻게 지휘했는지'를 증명할 방법은 없습니다.
B-Log는 세션 로그와 Git 커밋을 함께 분석해 **문제 정의 → AI 지시 → 근거 탐색·의사결정 → 실패·복구**의 흐름을 원문 인용과 함께 타임라인으로 보여줍니다.

Build-Log라는 이름처럼, 도구가 아니라 **빌드 과정**이 주인공입니다. 모든 입력은 B-Log 공통 세션 스키마로 정규화된 뒤 같은 분석 파이프라인을 탑니다.

📋 단계별 진행 상황: [docs/ROADMAP.md](docs/ROADMAP.md) · 👥 4인 역할 분담·일정: [docs/TEAM_PLAN.md](docs/TEAM_PLAN.md)

## 대회

- **원티드 AI Championship 2026** 출품작 (주최: 원티드랩 / 메인 파트너: 크래프톤 Cofa)
- 제출 마감: 2026-09-20

## 팀

| 이름 | GitHub | 역할 |
| --- | --- | --- |
| 준호 | [@02junho](https://github.com/02junho) | 기획 · 파이프라인 · 배포 |
| Aio1135 | [@Aio1135](https://github.com/Aio1135) | 역할 B: Codex rollout 어댑터 · fixture 테스트 · 파서 검증 |
| (팀원) | @ | |

## 입력 방식 (MVP: 입구 3개, 스키마 1개)

| 입구 | 대상 | 분석 등급 |
| --- | --- | --- |
| Claude Code 어댑터 | `~/.claude/projects/<project>/*.jsonl` | 정밀 분석 (시간 · 도구 호출 · 파일 변경 포함) |
| Codex CLI 어댑터 | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | 정밀 분석 |
| 범용 대화록 | 텍스트 · 마크다운 붙여넣기, ChatGPT 등 내보내기 파일 | 요약 분석 (태깅 · 하이라이트 · 마스킹은 동일, 커밋 매칭은 텍스트 유사도만) |

- 정형 로그 2종의 어댑터와 형식 자동 판별은 구현됐습니다. 범용 대화록 입구는 구현 예정입니다.
- 포트폴리오 페이지에는 **분석 등급 배지**를 표시합니다. 정형 로그를 주면 더 정밀해진다는 것을 숨기지 않습니다.
- 어댑터 인터페이스는 함수 하나(줄 배열 → `BLogSession`)입니다. 다른 도구는 커뮤니티가 추가할 수 있도록 인터페이스 문서를 공개합니다.

**확장 로드맵 (이번 MVP 제외)**: Cursor · Gemini CLI · Cline · Aider 어댑터, 팀 단위 분석, PDF 내보내기, 실시간 연동, 다국어.

## 파서 (공통 스키마 + 어댑터)

모든 입구는 `src/lib/parser/schema.ts`의 **`BLogSession`** 하나로 정규화됩니다.
분석 코드는 이 타입만 보고, 어떤 도구의 로그였는지는 `source`로만 압니다.

```ts
import { parseSession, detectFormat } from "@/lib/parser";

const lines = contents.split(/\r?\n/);
const session = parseSession(lines);          // 형식 자동 판별
const codex = parseSession(lines, "codex");   // 형식 강제
```

| 파일 | 역할 |
| --- | --- |
| `src/lib/parser/schema.ts` | 공통 타입 `BLogSession` · `BLogEvent` (TEAM_PLAN §3.1 계약) |
| `src/lib/parser/detect.ts` | 첫 30줄의 레코드 타입으로 입구 판별 |
| `src/lib/parser/adapters/claude-code.ts` | Claude Code JSONL 어댑터 |
| `src/lib/parser/adapters/codex.ts` | Codex rollout JSONL 어댑터 |
| `src/lib/parser/git.ts` | 로그 안의 커밋 확정 추출 (커밋 매칭 1단계) |
| `src/lib/parser/stats.ts` | 이벤트·도구·커밋 통계 (`PortfolioView.stats` 재료) |

어댑터 인터페이스는 함수 하나입니다: `(lines: string[]) => BLogSession`.
파일 읽기, 형식 판별, 마스킹은 어댑터 밖에서 처리합니다. 범용 대화록 입구는
LLM 구조화가 필요해서 이 동기 경로 밖에 있고, 아직 연결 전입니다. 판별에
실패한 파일은 절반만 파싱하지 않고 오류를 냅니다.

### CLI

```sh
npm run parse -- <로그 파일> --stats                    # 원문 없이 통계만
npm run parse -- <로그 파일> --out .parsed/session.json  # 정규화 JSON 파일로
npm run parse -- <로그 파일> --format codex             # 자동 판별 대신 강제
```

출력은 **정규화만 된 상태이고 마스킹 전**입니다. 세션 원문과 같은 취급을 하세요.
`--out`은 `.parsed/`(gitignore됨) 또는 레포 밖 경로로 쓰고, 공유하지 마세요.
판별에 실패하면 절반만 파싱하지 않고 오류를 냅니다.

### 두 어댑터의 공통 규칙

- 사용자·AI 발화를 파일 순서대로 복원하고, 이벤트마다 세션 내 순번 ID(`e0001`)를 붙입니다.
- 도구 호출과 결과는 `toolCalls[].id` ↔ `toolResults[].callId`로 연결합니다.
  병렬 호출, 결과 없는 호출, 호출 없는 결과도 원래 순서와 ID를 보존합니다.
- 모델의 내부 사고(Claude Code `thinking`, Codex `reasoning`/analysis)는 제외합니다.
  협업 기록이 아니라 초안이기 때문입니다.
- `filesChanged`는 **성공한 쓰기 도구의 보고**에만 채웁니다. 셸 명령 안의 파일 쓰기는 추정하지 않습니다.
- `gitCommit`은 git 자신이 확인해 준 경우에만 기록합니다(호스트가 준 sha 또는 `[branch sha]` 보고).
  훅에 막힌 커밋, 스테이지가 빈 커밋, `git log` 같은 조회 명령은 커밋이 되지 않습니다.
- 실패한 도구 결과는 `isError`로 표시합니다. 4단계 태깅의 "실패·복구" 입구입니다.
- 빈 줄·BOM·알 수 없는 레코드는 허용합니다. 손상된 JSON은 원문 없이 줄 번호로 오류를 냅니다.
  텍스트 블록만 추출하고 이미지 데이터는 제외합니다.

### Claude Code 어댑터

`user`·`assistant` 레코드만 대화로 취급합니다. `attachment`, `system`,
`queue-operation`, 각종 title 레코드 등 호스트 기록은 무시하며, 모르는 타입도
같은 방식으로 넘어갑니다(전방 호환).

- 슬래시 명령 반향(`<command-name>` 등), 호스트 알림, `isMeta` 레코드는 사용자 발화가 아니므로 제외합니다.
- `<system-reminder>` 블록은 발화와 도구 결과 양쪽에서 제거합니다. 호스트가 모델에게
  주입한 지시라서, 그대로 두면 태깅 프롬프트에 남의 지시가 섞입니다.
- 서브에이전트 대화(`isSidechain`)는 제외합니다. 메인 스레드에 호출과 결과가 남습니다.
- `filesChanged`는 Edit·MultiEdit·Write·NotebookEdit 결과의 `filePath`만 사용합니다. Read는 제외합니다.
- 한 레코드에 결과가 여러 개면 `toolUseResult`를 특정 결과에 귀속할 수 없으므로
  파일 변경·커밋을 주장하지 않습니다.

### Codex 어댑터 (역할 B)

담당: [@Aio1135](https://github.com/Aio1135). 9/8 어댑터·fixture 구현 및 실제 로그 검증.
9/9에 공통 스키마·CLI로 통합했습니다.

- `response_item`이 기준입니다. `event_msg`는 중복 방지를 위해 제외하고,
  `response_item`이 없는 로그는 지원하지 않습니다.
- 시스템·개발자 메시지, 알려진 AGENTS/환경 지침 메시지를 제외합니다.
- `session_meta`에서 `cwd`와 세션 시작 시각을 가져옵니다.
- `filesChanged`는 직접 호출한 `apply_patch`의 성공 보고 경로만 넣습니다.
  중첩 스크립트는 원문 입력으로 보존하되 파일 변경을 추정하지 않습니다.
- 도구 결과 블록은 `input_text` 타입입니다(모델의 다음 입력이라서). 세 타입 모두 읽습니다.
- 중첩 스크립트 안의 `git commit`은 git의 `[branch sha]` 보고가 함께 있을 때만 커밋으로 인정합니다.

## 검증

```sh
npm ci
npm test
npm run lint
npm run typecheck
```

추가 테스트 의존성 없이 TypeScript와 Node 내장 테스트 러너를 사용합니다.
[합성 fixture와 기대 결과](tests/fixtures/README.md)를 커밋하며 실제 JSONL은 포함하지 않습니다.
실제 개인 프로젝트 로그를 원문 출력·저장 없이 추가 검증하려면 PowerShell에서:

```powershell
$env:BLOG_CLAUDE_LOG = 'C:\private\session-example.jsonl'
$env:BLOG_CODEX_LOG  = 'C:\private\rollout-example.jsonl'
npm test
Remove-Item Env:BLOG_CLAUDE_LOG, Env:BLOG_CODEX_LOG
```

두 검사는 환경변수가 있을 때만 돌고, 실패해도 세션 원문을 출력하지 않도록
불리언·개수만 단언합니다. 로컬 검증은 사용자·AI 발화와 도구 호출·결과 쌍이 있는
세션을 대상으로 합니다. 정규식/LLM 마스킹과 공개 전 검수는 아직 구현 전이므로
어댑터 출력은 공개용 데이터가 아닙니다.

## 기술 스택

- Next.js 16 (App Router, TypeScript, Tailwind v4) · Vercel
- Supabase (Postgres + Storage + GitHub OAuth, `@supabase/ssr`)
- LLM: Vercel AI SDK로 추상화. 메인 모델은 Upstage Solar Pro 4 vs Claude Sonnet 5 비교 후 결정
- 커밋↔대화 매칭: 로그 안의 커밋 호출 → 타임스탬프 → 임베딩 유사도 순 (pgvector는 필요 시 추가)
- GitHub REST API (Octokit)

자세한 설계 근거와 무료 티어 제약은 [CLAUDE.md](CLAUDE.md)에 있습니다.

## 사용한 AI 도구

> 대회 제출서의 필수 기재 항목입니다. 새 도구를 쓰기 시작하면 **반드시 여기에 추가**합니다.

| 도구 | 용도 |
| --- | --- |
| Claude Code (Anthropic) | 설계 논의, 코드 구현, 커밋. 0번째 커밋부터 모든 개발 세션 로그를 보존해 메타 데모 데이터로 사용 |
| Claude (claude.ai) | 기획 · 실행 계획 수립 · 인수인계 문서 작성 |
| Codex (OpenAI) | 역할 B: rollout 어댑터·공통 이벤트 타입·fixture 테스트 구현, 로컬 로그 검증, 문서 갱신 |

## 개발 규칙

1. 모든 개발은 AI 도구와 함께 진행하고, 세션 로그를 지우지 않는다. (주 1회 백업, 레포 밖 비공개 저장소로)
2. 세션 로그(`*.jsonl`)와 API 키(`.env*`)는 절대 레포에 올리지 않는다.
3. 사용한 AI 도구는 위 표에 계속 기록한다.
4. 커밋 메시지에 AI 공동 작성자 표기(`Co-Authored-By: Claude ...` 등)를 넣지 않는다. 기여자 목록은 팀원만 보이게 하고, AI 사용은 README와 세션 로그로 증명한다.
