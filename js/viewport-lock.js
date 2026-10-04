// 첫 화면 높이 고정.
// 카톡·인스타 같은 앱 내 브라우저는 툴바가 접힐 때 웹뷰 자체가 커져서 svh·lvh·vh가 전부 바뀐다.
// 그러면 첫 화면이 길어지고 꽃이 위아래로 다시 배치되므로, 처음 열릴 때의 높이를 --vhl(1%)로 고정한다.
// 다시 재는 경우: 폭이 바뀔 때(회전, 창 크기) + 마우스 환경(데스크톱 창 높이 조절).
export function lockViewportHeight() {
  const root = document.documentElement;
  const finePointer = matchMedia('(pointer: fine)');
  let width = 0;

  const measure = () => {
    if (innerHeight < 200) return;   // 일부 웹뷰가 로드 직후 0을 주는 경우
    width = innerWidth;
    root.style.setProperty('--vhl', `${innerHeight / 100}px`);
  };

  measure();
  addEventListener('resize', () => {
    if (innerWidth !== width || finePointer.matches) measure();
  });
}
