// 진입점. Phase별 모듈을 여기서 붙인다 (track.js P4, parallax.js P2, intro.js P3).
import { lockViewportHeight } from './viewport-lock.js';
import { initStickyCta } from './sticky-cta.js';

lockViewportHeight();
initStickyCta();
