import { ImageResponse } from "next/og";
import { notoSansKr } from "@/lib/og/font";

export const alt = "B-Log — AI와 함께 만든 과정을 증명하다";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HEADLINE = "결과는 보여줬으니까. 이제, 과정을 증명하세요.";
const SUB = "AI 코딩 세션 로그로 만드는 과정 포트폴리오";

export default async function Image() {
  const font = await notoSansKr(HEADLINE + SUB + "YOUR PROCESS, YOUR PROOF.");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#f4f4ef",
          color: "#1f2a1e",
          fontFamily: "NotoSansKR",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#2f4d2f",
              color: "#f4f4ef",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
            }}
          >
            b·
          </div>
          <div style={{ fontSize: 40 }}>B-Log</div>
        </div>
        <div style={{ fontSize: 26, letterSpacing: 6, color: "#5f6b5d", marginBottom: 18 }}>
          YOUR PROCESS, YOUR PROOF.
        </div>
        <div style={{ fontSize: 58, lineHeight: 1.25, maxWidth: 960 }}>{HEADLINE}</div>
        <div style={{ fontSize: 30, color: "#5f6b5d", marginTop: 26 }}>{SUB}</div>
      </div>
    ),
    { ...size, fonts: [{ name: "NotoSansKR", data: font, weight: 700, style: "normal" }] },
  );
}
