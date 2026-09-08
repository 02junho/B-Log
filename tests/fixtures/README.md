# Codex rollout fixtures

`codex-rollout.json`은 실제 세션 원문이 아닌 **합성 레코드 배열**입니다.
2026-09-08 B-Log 자체 개발 세션에서 레코드 종류와 payload 키만 확인한 뒤,
대화·경로·ID·도구 입력과 출력은 테스트용으로 새로 작성했습니다.
개인 세션 원문, 개인정보, 키, reasoning은 복사하지 않았습니다.

- 관찰한 구조: `session_meta`, `turn_context`, `response_item`의 message,
  reasoning, custom_tool_call/custom_tool_call_output, `event_msg`의
  item_completed/token_count, token_usage_record, world_state.
- 호환성 사례: function_call/function_call_output, user_message/agent_message
  미러, apply_patch 성공·실패 보고, analysis 채널. 이 사례들은 합성 입력으로
  검증하며, 이번 로컬 세션에서 모두 관찰했다는 의미는 아닙니다.
- `codex-normalized.json`: 위 입력의 기대 공통 이벤트 배열. 분석 코드가 사용할
  스키마의 예제이며, 마스킹 파이프라인을 거친 공개 결과물은 아닙니다.
- 테스트는 JSON 배열 각 요소를 한 줄 JSON 문자열로 바꿔 실제 어댑터에 전달합니다.
  원본 `*.jsonl`을 저장소에 넣기 위해 확장자만 바꾼 파일이 아닙니다.

기본 검증은 `npm test`. 실제 개인 프로젝트 로그 검증은 README의
`BLOG_CODEX_LOG` 옵션을 사용합니다. 원문이나 정규화 결과는 출력·저장하지 않습니다.
