// 진입점. Phase별 모듈을 여기서 붙인다 (track.js P4, parallax.js P2, intro.js P3).
import { lockViewportHeight } from './viewport-lock.js';
import { initParallax } from './parallax.js';
import { initIntro } from './intro.js';
import { initStickyCta } from './sticky-cta.js';

const editor = document.documentElement.hasAttribute('data-editor');
const params = new URLSearchParams(location.search);

function start(opts = {}) {
  lockViewportHeight();   // 먼저: 패럴랙스가 고정 높이를 기준으로 잰다
  if (!opts.still) initParallax();
  initIntro();            // head 인라인 스크립트가 "인트로 대기"를 붙인 경우만 동작
  initStickyCta();
}

// 실기기 성능 비교 스위치 (?perf=…): --editor 빌드(미리보기·dev 서버)에만 파일이 있다
if (editor && params.has('perf')) {
  import('./perf-test.js').then((m) => start(m.applyPerfTest(params.get('perf'))), () => start());
} else {
  start();
}

// 배치 편집기: --editor 빌드(dev 서버·미리보기)에만 파일이 있다
if (editor && params.has('edit')) {
  import('./editor.js').then((m) => m.initEditor());
}
