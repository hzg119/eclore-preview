// 깊이감 패럴랙스 + 첫 화면 스크롤 개화.
//
// 층 속도 r(scene.json layers)로 화면에서 r배로 움직여 보이게, 오브제를 (1 − r) × 스크롤만큼 따로 옮긴다.
//  - 첫 화면 오브제: 스크롤 0에서 이동 0. 첫 화면 높이만큼만 움직이고 그 뒤로는 멈춰 본문과 함께 빠진다
//    (느린 층이 계속 따라와 정보 블록에 들어오지 않게). 같은 구간에서 제목 중심 바깥으로 퍼진다(spread).
//    올라오는 정보 블록 글자와 겹칠 오브제는 겹치기 직전에 서서히 투명해진다.
//  - 섹션 오브제: 그 오브제가 화면 가운데 올 때 이동 0 → scene.json에 놓은 자리가 '가운데 왔을 때의 모습'.
//  - 배경(고정 div): r 속도로 아주 천천히 올라간다.
// 위치는 로드·폭 변화·페이지 높이 변화(폰트 교체, FAQ 열고 닫기) 때만 잰다. 매 프레임 레이아웃을 읽지 않는다.
// 다시 잴 때 오브제를 원래 자리로 되돌리지 않는다: transform과 무관한 값(계산된 left·top·크기)으로 재고 바로 새 위치를 넣는다.
// (되돌렸다가 다음 프레임에 놓으면 그 한 프레임 동안 꽃이 순간이동한다. 인앱 툴바가 접히고 펴질 때마다 보였다.)
// transform만 쓴다. prefers-reduced-motion이거나 편집기(?edit)가 켜지면 멈추고 원래 자리로.
//
// 실험 (미리보기 ?perf=timeline·steady, perf-test.js가 켠다. 정식 빌드는 기본 경로):
//  - timeline: 같은 움직임을 스크롤 타임라인 애니메이션으로 → 브라우저가 스크롤과 같은 스레드에서 움직인다
//    (JS가 한두 프레임 늦게 따라가며 떨리는 현상 없음). ScrollTimeline이 없으면 기본 경로.
//    위치는 스크롤 px 구간(rangeStart·rangeEnd)으로 준다 → 툴바가 접혀 스크롤 범위가 바뀌어도 어긋나지 않는다.
//  - steady: 기본 경로 그대로, will-change를 켜고 끄지 않는다 (레이어를 다시 만들며 다시 그리는 비용 확인용).
//  - nogrow: 첫 화면 오브제가 퍼질 때 커지지 않게 (크기가 바뀌면 사파리가 이미지를 다시 그리는지 확인용).
//  - nospread: 퍼짐·커짐 없이 층 속도만. half: 층 속도 차이를 절반으로.
//  - ease(ms): 새 위치로 CSS transition을 걸어 미끄러지게 (스크롤 값이 늦게 와서 한 번에 따라잡을 때 순간이동 대신).
//  - lerp: 매 프레임 목표 위치를 일정 비율로 따라간다 (같은 목적, JS로).

const FADE_SPAN = 0.18;
const LERP = 0.35;      // lerp 실험: 프레임마다 남은 거리의 이 비율만큼
const INNER = 0.76;      // 겹침 판정에 쓰는 오브제 상자 비율   // 첫 화면 진행도 기준: 글자와 겹치기 이만큼 전부터 투명해진다

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function initParallax({ timeline = false, steady = false, nogrow = false, nospread = false, half = false, ease = 0, lerp = false } = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  const title = document.querySelector('.hero__title');
  const bg = document.querySelector('.bg[data-speed]');
  const bgSpeed = bg ? parseFloat(bg.dataset.speed) : 0;
  const scenes = [...document.querySelectorAll('.scene[data-anchor]')];
  if (!hero || !scenes.length) return;
  const useTimeline = timeline && 'ScrollTimeline' in window;
  let anims = [];
  let retiring = [];   // 다시 잰 뒤 새 애니메이션이 준비되면 지울 옛 애니메이션

  let groups = [];
  let heroH = 1;
  let vh = innerHeight;
  let paused = false;
  let queued = false;
  let width = innerWidth;
  let lastHeight = 0;

  const enabled = () => !reduce.matches && !paused;

  function reset() {
    for (const a of [...anims, ...retiring]) a.cancel();
    anims = [];
    retiring = [];
    for (const g of groups) for (const it of g.items) {
      it.el.style.transform = '';
      it.el.style.opacity = '';
      it.el.style.willChange = '';
      it.el.style.transition = '';
    }
    if (bg) {
      bg.style.transform = '';
      bg.style.height = '';
    }
  }

  function measure() {
    if (!enabled()) return reset();
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

    const prev = new Map(groups.map((g) => [g.scene, g]));
    groups = scenes.map((scene) => {
      const isHero = scene.dataset.anchor === 'hero';
      const sr = scene.getBoundingClientRect();   // scene 자체는 움직이지 않는다
      const vertical = parseFloat(scene.dataset.spreadVertical || '1');
      const items = [...scene.querySelectorAll('.obj')]
        .filter((el) => el.offsetWidth)   // 이 구도에서 숨긴 오브제 제외
        .map((el) => {
          // 중심 = left·top (translate(-50%, -50%)로 가운데 맞춤). 지금 걸린 transform·애니메이션과 무관하다.
          const cs = getComputedStyle(el);
          const cx = sr.left + parseFloat(cs.left);
          const cy = sr.top + sy + parseFloat(cs.top);
          const rot = parseFloat(cs.getPropertyValue('--r')) || 0;
          const w = parseFloat(cs.width);
          const h = parseFloat(cs.height);
          const ra = (rot * Math.PI) / 180;
          const bw = w * Math.abs(Math.cos(ra)) + h * Math.abs(Math.sin(ra));   // 돌린 상자
          const bh = w * Math.abs(Math.sin(ra)) + h * Math.abs(Math.cos(ra));
          const o = parseFloat(cs.getPropertyValue('--o'));
          const r0 = parseFloat(el.dataset.speed || '1');
          const speed = half ? 1 - (1 - r0) / 2 : r0;
          const spread = nospread ? 0 : parseFloat(el.dataset.spread || '0');
          const grow = nogrow || nospread ? 0 : parseFloat(el.dataset.grow || '0');
          const sx = (cx - tc[0]) * spread;
          const syv = (cy - tc[1]) * spread * vertical;
          const it = {
            el, speed, grow, sx, sy: syv,
            s0: cy - vh / 2,   // 섹션 오브제 기준점: 자기 중심이 화면 가운데 올 때
            rot,
            o: Number.isFinite(o) ? o : 1,
            fade: null,
          };
          if (isHero) {
            // 진행도 p에서의 상자를 훑어 처음 글자와 겹치는 p를 찾는다
            for (let i = 0; i <= 40; i++) {
              const p = i / 40;
              const s = 1 + grow * p;
              const fx = cx + sx * p;
              const fy = cy + syv * p + (1 - speed) * heroH * p;
              // 둥근 방울·꽃잎의 투명한 모서리는 빼고 (상자 안쪽 76%)
              const hw = (bw * s * INNER) / 2;
              const hh = (bh * s * INNER) / 2;
              if (hits([fx - hw, fy - hh, fx + hw, fy + hh])) {
                it.fade = [Math.max(0, p - FADE_SPAN), Math.max(0.001, p)];
                break;
              }
            }
          }
          return it;
        });
      return { scene, items, hero: isHero, active: isHero || !!prev.get(scene)?.active, last: null };
    });

    if (bg && bgSpeed) {
      const maxScroll = Math.max(0, root.scrollHeight - innerHeight);
      bg.style.height = `${Math.ceil(Math.max(vh * 1.35, innerHeight + bgSpeed * maxScroll + 40))}px`;
    }
    lastHeight = root.scrollHeight;
    dispatchEvent(new CustomEvent('eclore:remeasure'));   // 미리보기 perf 표시용
    if (useTimeline) return attachTimeline();
    if (steady) for (const g of groups) for (const it of g.items) it.el.style.willChange = 'transform';
    if (ease) for (const g of groups) for (const it of g.items) it.el.style.transition = `transform ${ease}ms linear`;
    for (const g of groups) observer.observe(g.scene.parentElement);
    frame();   // 다음 프레임을 기다리지 않고 바로 (그 사이 옛 위치가 한 프레임 보이지 않게)
  }

  const transformAt = (it, d, p) =>
    `translate(-50%, -50%) translate3d(${(it.sx * p).toFixed(1)}px, ${((1 - it.speed) * d + it.sy * p).toFixed(1)}px, 0) rotate(${it.rot}deg) scale(${(1 + it.grow * p).toFixed(4)})`;

  // frame()과 같은 움직임을 스크롤 px 구간 [a, b]의 선형 애니메이션으로 (구간 밖은 끝값 유지)
  function attachTimeline() {
    // 옛 애니메이션은 새 것이 준비된 뒤에 지운다 (새 것은 첫 프레임에 아직 적용 전일 수 있다)
    const old = anims;
    retiring.push(...old);
    anims = [];
    const tl = new ScrollTimeline({ source: root, axis: 'block' });
    const add = (el, kf, a, b) =>
      anims.push(el.animate(kf, { timeline: tl, rangeStart: `${a}px`, rangeEnd: `${b}px`, fill: 'both', easing: 'linear' }));
    if (bg && bgSpeed) {
      const end = root.scrollHeight + 2000;   // 선형이라 넉넉한 구간이면 된다
      add(bg, [{ transform: 'translate3d(0, 0, 0)' }, { transform: `translate3d(0, ${(-bgSpeed * end).toFixed(1)}px, 0)` }], 0, end);
    }
    for (const g of groups) {
      for (const it of g.items) {
        if (g.hero) {
          add(it.el, [{ transform: transformAt(it, 0, 0) }, { transform: transformAt(it, heroH, 1) }], 0, heroH);
          if (it.fade) {
            const [f0, f1] = it.fade;
            add(it.el, [
              { opacity: it.o, offset: 0 },
              { opacity: it.o, offset: f0, easing: 'ease-in-out' },   // smooth()와 거의 같은 곡선
              { opacity: 0, offset: f1 },
              { opacity: 0, offset: 1 },
            ], 0, heroH);
          }
        } else {
          // d = clamp(y − s0, −vh, vh) → y ∈ [s0 − vh, s0 + vh]에서 선형
          const a = Math.max(0, it.s0 - vh);
          const b = Math.max(a + 1, it.s0 + vh);
          const dAt = (y) => Math.min(Math.max(y - it.s0, -vh), vh);
          add(it.el, [{ transform: transformAt(it, dAt(a), 0) }, { transform: transformAt(it, dAt(b), 0) }], a, b);
        }
      }
    }
    Promise.all(anims.map((a) => a.ready)).then(() => {
      for (const a of old) a.cancel();
      retiring = retiring.filter((a) => !old.includes(a));
    });
  }

  function frame() {
    queued = false;
    if (!enabled() || useTimeline) return;
    const y = scrollY;
    let lerpMore = false;
    if (bg && bgSpeed) bg.style.transform = `translate3d(0, ${(-bgSpeed * y).toFixed(1)}px, 0)`;
    for (const g of groups) {
      let p = 0;
      let dh = 0;
      let still = false;   // 첫 화면 오브제: 진행도가 그대로면 건너뛴다 (lerp는 따라잡는 중일 수 있어 계속)
      if (g.hero) {
        dh = Math.min(Math.max(y, 0), heroH);   // 첫 화면을 지나면 멈춤
        p = dh / heroH;
        still = dh === g.last && !lerp;
        g.last = dh;
        if (!still && !steady) for (const it of g.items) it.el.style.willChange = dh < heroH ? 'transform' : '';
      }
      for (const it of g.items) {
        if (!g.active || still) continue;
        const d = g.hero ? dh : Math.min(Math.max(y - it.s0, -vh), vh);
        let tx = it.sx * p;
        let ty = (1 - it.speed) * d + it.sy * p;
        let s = 1 + it.grow * p;
        if (lerp) {
          const c = it.cur || (it.cur = [tx, ty, s]);
          c[0] += (tx - c[0]) * LERP; c[1] += (ty - c[1]) * LERP; c[2] += (s - c[2]) * LERP;
          if (Math.abs(ty - c[1]) > 0.3 || Math.abs(tx - c[0]) > 0.3) lerpMore = true;
          [tx, ty, s] = c;
        }
        it.el.style.transform =
          `translate(-50%, -50%) translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) rotate(${it.rot}deg) scale(${s.toFixed(4)})`;
        if (it.fade && !still) it.el.style.opacity = (it.o * (1 - smooth(it.fade[0], it.fade[1], p))).toFixed(3);
      }
    }
    if (lerpMore) schedule();
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
      if (!steady) for (const it of g.items) it.el.style.willChange = g.active ? 'transform' : '';
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
  // 1~2px은 무시: 인앱 툴바가 접히고 펴질 때 반올림으로 높이가 1px씩 흔들린다
  new ResizeObserver(() => {
    if (Math.abs(root.scrollHeight - lastHeight) > 2) remeasure();
  }).observe(document.body);
  if (document.fonts) document.fonts.ready.then(remeasure);
  reduce.addEventListener?.('change', remeasure);
  // bfcache 복원: 저장된 transform을 버리고 다시 잰다 (인트로 다시 재생과 함께)
  addEventListener('pageshow', (e) => {
    if (e.persisted) remeasure();
  });
  addEventListener('eclore:edit', (e) => {
    paused = !!e.detail;
    remeasure();
  });

  measure();
}
