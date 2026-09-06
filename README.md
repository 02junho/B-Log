# B-Log (Build-Log)

> AI 코딩 도구와 협업한 세션 로그를 분석해, **"AI를 어떻게 지휘했는지"를 증명하는 공유 가능한 과정 포트폴리오**를 만들어주는 서비스.

누구나 AI로 결과물을 만들 수 있는 시대, 정작 개발자가 'AI를 어떻게 지휘했는지'를 증명할 방법은 없습니다.
B-Log는 세션 로그와 Git 커밋을 함께 분석해 **문제 정의 → AI 지시 → 근거 탐색·의사결정 → 실패·복구**의 흐름을 원문 인용과 함께 타임라인으로 보여줍니다.

## 대회

- **원티드 AI Championship 2026** 출품작 (주최: 원티드랩 / 메인 파트너: 크래프톤 Cofa)
- 제출 마감: 2026-09-20

## 팀

| 이름 | GitHub | 역할 |
| --- | --- | --- |
| 준호 | [@02junho](https://github.com/02junho) | 기획 · 파이프라인 · 배포 |
| (팀원) | @ | |
| (팀원) | @ | |

## 지원 로그 형식 (MVP)

| 도구 | 로그 위치 | 상태 |
| --- | --- | --- |
| Claude Code | `~/.claude/projects/<project>/*.jsonl` | 1순위 |
| OpenAI Codex CLI | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | 어댑터 추가 예정 |

Cursor · ChatGPT 등 다른 형식, 팀 단위 분석, PDF 내보내기, 실시간 연동은 이번 MVP 범위 밖이며 확장 로드맵으로만 다룹니다.

## 기술 스택

- Next.js (App Router, TypeScript) · Vercel
- Supabase (Postgres + pgvector + Storage + GitHub OAuth)
- GitHub REST API (Octokit)
- LLM: 결정 예정 (Claude API vs Upstage Solar 비교 후)

## 사용한 AI 도구

> 대회 제출서의 필수 기재 항목입니다. 새 도구를 쓰기 시작하면 **반드시 여기에 추가**합니다.

| 도구 | 용도 |
| --- | --- |
| Claude Code (Anthropic) | 설계 논의, 코드 구현, 커밋. 0번째 커밋부터 모든 개발 세션 로그를 보존해 메타 데모 데이터로 사용 |
| Claude (claude.ai) | 기획 · 실행 계획 수립 · 인수인계 문서 작성 |

## 개발 규칙

1. 모든 개발은 AI 도구와 함께 진행하고, 세션 로그를 지우지 않는다. (주 1회 백업, 레포 밖 비공개 저장소로)
2. 세션 로그(`*.jsonl`)와 API 키(`.env*`)는 절대 레포에 올리지 않는다.
3. 사용한 AI 도구는 위 표에 계속 기록한다.
