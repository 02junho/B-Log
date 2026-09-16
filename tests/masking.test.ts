import assert from "node:assert/strict";
import test from "node:test";
import { maskText, maskDeepCounted } from "../src/lib/masking/rules";
import { maskPortfolio, type MaskRunner } from "../src/lib/masking/detect";
import type { MaskingOutput } from "../src/lib/prompts/masking";

const runnerOf =
  (candidates: MaskingOutput["candidates"]): MaskRunner =>
  async () => ({ output: { candidates }, inputTokens: 0, outputTokens: 0 });

test("정규식이 잡아야 할 것들", () => {
  const cases: [string, string][] = [
    ["문의는 me.dev+tag@example.co.kr 로", "[이메일]"],
    ["export UPSTAGE_API_KEY=up_abcdefgh1234", "[API키]"],
    ["Authorization: Bearer abcdefghijklmnop1234", "Bearer [토큰]"],
    ["token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdef", "[토큰]"],
    ["연락처 010-1234-5678 입니다", "[전화번호]"],
    ["주민번호 900101-1234567", "[주민번호]"],
    ["훅 https://hooks.slack.com/services/T0/B0/xxxxyyyy", "[웹훅URL]"],
    ["postgres://admin:s3cretpw@db.internal:5432/app", "://[계정]:[비밀번호]@"],
    ["서버 10.0.12.34 에서", "[IP]"],
  ];
  for (const [input, expected] of cases) {
    assert.ok(maskText(input).includes(expected), `실패: ${expected}`);
  }
});

test("Windows 홈 경로도 가려진다 — 이 팀 로그의 대부분이 이 형태다", () => {
  assert.equal(
    maskText("파일은 C:\\Users\\jiwon\\project\\a.ts 에 있다"),
    "파일은 C:\\Users\\[사용자]\\project\\a.ts 에 있다",
  );
  assert.equal(
    maskText("/home/jiwon/project/a.ts"),
    "/Users/[사용자]/project/a.ts",
  );
});

test("카드번호는 Luhn을 통과할 때만 가린다", () => {
  assert.ok(maskText("카드 4242 4242 4242 4242 결제").includes("[카드번호]"));
  // 자릿수만 맞고 Luhn이 틀린 숫자열은 주문번호일 수 있으니 남긴다.
  assert.ok(maskText("주문번호 1234567890123").includes("1234567890123"));
});

test("공개 주소와 버전 문자열은 남긴다", () => {
  assert.ok(maskText("localhost 127.0.0.1 로 접속").includes("127.0.0.1"));
  assert.ok(maskText("next 16.3.4 로 올림").includes("16.3.4"));
});

test("비밀키 블록은 통째로 사라진다", () => {
  const text = [
    "-----BEGIN RSA PRIVATE KEY-----",
    "AAAAFAKEKEYMATERIALDONOTUSE",
    "-----END RSA PRIVATE KEY-----",
  ].join("\n");
  assert.equal(maskText(text), "[비밀키]");
});

test("깊은 객체를 마스킹하고 규칙별로 센다", () => {
  const { masked, hits, total } = maskDeepCounted({
    a: "a@b.com",
    b: ["C:\\Users\\kim\\x", { c: "010-1111-2222" }],
    n: 7,
  });
  assert.equal(masked.a, "[이메일]");
  assert.equal(masked.b[0], "C:\\Users\\[사용자]\\x");
  assert.equal((masked.b[1] as { c: string }).c, "[전화번호]");
  assert.equal(masked.n, 7, "문자열이 아닌 값은 그대로");
  assert.deepEqual(hits, { email: 1, "home-path-win": 1, "phone-kr": 1 });
  assert.equal(total, 3);
});

test("LLM 후보는 결정론적으로 치환되고 보고서에 기록된다", async () => {
  const view = {
    title: "박서준과 함께한 리팩터링",
    timeline: [{ quote: "박서준 선임이 사내 wiki.corp.internal 문서를 줬다" }],
  };
  const { masked, report } = await maskPortfolio(
    view,
    runnerOf([
      { text: "박서준", category: "person", confidence: 0.9 },
      { text: "wiki.corp.internal", category: "host", confidence: 0.8 },
    ]),
  );
  assert.equal(masked.title, "[이름]과 함께한 리팩터링");
  assert.equal(masked.timeline[0].quote, "[이름] 선임이 사내 [내부주소] 문서를 줬다");
  assert.equal(report.level, "regex+llm");
  assert.equal(report.llmApplied, 2);
  assert.equal(report.llmRejected, 0);
  assert.deepEqual(report.categories, { person: 1, host: 1 });
});

test("원문에 없는 후보는 버린다 — 모델이 지어낸 문자열로 본문을 바꾸지 않는다", async () => {
  const view = { quote: "로그인 실패를 고쳤다" };
  const { masked, report } = await maskPortfolio(
    view,
    runnerOf([{ text: "김철수", category: "person", confidence: 0.95 }]),
  );
  assert.equal(masked.quote, "로그인 실패를 고쳤다", "원문 보존");
  assert.equal(report.llmApplied, 0);
  assert.equal(report.llmRejected, 1);
});

test("확신이 낮거나 자리표시자인 후보는 적용하지 않는다", async () => {
  const view = { quote: "배포는 [이름]이 했고 sample 값이다" };
  const { report } = await maskPortfolio(
    view,
    runnerOf([
      { text: "sample", category: "person", confidence: 0.1 },
      { text: "[이름]", category: "person", confidence: 0.9 },
    ]),
  );
  assert.equal(report.llmApplied, 0);
  assert.equal(report.llmRejected, 0);
});

test("긴 후보를 먼저 치환해 짧은 후보가 일부만 먹지 않는다", async () => {
  const view = { quote: "담당은 김민수 책임과 김민수다" };
  const { masked } = await maskPortfolio(
    view,
    runnerOf([
      { text: "김민수", category: "person", confidence: 0.9 },
      { text: "김민수 책임", category: "person", confidence: 0.9 },
    ]),
  );
  assert.equal(masked.quote, "담당은 [이름]과 [이름]다");
});

test("LLM이 실패해도 발행은 막지 않고 열화를 기록한다", async () => {
  const view = { quote: "연락처 a@b.com 확인" };
  const failing: MaskRunner = async () => {
    throw new Error("upstream 500: provider detail");
  };
  const { masked, report } = await maskPortfolio(view, failing);
  assert.equal(masked.quote, "연락처 [이메일] 확인", "1차 결과는 유지");
  assert.equal(report.level, "regex-only");
  assert.equal(report.regexTotal, 1);
  assert.ok(report.degradedReason);
  assert.doesNotMatch(report.degradedReason!, /provider detail|500/);
});

test("2차를 끄면 열화 사유가 남는다", async () => {
  const { report } = await maskPortfolio({ quote: "평범한 문장" }, null);
  assert.equal(report.level, "regex-only");
  assert.ok(report.degradedReason);
});

test("입력 객체를 변경하지 않는다", async () => {
  const view = { quote: "메일 a@b.com" };
  await maskPortfolio(view, runnerOf([]));
  assert.equal(view.quote, "메일 a@b.com");
});
