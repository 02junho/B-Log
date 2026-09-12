/**
 * OG 이미지용 한글 폰트 로더.
 * ImageResponse(satori)의 기본 폰트에는 한글 글리프가 없다. Google Fonts css2를
 * UA 없이 호출하면 TTF URL을 돌려주므로(무UA=truetype), 그걸 받아 캐시한다.
 * text= 서브셋으로 필요한 글자만 받아 이미지 생성이 수백 ms에 끝난다.
 */

const cache = new Map<string, Promise<ArrayBuffer>>();

export function notoSansKr(text: string, weight: 400 | 700 = 700): Promise<ArrayBuffer> {
  // 서브셋 키가 너무 흩어지지 않게 중복 문자를 제거하고 정렬한다.
  const subset = [...new Set(text + "B-Log ·…")].sort().join("");
  const key = `${weight}:${subset}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const load = (async () => {
    const cssUrl =
      `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}` +
      `&text=${encodeURIComponent(subset)}`;
    const css = await fetch(cssUrl).then((r) => r.text());
    const url = css.match(/src: url\((https:[^)]+)\) format\('truetype'\)/)?.[1];
    if (!url) throw new Error("font url not found in css2 response");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`font fetch failed: ${res.status}`);
    return res.arrayBuffer();
  })();
  cache.set(key, load);
  load.catch(() => cache.delete(key));
  return load;
}
