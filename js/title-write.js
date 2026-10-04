// 제목 획순 그리기 (인트로·획 미리보기 페이지가 같이 쓴다).
// 마스크 안의 획 경로(pathLength=1)를 stroke-dashoffset 1 → 0으로. 획 시간은 길이에 비례, 획·글자 사이에 쉼.
// (모션 원칙 예외: stroke-dashoffset은 마스크 안 획에만, 인트로 동안만)

export function readTiming(svg) {
  return JSON.parse(svg.dataset.timing || '{}');
}

// 획 목록: [{el, glyph, len}], 쓰는 순서대로 (빌드가 그 순서로 그려 둔다)
export function strokesOf(svg) {
  return [...svg.querySelectorAll('mask path[data-glyph]')].map((el) => ({
    el, glyph: el.dataset.glyph, len: el.getTotalLength(),
  }));
}

// 각 획의 시작 시각·길이(ms). total = 쓰기 전체 길이(쉼 포함)
export function schedule(strokes, t) {
  const pauses = strokes.reduce((n, s, i) => {
    if (!i) return n;
    return n + (s.glyph !== strokes[i - 1].glyph ? t.letter_pause_ms : t.stroke_pause_ms);
  }, 0);
  const totalLen = strokes.reduce((a, s) => a + s.len, 0) || 1;
  const drawMs = Math.max(200, t.write_ms - pauses);
  let at = 0;
  return strokes.map((s, i) => {
    if (i) at += s.glyph !== strokes[i - 1].glyph ? t.letter_pause_ms : t.stroke_pause_ms;
    const dur = (drawMs * s.len) / totalLen;
    const item = { ...s, at, dur };
    at += dur;
    return item;
  });
}

export function setProgress(strokes, shown) {
  // shown: true = 다 그린 상태, false = 하나도 안 그린 상태
  for (const s of strokes) {
    s.el.style.strokeDashoffset = shown ? '0' : '1';
    s.el.style.strokeOpacity = shown ? '1' : '0';
  }
}

// delay(ms) 뒤부터 쓴다. speed: 1 = 기본. 반환된 Animation들로 finish()/cancel().
export function writeTitle(svg, { delay = 0, speed = 1 } = {}) {
  const t = readTiming(svg);
  const plan = schedule(strokesOf(svg), t);
  setProgress(plan, false);
  return plan.map((s) => {
    const a = s.el.animate(
      [
        { strokeDashoffset: 1, strokeOpacity: 0 },
        { strokeDashoffset: 0.999, strokeOpacity: 1, offset: 0.0001 },   // 0 길이 획의 round cap 점이 미리 보이지 않게
        { strokeDashoffset: 0, strokeOpacity: 1 },
      ],
      { duration: s.dur / speed, delay: (delay + s.at) / speed, fill: 'both', easing: 'cubic-bezier(.45, .05, .55, .95)' },
    );
    return a;
  });
}
