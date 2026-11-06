// ДМ (ігровий режим, ліва панель): перемикач «рух вільний / з дозволом» і запити гравців на подорож.
import { button, el } from '../lib/dom.js';
import { editor } from '../state/editorMode.js';
import { session } from '../state/session.js';
import { travelState } from '../state/travel.js';

export function initTravelDmPanel(root) {
  const toggle = root.querySelector('[data-travel-approval]');
  const list = root.querySelector('[data-travel-requests]');

  toggle.addEventListener('change', async () => {
    const r = await travelState.setApproval(toggle.checked);
    if (!r.ok) toggle.checked = !toggle.checked;
  });

  function render() {
    const show = session.user?.role === 'dm' && editor.mode === 'game';
    root.hidden = !show;
    if (!show) return;
    toggle.checked = travelState.approvalRequired;

    const requests = travelState.requests;
    list.replaceChildren(...requests.map((r) => el('li', { class: 'travel-request' },
      el('span', {}, `🙋 ${r.characterName} → ${r.destinationName}`),
      el('span', { class: 'travel-request__actions' },
        button('✅', 'btn--ok', () => travelState.approve(r.characterId), 'Дозволити'),
        button('❌', 'btn--bad', () => travelState.reject(r.characterId), 'Не дозволяти')))));
    list.hidden = !requests.length;
  }

  travelState.onChange(render);
  editor.onChange(render);
  session.onChange(render);
}
