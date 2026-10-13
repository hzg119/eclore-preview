// 실기기 성능 비교용 스위치 (--editor 빌드 = 미리보기 레포·dev 서버에만 들어간다).
// ?perf=far,still 처럼 쉼표로. 어느 걸 껐을 때 버벅임이 사라지는지 폰·인앱에서 직접 비교한다.
//   far     원경(sheets) 오브제 전부 빼기
//   herofar 첫 화면 원경만 빼기
//   secfar  섹션 원경만 빼기
//   sec     섹션 오브제 전부 빼기 (첫 화면만 남김)
//   still   패럴랙스 끄기 (오브제가 제자리에 고정, 스크롤 계산 없음)
//   bg      배경 텍스처 빼기
//   timeline  패럴랙스를 스크롤 타임라인 애니메이션으로 (스크롤과 같은 스레드, 지원 안 하면 기존 방식)
//   steady    패럴랙스 기존 방식 + will-change 고정 (켜고 끄지 않음)
//   nogrow    첫 화면 꽃이 퍼질 때 커지지 않게
//   nospread  첫 화면 꽃이 퍼지지도 커지지도 않게 (층 속도만)
//   half      층 속도 차이 절반 (덜 움직임)
//   ease      새 위치로 0.15초 미끄러지게 (ease80, ease250처럼 ms 지정)
//   lerp      매 프레임 목표 위치를 조금씩 따라가게
// 인트로 끄기는 기존 ?nointro.

const HERO = '.hero .scene';
const SEC = '.scene:not(.hero .scene)';
const REMOVE = {
  far: '.obj[data-layer=far]',
  herofar: `${HERO} .obj[data-layer=far]`,
  secfar: `${SEC} .obj[data-layer=far]`,
  sec: `${SEC} .obj`,
  bg: '.bg',
};

export function applyPerfTest(list) {
  const on = list.split(',').map((s) => s.trim()).filter(Boolean);
  for (const k of on) {
    if (REMOVE[k]) for (const el of document.querySelectorAll(REMOVE[k])) el.remove();
  }
  const badge = document.createElement('div');
  const tlNote = on.includes('timeline') ? ('ScrollTimeline' in window ? ' (지원)' : ' (미지원 → 기존 방식)') : '';
  badge.textContent = `perf: ${on.join(', ') || '-'}${tlNote}${/[?&]nointro\b/.test(location.search) ? ' + nointro' : ''}`;
  badge.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99;padding:2px 6px;font:11px/1.4 monospace;color:#fff;background:rgba(0,0,0,.55);border-radius:3px;pointer-events:none';
  document.body.append(badge);
  // 패럴랙스가 위치를 다시 잰 횟수 (툴바가 접히고 펴질 때 늘어나는지 실기기에서 확인)
  const label = badge.textContent;
  let n = 0;
  addEventListener('eclore:remeasure', () => { n += 1; badge.textContent = `${label} · 측정 ${n}`; });
  const has = (k) => on.includes(k);
  const e = on.find((k) => /^ease\d*$/.test(k));
  return { still: has('still'), timeline: has('timeline'), steady: has('steady'), nogrow: has('nogrow'), nospread: has('nospread'), half: has('half'), ease: e ? parseInt(e.slice(4) || '150', 10) : 0, lerp: has('lerp') };
}
