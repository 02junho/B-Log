# B-Log 프로젝트 지침

이 파일은 이 레포에서 열리는 모든 Claude Code 세션에 자동으로 적용된다.

## 프로젝트 한 줄

AI 코딩 세션 로그(Claude Code, Codex)와 Git 커밋을 분석해 "AI를 어떻게 지휘했는지"를 증명하는 과정 포트폴리오를 만드는 웹 서비스. 원티드 AI Championship 2026 출품작, 제출 마감 2026-09-20.

## 절대 규칙

- `*.jsonl` 세션 로그와 `.env*` 파일은 커밋하지 않는다. `.gitignore`에 이미 있으니 지우지 말 것.
- API 키는 사용자가 직접 `.env.local`에 넣는다. 키 값을 코드나 문서에 쓰지 않는다.
- 새 AI 도구를 쓰기 시작하면 `README.md`의 "사용한 AI 도구" 표에 추가한다 (제출서 필수 항목).
- 소속 기관(연구실) 산출물이나 타인 개인정보가 담긴 로그는 데모 데이터로 쓰지 않는다.

## MVP 범위 (엄수)

- In: Claude Code JSONL 업로드(1순위) + Codex rollout JSONL 어댑터, GitHub 공개 레포 연결, 4단계 태깅(문제 정의 → AI 지시 → 근거 탐색·의사결정 → 실패·복구), 커밋↔대화 매칭, 하이라이트 3~5개(원문 인용), 정규식+LLM 2단계 마스킹, 공개 포트폴리오 페이지, GitHub OAuth.
- Out: Cursor/ChatGPT 등 다른 형식, 팀 분석, PDF 내보내기, 실시간 연동, 다국어. 요청이 와도 "확장 로드맵"으로만 기록한다.

## 기술 스택

Next.js (App Router, TypeScript) + Vercel + Supabase (Postgres, pgvector, Storage, Auth). 커밋 연동은 Octokit. 긴 세션은 잡 테이블 + 청크 단위 처리로 서버리스 타임아웃을 피한다.

## 작업 방식

- 파서는 "공통 정규화 스키마 + 포맷별 어댑터" 구조를 유지한다. 포맷 전용 UI는 만들지 않는다.
- 커밋 메시지는 `type: 요약` 형식(feat, fix, chore, docs, refactor).
- 새 기능보다 엔드투엔드 1회전(업로드 → 포트폴리오 페이지)이 우선이다.
