// ?edit 배치 편집기. --editor 빌드(dev 서버·미리보기)에만 들어가고 정식 배포에는 없다.
//
// 오브제를 클릭해 고르고 끌어서 옮긴다. 지금 보이는 구도(모바일/데스크톱)의 값만 바뀐다.
//   방향키 0.2 (Shift 1) 이동 · +/- 크기 2% (Shift 10%) · 오브제 위에서 휠 크기
//   Q/E 회전 1° (Shift 5°) · [ ] 쌓임 순서 · H 이 구도에서 숨김 · Esc 선택 해제
// [저장]: dev 서버(--serve)면 src/data/scene.json에 바로 쓴다 → 다시 빌드 → 새로고침.
// [복사]: 바뀐 오브제를 scene.json 형식(한 줄에 하나)으로 클립보드에. 정적 미리보기에서는 이걸로 보낸다.
// 편집 중에는 패럴랙스가 멈추고 저장된 원래 자리로 보인다.

const CSS = `
.editing .scene { pointer-events: none; }
.editing .obj { pointer-events: auto; cursor: grab; touch-action: none; }
.editing .obj:hover { outline: 1px dashed rgba(183, 44, 80, .45); }
.editing .obj.is-sel { outline: 2px solid #b72c50; cursor: grabbing; }
.editing .obj img { -webkit-user-drag: none; user-select: none; }
.editing .hero__title, .editing .info > :not(.scene) { outline: 1px dashed rgba(80, 120, 200, .5); }
.ed-panel { position: fixed; left: 8px; bottom: 8px; z-index: 1000; width: min(320px, calc(100vw - 16px));
  padding: 10px 12px; border-radius: 8px; background: rgba(30, 22, 25, .92); color: #f4ecee;
  font: 12px/1.5 system-ui, -apple-system, sans-serif; word-break: normal; }
.ed-panel b { color: #ffb3c4; font-weight: 600; }
.ed-panel .ed-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.ed-panel button { padding: 4px 9px; border: 0; border-radius: 4px; background: #f4ecee; color: #2a1d21;
  font: inherit; cursor: pointer; }
.ed-panel button.ed-primary { background: #b72c50; color: #fff; }
.ed-panel .ed-help { margin-top: 6px; color: #b9aab0; font-size: 11px; }
.ed-panel .ed-status { margin-top: 6px; color: #9fe0a8; min-height: 1.5em; }
.ed-panel details summary { cursor: pointer; color: #b9aab0; margin-top: 6px; }
.ed-panel.is-min > :not(.ed-head) { display: none; }
`;

const r1 = (n) => Math.round(n * 10) / 10;

export function initEditor() {
  dispatchEvent(new CustomEvent('eclore:edit', { detail: true }));   // 패럴랙스 멈춤
  const root = document.documentElement;
  root.classList.add('editing');
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);

  const data = JSON.parse(document.getElementById('scene-data').textContent);
  const byId = new Map(data.objects.map((o) => [o.id, o]));
  const els = new Map([...document.querySelectorAll('.obj[data-id]')].map((el) => [el.dataset.id, el]));
  const changed = new Set();
  const desktop = matchMedia(data.viewports.desktop.media);
  const layout = () => (desktop.matches ? 'desktop' : 'mobile');
  const pre = () => (desktop.matches ? 'd' : 'm');
  const vhl = () => {
    const v = parseFloat(getComputedStyle(root).getPropertyValue('--vhl'));
    return v > 2 ? v : innerHeight / 100;
  };
  const unitW = () => (desktop.matches ? Math.min(innerWidth / 100, 1.6 * vhl()) : innerWidth / 100);
  let sel = null;
  let devServer = false;
  fetch('/__version', { cache: 'no-store' })
    .then(async (r) => { await r.text(); devServer = r.ok; render(); })   // 본문까지 읽어야 요청이 닫힌다
    .catch(() => {});

  // ── 값 적용 ──
  function apply(id) {
    const o = byId.get(id);
    const el = els.get(id);
    const v = o[layout()];
    el.style.setProperty('--z', o.z ?? 0);
    if (!v) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    const pf = parseFloat(el.dataset.pf || '1');
    el.style.setProperty(`--${pre()}x`, v.x);
    el.style.setProperty(`--${pre()}y`, v.y);
    el.style.setProperty(`--${pre()}w`, v.w * pf);
    el.style.setProperty(`--${pre()}r`, v.rot || 0);
    // 이 구도에서 숨겨져 있던 오브제는 빈 이미지 → 실제 이미지로 바꿔 끼운다
    const img = el.querySelector('img');
    const src = el.querySelector('source');
    if (img.src.startsWith('data:') && src && !src.srcset.startsWith('data:')) {
      img.srcset = src.srcset;
      img.sizes = src.sizes;
    }
    if (src && src.srcset.startsWith('data:')) src.remove();
  }

  function change(id, fn) {
    const o = byId.get(id);
    fn(o, o[layout()]);
    changed.add(id);
    apply(id);
    render();
  }

  function select(id) {
    if (sel) els.get(sel)?.classList.remove('is-sel');
    sel = id;
    if (sel) els.get(sel).classList.add('is-sel');
    render();
  }

  // ── 끌기 ──
  let drag = null;
  for (const [id, el] of els) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      select(id);
      const v = byId.get(id)[layout()];
      if (!v) return;
      el.setPointerCapture(e.pointerId);
      drag = { id, x0: e.clientX, y0: e.clientY, vx: v.x, vy: v.y };
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== id) return;
      change(id, (o, v) => {
        v.x = r1(drag.vx + (e.clientX - drag.x0) / (innerWidth / 100));
        v.y = r1(drag.vy + (e.clientY - drag.y0) / vhl());
      });
    });
    el.addEventListener('pointerup', () => { drag = null; });
    el.addEventListener('wheel', (e) => {
      if (sel !== id) return;
      e.preventDefault();
      const k = e.deltaY < 0 ? 1.03 : 1 / 1.03;
      change(id, (o, v) => { v.w = r1(Math.max(1, v.w * k)); });
    }, { passive: false });
  }
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.obj, .ed-panel')) select(null);
  });

  // ── 키 ──
  addEventListener('keydown', (e) => {
    if (!sel || e.target.closest?.('input, textarea')) return;
    const big = e.shiftKey;
    const step = big ? 1 : 0.2;
    const k = e.key;
    const map = {
      ArrowLeft: (o, v) => { v.x = r1(v.x - step); },
      ArrowRight: (o, v) => { v.x = r1(v.x + step); },
      ArrowUp: (o, v) => { v.y = r1(v.y - step); },
      ArrowDown: (o, v) => { v.y = r1(v.y + step); },
      '+': (o, v) => { v.w = r1(v.w * (big ? 1.1 : 1.02)); },
      '=': (o, v) => { v.w = r1(v.w * (big ? 1.1 : 1.02)); },
      '-': (o, v) => { v.w = r1(Math.max(1, v.w / (big ? 1.1 : 1.02))); },
      _: (o, v) => { v.w = r1(Math.max(1, v.w / 1.1)); },
      q: (o, v) => { v.rot = Math.round((v.rot || 0) - (big ? 5 : 1)); },
      e: (o, v) => { v.rot = Math.round((v.rot || 0) + (big ? 5 : 1)); },
      '[': (o) => { o.z = (o.z || 0) - 1; },
      ']': (o) => { o.z = (o.z || 0) + 1; },
    };
    const lower = k.length === 1 ? k.toLowerCase() : k;
    if (k === 'Escape') return select(null);
    if (lower === 'h') {
      e.preventDefault();
      const id = sel;
      select(null);
      return change(id, (o) => { o[layout()] = null; });
    }
    const fn = map[lower];
    if (!fn || !byId.get(sel)[layout()]) return;
    e.preventDefault();
    change(sel, fn);
  });

  // ── 패널 ──
  const panel = document.createElement('div');
  panel.className = 'ed-panel';
  document.body.append(panel);
  let status = '';

  function lines() {
    // scene.json과 같은 모양 (Python json.dumps 기본 간격: {"id": "…", "x": 1})
    const line = (o) => JSON.stringify(o, null, 1).replace(/\n\s*/g, ' ')
      .replace(/\{ /g, '{').replace(/ \}/g, '}').replace(/\[ /g, '[').replace(/ \]/g, ']');
    return [...changed].map((id) => `    ${line(byId.get(id))}`).join(',\n');
  }

  async function save() {
    try {
      const res = await fetch('/__scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objects: [...changed].map((id) => byId.get(id)) }),
      });
      if (!res.ok) throw new Error(await res.text());
      changed.clear();
      status = '저장됨 · 다시 빌드 중…';
      render();
      // 프레임 페이지 밖이면 빌드가 끝난 뒤 직접 새로고침
      if (window.top === window) {
        const v0 = await (await fetch('/__version', { cache: 'no-store' })).text();
        const t = setInterval(async () => {
          const v = await (await fetch('/__version', { cache: 'no-store' })).text();
          if (v !== v0) { clearInterval(t); location.reload(); }
        }, 500);
      }
    } catch (err) {
      status = `저장 실패: ${err.message}`;
      render();
    }
  }

  async function copy() {
    const text = lines();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    status = `${changed.size}개 복사됨 · scene.json의 같은 id 줄과 바꾸면 됩니다`;
    render();
  }

  function render() {
    const lay = layout();
    const o = sel && byId.get(sel);
    const v = o && o[lay];
    const hidden = data.objects.filter((x) => !x[lay]);
    panel.innerHTML = `
      <div class="ed-head"><b>배치 편집</b> · ${lay === 'desktop' ? '데스크톱' : '모바일'} 구도
        ${changed.size ? ` · 바뀜 ${changed.size}` : ''} <button data-a="min" style="float:right">–</button></div>
      <div>${o ? `${o.id} <span style="color:#b9aab0">(${o.layer}, ${o.anchor || 'hero'})</span><br>
        ${v ? `x ${v.x} · y ${v.y} · w ${v.w} · rot ${v.rot || 0} · z ${o.z ?? 0}` : '이 구도에서 숨김'}`
        : '오브제를 클릭하세요'}</div>
      <div class="ed-help">끌기 이동 · 방향키 미세 이동 · +/− 또는 휠 크기 · Q/E 회전 · [ ] 순서 · H 숨김 · Shift 크게</div>
      ${hidden.length ? `<details><summary>이 구도에서 숨긴 오브제 ${hidden.length}</summary>
        ${hidden.map((x) => `<div>${x.id} <button data-show="${x.id}">보이기</button></div>`).join('')}</details>` : ''}
      <div class="ed-row">
        ${devServer ? '<button class="ed-primary" data-a="save">저장</button>' : ''}
        <button ${devServer ? '' : 'class="ed-primary"'} data-a="copy">복사</button>
        <button data-a="reset">되돌리기</button>
        <button data-a="exit">끝내기</button>
      </div>
      <div class="ed-status">${status}</div>`;
  }

  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const show = b.dataset.show;
    if (show) {
      const o = byId.get(show);
      const other = o[layout() === 'desktop' ? 'mobile' : 'desktop'];
      o[layout()] = other ? { ...other } : { x: 50, y: 50, w: 20, rot: 0 };
      changed.add(show);
      apply(show);
      return select(show);
    }
    const a = b.dataset.a;
    if (a === 'save') {
      if (!changed.size) { status = '바뀐 것이 없습니다'; return render(); }
      save();
    } else if (a === 'copy') {
      if (!changed.size) { status = '바뀐 것이 없습니다'; return render(); }
      copy();
    } else if (a === 'reset') {
      location.reload();
    } else if (a === 'exit') {
      const u = new URL(location.href);
      u.searchParams.delete('edit');
      location.href = u.href;
    } else if (a === 'min') {
      panel.classList.toggle('is-min');
    }
  });

  desktop.addEventListener?.('change', () => { select(null); render(); });
  render();
}
