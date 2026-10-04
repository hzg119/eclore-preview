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

// 각 획의 시작 시각·길이(ms).
// write_ms = 획을 긋는 시간의 합 (길이에 비례해 나눔). 한 글자 안의 획은 차례로(사이 stroke_pause_ms),
// 다음 글자는 앞 글자가 (1 − letter_overlap)만큼 써졌을 때 미리 시작한다 (+ letter_pause_ms).
export function schedule(strokes, t) {
  const overlap = t.letter_overlap || 0;
  const totalLen = strokes.reduce((a, s) => a + s.len, 0) || 1;
  const letters = [];
  for (const s of strokes) {
    const last = letters[letters.length - 1];
    if (last && last.glyph === s.glyph) last.items.push(s);
    else letters.push({ glyph: s.glyph, items: [s] });
  }
  const intra = letters.reduce((n, l) => n + (l.items.length - 1) * t.stroke_pause_ms, 0);
  const drawMs = Math.max(200, t.write_ms - intra);
  const out = [];
  let start = 0;
  for (const l of letters) {
    let at = start;
    for (const [j, s] of l.items.entries()) {
      if (j) at += t.stroke_pause_ms;
      const dur = (drawMs * s.len) / totalLen;
      out.push({ ...s, at, dur });
      at += dur;
    }
    const letterDur = at - start;
    start = start + letterDur * (1 - overlap) + t.letter_pause_ms;
  }
  return out;
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
