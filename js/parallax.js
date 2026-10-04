// 깊이감 패럴랙스 + 첫 화면 스크롤 개화.
//
// 층 속도 r(scene.json layers)로 화면에서 r배로 움직여 보이게, 오브제를 (1 − r) × 스크롤만큼 따로 옮긴다.
//  - 첫 화면 오브제: 스크롤 0에서 이동 0. 첫 화면 높이만큼만 움직이고 그 뒤로는 멈춰 본문과 함께 빠진다
//    (느린 층이 계속 따라와 정보 블록에 들어오지 않게). 같은 구간에서 제목 중심 바깥으로 퍼진다(spread).
//    올라오는 정보 블록 글자와 겹칠 오브제는 겹치기 직전에 서서히 투명해진다.
//  - 섹션 오브제: 그 섹션이 화면 가운데 올 때 이동 0.
//  - 배경(고정 div): r 속도로 아주 천천히 올라간다.
// 위치는 로드·폭 변화·페이지 높이 변화(폰트 교체, FAQ 열고 닫기) 때만 잰다. 매 프레임 레이아웃을 읽지 않는다.
// transform만 쓴다. prefers-reduced-motion이거나 편집기(?edit)가 켜지면 멈추고 원래 자리로.

const FADE_SPAN = 0.18;   // 첫 화면 진행도 기준: 글자와 겹치기 이만큼 전부터 투명해진다

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function initParallax() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  const title = document.querySelector('.hero__title');
  const bg = document.querySelector('.bg[data-speed]');
  const bgSpeed = bg ? parseFloat(bg.dataset.speed) : 0;
  const scenes = [...document.querySelectorAll('.scene[data-anchor]')];
  if (!hero || !scenes.length) return;

  let groups = [];
  let heroH = 1;
  let vh = innerHeight;
  let paused = false;
  let queued = false;
  let width = innerWidth;
  let lastHeight = 0;

  const enabled = () => !reduce.matches && !paused;

  function reset() {
    for (const g of groups) for (const it of g.items) {
      it.el.style.transform = '';
      it.el.style.opacity = '';
      it.el.style.willChange = '';
    }
    if (bg) {
      bg.style.transform = '';
      bg.style.height = '';
    }
  }

  function measure() {
    reset();
    if (!enabled()) return;
    const lock = parseFloat(getComputedStyle(root).getPropertyValue('--vhl'));
    vh = lock > 2 ? lock * 100 : innerHeight;   // viewport-lock.js가 고정한 높이 기준
    heroH = hero.offsetHeight || 1;
    const sy = scrollY;
    const t = title.getBoundingClientRect();
    const tc = [t.left + t.width / 2, t.top + sy + t.height / 2];

    // 정보 블록 글자 영역 (다 퍼진 첫 화면 오브제가 겹치면 투명하게)
    const text = [...document.querySelectorAll('.info > :not(.scene)')]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width && r.height)
      .map((r) => [r.left - 8, r.top + sy - 8, r.right + 8, r.bottom + sy + 8]);
    const hits = (b) => text.some((r) => b[0] < r[2] && b[2] > r[0] && b[1] < r[3] && b[3] > r[1]);

    groups = scenes.map((scene) => {
      const anchor = scene.parentElement;
      const isHero = scene.dataset.anchor === 'hero';
      const vertical = parseFloat(scene.dataset.spreadVertical || '1');
      const a = anchor.getBoundingClientRect();
      const items = [...scene.querySelectorAll('.obj')]
        .filter((el) => el.offsetWidth)   // 이 구도에서 숨긴 오브제 제외
        .map((el) => {
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + sy + r.height / 2;
          const cs = getComputedStyle(el);
          const speed = parseFloat(el.dataset.speed || '1');
          const spread = parseFloat(el.dataset.spread || '0');
          const grow = parseFloat(el.dataset.grow || '0');
          const sx = (cx - tc[0]) * spread;
          const syv = (cy - tc[1]) * spread * vertical;
          const it = {
            el, speed, grow, sx, sy: syv,
            rot: parseFloat(cs.getPropertyValue('--r')) || 0,
            o: parseFloat(cs.opacity) || 1,
            fade: null,
          };
          if (isHero) {
            // 진행도 p에서의 상자를 훑어 처음 글자와 겹치는 p를 찾는다
            for (let i = 0; i <= 40; i++) {
              const p = i / 40;
              const s = 1 + grow * p;
              const fx = cx + sx * p;
              const fy = cy + syv * p + (1 - speed) * heroH * p;
              const hw = (r.width * s) / 2;
              const hh = (r.height * s) / 2;
              if (hits([fx - hw, fy - hh, fx + hw, fy + hh])) {
                it.fade = [Math.max(0, p - FADE_SPAN), Math.max(0.001, p)];
                break;
              }
            }
          }
          return it;
        });
      return {
        scene, items, hero: isHero, active: isHero, last: null,
        s0: isHero ? 0 : a.top + sy + a.height / 2 - vh / 2,
      };
    });

    if (bg && bgSpeed) {
      const maxScroll = Math.max(0, root.scrollHeight - innerHeight);
      bg.style.height = `${Math.ceil(Math.max(vh * 1.35, innerHeight + bgSpeed * maxScroll + 40))}px`;
    }
    lastHeight = root.scrollHeight;
    for (const g of groups) observer.observe(g.scene.parentElement);
    schedule();
  }

  function frame() {
    queued = false;
    if (!enabled()) return;
    const y = scrollY;
    if (bg && bgSpeed) bg.style.transform = `translate3d(0, ${(-bgSpeed * y).toFixed(1)}px, 0)`;
    for (const g of groups) {
      if (!g.active) continue;
      let d;
      let p = 0;
      if (g.hero) {
        d = Math.min(Math.max(y, 0), heroH);   // 첫 화면을 지나면 멈춤
        p = d / heroH;
        if (d === g.last) continue;
        g.last = d;
        const moving = d < heroH;
        for (const it of g.items) it.el.style.willChange = moving ? 'transform' : '';
      } else {
        d = Math.min(Math.max(y - g.s0, -vh), vh);
      }
      for (const it of g.items) {
        const tx = it.sx * p;
        const ty = (1 - it.speed) * d + it.sy * p;
        const s = 1 + it.grow * p;
        it.el.style.transform =
          `translate(-50%, -50%) translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) rotate(${it.rot}deg) scale(${s.toFixed(4)})`;
        if (it.fade) it.el.style.opacity = (it.o * (1 - smooth(it.fade[0], it.fade[1], p))).toFixed(3);
      }
    }
  }

  function schedule() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(frame);
    }
  }

  // 섹션 오브제는 앵커가 화면 근처일 때만 계산
  const observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const g = groups.find((x) => x.scene.parentElement === e.target);
      if (!g || g.hero) continue;
      g.active = e.isIntersecting;
      for (const it of g.items) it.el.style.willChange = g.active ? 'transform' : '';
    }
    schedule();
  }, { rootMargin: '50% 0px' });

  let remeasureQueued = false;
  const remeasure = () => {
    if (remeasureQueued) return;
    remeasureQueued = true;
    requestAnimationFrame(() => {
      remeasureQueued = false;
      observer.disconnect();
      measure();
    });
  };

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', () => {
    if (innerWidth !== width) {
      width = innerWidth;
      remeasure();
    }
  });
  // 페이지 높이 변화 (폰트 교체, FAQ 열고 닫기 등) → 섹션 기준점 다시 재기
  new ResizeObserver(() => {
    if (root.scrollHeight !== lastHeight) remeasure();
  }).observe(document.body);
  if (document.fonts) document.fonts.ready.then(remeasure);
  reduce.addEventListener?.('change', remeasure);
  addEventListener('eclore:edit', (e) => {
    paused = !!e.detail;
    remeasure();
  });

  measure();
}
