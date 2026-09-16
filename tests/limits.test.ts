import assert from "node:assert/strict";
import { test } from "node:test";
import { seoulDayStartIso } from "../src/lib/limits";

test("seoulDayStartIso: 서울 자정 기준으로 같은 날은 같은 시작점", () => {
  // 서울 9/17 01:00 (= UTC 9/16 16:00)과 서울 9/17 23:00은 같은 날
  assert.equal(
    seoulDayStartIso(new Date("2026-09-16T16:00:00Z")),
    "2026-09-17T00:00:00+09:00",
  );
  assert.equal(
    seoulDayStartIso(new Date("2026-09-17T14:00:00Z")),
    "2026-09-17T00:00:00+09:00",
  );
  // 서울 자정 직전(UTC 14:59)은 전날
  assert.equal(
    seoulDayStartIso(new Date("2026-09-16T14:59:00Z")),
    "2026-09-16T00:00:00+09:00",
  );
});
