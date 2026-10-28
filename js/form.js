// 티켓 이벤트 응모 폼 → Apps Script 웹앱 (tools/apps-script/event-form.gs).
// 폼 데이터를 urlencoded로 POST (단순 요청이라 사전 확인 요청 없음). 웹앱은 {ok, error}를 JSON으로 돌려준다.
// 문구는 HTML <template id="event-msgs">에서만 가져온다 (content.yaml → 빌드, 폰트 서브셋 포함).
// 개인정보는 본문으로만 보낸다 (URL·이벤트 이름에 넣지 않는다).
export function initEventForm() {
  const box = document.getElementById('event-form');
  const form = box?.querySelector('form');
  const endpoint = form?.dataset.endpoint;
  if (!form) return;
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type=submit]');
  const msg = (k) => document.getElementById('event-msgs')?.content.querySelector(`[data-k="${k}"]`)?.textContent || '';
  let busy = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy || !endpoint || !form.reportValidity()) return;
    busy = true;
    button.disabled = true;
    status.textContent = msg('sending');
    try {
      const body = new URLSearchParams(new FormData(form));
      body.set('phone', body.get('phone').replace(/\D/g, ''));
      const res = await fetch(endpoint, { method: 'POST', body });
      const data = await res.json();
      if (data.ok) {
        box.classList.add('is-done');
        status.textContent = msg('done');
        window.goatcounter?.count?.({ path: 'event-submit', title: '이벤트 응모', event: true });
        return;
      }
      status.textContent = msg(data.error === 'closed' ? 'closed' : 'error');
    } catch {
      status.textContent = msg('error');
    }
    busy = false;
    button.disabled = false;
  });
}
