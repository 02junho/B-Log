# fixtures/

P3(프론트)가 백엔드 없이 개발할 때 쓰는 가짜 데이터.

- `portfolio.sample.json` — `PortfolioView` 계약(`src/lib/portfolio/view.ts`, TEAM_PLAN §3.3)의 완전한 예시. **전부 합성 데이터**다(실제 세션 인용·개인정보 없음). 실제 형태는 `npm run portfolio -- <로그파일>`이 만드는 `.parsed/portfolio/*.json`과 동일하며, 그 파일은 마스킹 전이라 레포에 커밋하지 않는다.
- 계약이 바뀌면 이 샘플도 같은 PR에서 갱신한다 (`[계약]` PR 규칙, TEAM_PLAN §6.5).

타입 검증: `tests/portfolio-fixture.test.ts`가 이 파일이 계약과 어긋나면 실패한다.
