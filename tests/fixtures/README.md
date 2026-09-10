# 파서 fixture

`codex-rollout.json`과 `claude-code-session.json`은 실제 세션 원문이 아닌
**합성 레코드 배열**입니다. 실제 로그에서 레코드 종류와 키 구조만 확인한 뒤,
대화·경로·ID·도구 입력과 출력은 테스트용으로 새로 작성했습니다.
개인 세션 원문, 개인정보, 키, reasoning/thinking은 복사하지 않았습니다.

`*-normalized.json`은 각 입력의 기대 `BLogSession`입니다. 분석 코드가 사용할
스키마의 예제이며, 마스킹 파이프라인을 거친 공개 결과물은 아닙니다.
테스트는 JSON 배열의 각 요소를 한 줄 JSON 문자열로 바꿔 실제 어댑터에 전달합니다.
원본 `*.jsonl`을 저장소에 넣기 위해 확장자만 바꾼 파일이 아닙니다.

입력 안의 `SENTINEL_*` 값은 **정규화 결과에 나오면 안 되는 것들**입니다.
스냅샷 테스트가 결과 전체에 `SENTINEL`이 없음을 함께 단언합니다.

## codex-rollout.json (2026-09-08)

- 관찰한 구조: `session_meta`, `turn_context`, `response_item`의 message,
  reasoning, custom_tool_call/custom_tool_call_output, `event_msg`의
  item_completed/token_count, token_usage_record, world_state.
- 호환성 사례: function_call/function_call_output, user_message/agent_message
  미러, apply_patch 성공·실패 보고, analysis 채널. 이 사례들은 합성 입력으로
  검증하며, 특정 로컬 세션에서 모두 관찰했다는 의미는 아닙니다.

## claude-code-session.json (2026-09-09)

- 관찰한 구조: `user`(문자열 content / tool_result 배열), `assistant`(text ·
  thinking · tool_use 블록), `attachment`, `system`, `queue-operation`,
  `last-prompt`, 그리고 `toolUseResult`의 Edit·Write·Read·Bash 모양.
- 제외돼야 하는 사례: 슬래시 명령 반향, `isMeta`, `isSidechain`,
  `<system-reminder>` 블록, 이미지 블록, 호스트 기록 레코드.
- 커밋·파일 변경 사례: `gitOperation.commit.sha`가 있는 Bash 결과,
  `filePath`가 있는 Edit 결과, 실패(`is_error`) 결과.

## 실행

9/9 Codex 회귀 사례는 `tests/codex.test.ts`에도 합성 입력으로 정의한다.
실제 B-Log 로그에서 확인한 Desktop JSON 결과 구조(`chunk_id`, `wall_time_seconds`,
`exit_code`, `output`)를 사용하며 내용은 새로 작성했다. 성공/실패 혼합·음수 종료 코드·
호스트 지침 제거·일반 JSON 오인 방지를 검증한다.

기본 검증은 `npm test`. 실제 개인 프로젝트 로그 검증은 README의
`BLOG_CLAUDE_LOG` · `BLOG_CODEX_LOG` 옵션을 사용합니다. 두 검사는 실패해도
세션 원문이 출력되지 않도록 불리언과 개수만 단언합니다.
