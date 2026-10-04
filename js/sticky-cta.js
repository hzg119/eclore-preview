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

  let passed = false;
  let atClosing = false;
  const update = () => {
    bar.dataset.state = passed && !atClosing ? 'shown' : 'hidden';
  };

  // root 아래쪽을 늘림 → 앵커가 화면 위로 완전히 벗어났을 때만 교차 해제
  new IntersectionObserver(([e]) => {
    passed = !e.isIntersecting;
    update();
  }, { rootMargin: `0px 0px ${FAR} 0px` }).observe(anchor);

  // root 위쪽을 늘림 → 마무리 섹션이 화면 아래 끝에 닿은 뒤로는 계속 교차
  if (closing) {
    new IntersectionObserver(([e]) => {
      atClosing = e.isIntersecting;
      update();
    }, { rootMargin: `${FAR} 0px 0px 0px` }).observe(closing);
  }
}
