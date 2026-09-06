# B-Log — 에이전트 공통 지침 (Codex 등)

이 레포의 프로젝트 규칙은 **`CLAUDE.md`가 원본**입니다. 작업을 시작하기 전에 `CLAUDE.md`를 먼저 읽고 그대로 따르세요. 요약:

- 커밋 메시지에 AI 공동 작성자 트레일러(`Co-Authored-By` 등)를 넣지 않는다. 로컬 훅(`.githooks/commit-msg`)과 CI가 강제한다.
- `*.jsonl` 세션 로그와 `.env*` 파일은 커밋하지 않는다. API 키 값을 코드·문서에 쓰지 않는다.
- 새 AI 도구를 쓰기 시작하면 `README.md`의 "사용한 AI 도구" 표에 추가한다.
- MVP 범위(입력 입구 3개: Claude Code 어댑터, Codex 어댑터, 범용 대화록)를 늘리지 않는다.
- 파서는 "공통 스키마 + 어댑터" 구조를 유지하고, 분석 코드는 공통 스키마만 본다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
