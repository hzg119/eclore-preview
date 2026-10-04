// 진입점. Phase별 모듈을 여기서 붙인다 (track.js P4, parallax.js P2, intro.js P3).
import { lockViewportHeight } from './viewport-lock.js';
import { initParallax } from './parallax.js';
import { initIntro } from './intro.js';
import { initStickyCta } from './sticky-cta.js';

lockViewportHeight();   // 먼저: 패럴랙스가 고정 높이를 기준으로 잰다
initParallax();
initIntro();            // head 인라인 스크립트가 "인트로 대기"를 붙인 경우만 동작
initStickyCta();

// 배치 편집기: --editor 빌드(dev 서버·미리보기)에만 파일이 있다
if (document.documentElement.hasAttribute('data-editor') && new URLSearchParams(location.search).has('edit')) {
  import('./editor.js').then((m) => m.initEditor());
}
