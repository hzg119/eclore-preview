// 우상단 고정 예매 버튼: 정보 블록의 예매 버튼(#cta-hero)이 화면 위로 지나가면 보이고,
// 마무리 섹션(#closing)에 닿거나 지나가면 숨는다. JS가 없으면 CSS 기본값(숨김) 그대로.
//
// 보통의 IntersectionObserver는 "보임/안 보임"이 바뀔 때만 알려서, 화면 아래에서 위로 한 번에
// 건너뛰면(앵커 링크, 빠른 플링) 놓친다. root를 한쪽으로 크게 늘려 "위로 지나갔나"를 직접 관찰한다.
const FAR = '100000px';

export function initStickyCta() {
  const bar = document.querySelector('.sticky-cta');
  const anchor = document.getElementById('cta-hero');
  const closing = document.getElementById('closing');
  if (!bar || !anchor || !('IntersectionObserver' in window)) return;

  // root를 이 문서로: 페이지가 iframe 안에 있을 때(미리보기 frames) 바깥 화면이 아니라 iframe 화면으로 잰다.
  // document를 root로 못 받는 옛 브라우저는 기본(최상위 화면)으로.
  const observe = (cb, rootMargin, target) => {
    let io;
    try { io = new IntersectionObserver(cb, { root: document, rootMargin }); }
    catch (e) { io = new IntersectionObserver(cb, { rootMargin }); }
    io.observe(target);
  };

  let passed = false;
  let atClosing = false;
  const update = () => {
    bar.dataset.state = passed && !atClosing ? 'shown' : 'hidden';
  };

  // root 아래쪽을 늘림 → 앵커가 화면 위로 완전히 벗어났을 때만 교차 해제
  observe(([e]) => {
    passed = !e.isIntersecting;
    update();
  }, `0px 0px ${FAR} 0px`, anchor);

  // root 위쪽을 늘림 → 마무리 섹션이 화면 아래 끝에 닿은 뒤로는 계속 교차
  if (closing) {
    observe(([e]) => {
      atClosing = e.isIntersecting;
      update();
    }, `${FAR} 0px 0px 0px`, closing);
  }
}
