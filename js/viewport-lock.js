// 첫 화면 높이 고정 (--vhl = 1%).
// 앱 내 브라우저는 툴바가 접히거나 나타날 때 웹뷰 자체가 커지고 작아져서 svh·lvh·vh가 전부 바뀐다.
//  - 커질 때(툴바 접힘)는 무시 → 스크롤하다 꽃이 다시 배치되지 않게.
//  - 작아질 때(툴바가 뒤늦게 나타남, 예: 카카오톡 인앱)는 받아들인다 → 첫 화면 아래쪽이 툴바 밑에 가려지지 않게.
//    즉 "지금까지 본 가장 작은 높이"로 고정. 구도가 다시 맞춰지는 건 툴바가 처음 나타날 때 한 번뿐.
// 폭이 바뀌면(회전, 창 크기) 새로 재고, 마우스 환경(데스크톱 창 높이 조절)은 매번 다시 잰다.
export function lockViewportHeight() {
  const root = document.documentElement;
  const finePointer = matchMedia('(pointer: fine)');
  let width = 0;
  let height = 0;

  const set = (h) => {
    height = h;
    root.style.setProperty('--vhl', `${h / 100}px`);
  };

  const measure = () => {
    if (innerHeight < 200) return;   // 일부 웹뷰가 로드 직후 0을 주는 경우
    if (innerWidth !== width || finePointer.matches) {
      width = innerWidth;
      set(innerHeight);
    } else if (innerHeight < height) {
      set(innerHeight);
    }
  };

  measure();
  addEventListener('resize', measure);
}
