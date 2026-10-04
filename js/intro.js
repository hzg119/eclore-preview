// 첫 화면 인트로: 배경 → 꽃이 제목 둘레에서 피어나며 등장 + Éclore 쓰기 → 스크롤 화살표 (3초 이하).
//
// 재생 조건 (CLAUDE.md Phase 3):
//  - head 인라인 스크립트가 reduced-motion·hash면 "인트로 대기"(intro-wait)를 붙이지 않는다 → 여기선 아무것도 안 함.
//  - 시작하는 즉시 intro-wait → intro-run (4초 CSS 안전장치 해제).
//  - 새로고침·뒤로가기는 스크롤 복원을 기다렸다가, 제목이 화면에 보이면 재생, 아니면 즉시 완료.
//    인트로를 위해 맨 위로 강제 스크롤하지 않는다.
//  - bfcache 복원(pageshow persisted)에서 제목이 보이면 시작 상태로 되돌리고 다시 재생.
//  - 재생 중 스크롤·탭·키 입력 → 즉시 완료. 페이지 안에서 다시 첫 화면으로 올라오는 건 재생하지 않는다.
// 꽃: 안쪽 <img>의 scale·opacity만 (바깥 <picture>는 패럴랙스 몫). 제목: 원래 <img>는 opacity 0, 겹친 SVG가 그린다.

import { writeTitle, readTiming, setProgress, strokesOf } from './title-write.js';

const IMG_WAIT_MS = 1200;
const SKIP_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'scroll'];

export function initIntro() {
  const root = document.documentElement;
  if (!root.classList.contains('intro-wait')) return;
  root.classList.replace('intro-wait', 'intro-run');   // JS가 돈다 → CSS 안전장치 해제

  const hero = document.querySelector('.hero');
  const title = hero?.querySelector('.hero__title');
  const img = title?.querySelector('img');
  const svg = title?.querySelector('.title-write');
  if (!hero || !img || !svg) {
    root.classList.remove('intro-run');
    return;
  }

  let anims = [];
  let playing = false;

  const titleVisible = () => {
    const r = title.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  };

  function cleanup() {
    for (const a of anims) a.cancel();
    anims = [];
    playing = false;
    for (const e of SKIP_EVENTS) removeEventListener(e, skip, true);
    for (const el of hero.querySelectorAll('.obj img')) el.style.willChange = '';
    svg.style.opacity = '';
  }

  function done() {
    cleanup();
    root.classList.remove('intro-run');
  }

  function skip() {
    if (playing) done();
  }

  async function play() {
    cleanup();
    root.classList.add('intro-run');
    playing = true;
    const t = readTiming(svg);
    for (const e of SKIP_EVENTS) addEventListener(e, skip, { capture: true, passive: true });

    // 제목 이미지 decode를 최대 1.2초 기다린다 (그동안 배경만 보인다). 기다리는 사이 건너뛰었으면 끝.
    await Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, IMG_WAIT_MS))]);
    if (!playing) return;
    if (!titleVisible()) return done();
    const image = svg.querySelector('image');
    image.setAttribute('href', img.currentSrc || img.src);

    // 꽃: 제목에서 가까운 것부터 (data-bloom으로 덮어쓰기, none = 처음부터 보임)
    const tr = title.getBoundingClientRect();
    const tc = [tr.left + tr.width / 2, tr.top + tr.height / 2];
    const objs = [...hero.querySelectorAll('.obj')].filter((o) => o.offsetWidth);
    const ranked = objs.map((o) => {
      const r = o.getBoundingClientRect();
      const b = o.dataset.bloom;
      return { o, key: b && b !== 'none' ? -1e6 + parseFloat(b) : Math.hypot(r.left + r.width / 2 - tc[0], r.top + r.height / 2 - tc[1]), none: b === 'none' };
    }).sort((a, b) => a.key - b.key);
    const live = ranked.filter((x) => !x.none);
    const span = Math.max(0, t.bloom_to_ms - t.bloom_each_ms - t.bloom_from_ms);
    live.forEach((x, i) => {
      const el = x.o.querySelector('img');
      el.style.willChange = 'transform, opacity';
      anims.push(el.animate(
        [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: t.bloom_each_ms, delay: t.bloom_from_ms + (live.length > 1 ? (span * i) / (live.length - 1) : 0), fill: 'both', easing: 'cubic-bezier(.2, .7, .3, 1)' },
      ));
    });
    for (const x of ranked.filter((y) => y.none)) {
      anims.push(x.o.querySelector('img').animate([{ opacity: 1 }, { opacity: 1 }], { duration: 1, fill: 'both' }));
    }

    // 제목 쓰기 → 원래 <img>로 짧게 크로스페이드
    const strokes = writeTitle(svg, { delay: t.start_ms });
    anims.push(...strokes);
    const writeEnd = Math.max(...strokes.map((a) => a.effect.getComputedTiming().endTime));
    anims.push(img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: t.crossfade_ms, delay: writeEnd, fill: 'both' }));
    anims.push(svg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: t.crossfade_ms, delay: writeEnd, fill: 'both' }));

    // 스크롤 화살표
    const hint = hero.querySelector('.hero__scroll');
    if (hint) anims.push(hint.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: Math.min(t.hint_ms, writeEnd), fill: 'both' }));

    await Promise.all(anims.map((a) => a.finished.catch(() => {})));
    if (playing) done();
  }

  // 시작 시점 판단
  const nav = performance.getEntriesByType?.('navigation')[0]?.type;
  if (nav === 'reload' || nav === 'back_forward') {
    // 스크롤 복원은 첫 페인트 뒤(load 무렵)에 일어날 수 있다 → load + 두 프레임 기다린 뒤 위치를 본다
    const decide = () => requestAnimationFrame(() => requestAnimationFrame(() => (titleVisible() ? play() : done())));
    if (document.readyState === 'complete') decide();
    else addEventListener('load', decide, { once: true });
  } else {
    titleVisible() ? play() : done();
  }

  // bfcache 복원: 제목이 보이면 시작 상태로 되돌리고 다시 재생
  addEventListener('pageshow', (e) => {
    if (!e.persisted || matchMedia('(prefers-reduced-motion: reduce)').matches || location.hash) return;
    if (titleVisible()) {
      setProgress(strokesOf(svg), false);
      play();
    }
  });
}
