// 실기기 성능 비교용 스위치 (--editor 빌드 = 미리보기 레포·dev 서버에만 들어간다).
// ?perf=far,still 처럼 쉼표로. 어느 걸 껐을 때 버벅임이 사라지는지 폰·인앱에서 직접 비교한다.
//   far     원경(sheets) 오브제 전부 빼기
//   herofar 첫 화면 원경만 빼기
//   secfar  섹션 원경만 빼기
//   sec     섹션 오브제 전부 빼기 (첫 화면만 남김)
//   still   패럴랙스 끄기 (오브제가 제자리에 고정, 스크롤 계산 없음)
//   bg      배경 텍스처 빼기
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
  badge.textContent = `perf: ${on.join(', ') || '-'}${/[?&]nointro\b/.test(location.search) ? ' + nointro' : ''}`;
  badge.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99;padding:2px 6px;font:11px/1.4 monospace;color:#fff;background:rgba(0,0,0,.55);border-radius:3px;pointer-events:none';
  document.body.append(badge);
  return { still: on.includes('still') };
}
