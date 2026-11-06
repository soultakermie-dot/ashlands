// Розділ «🎲 Кубики»: вибрати кубик, кількість, модифікатор, кинути; стрічка кидків.
// ДМ може кинути приховано. Новий кидок на кілька секунд спливає вгорі карти.
import { button, el, messageLine } from '../lib/dom.js';
import { describeRoll, diceState } from '../state/dice.js';
import { session } from '../state/session.js';

const DICE = [4, 6, 8, 10, 12, 20, 100];
const TOAST_MS = 7000;

export function initDicePanel(root, toastRoot) {
  let sides = 20;
  const count = el('input', { type: 'number', min: 1, max: 10, step: 1, value: 1, class: 'inv-input inv-input--num', title: 'Скільки кубиків' });
  const modifier = el('input', { type: 'number', min: -100, max: 100, step: 1, value: 0, class: 'inv-input inv-input--num', title: 'Модифікатор (+2, −1…)' });
  const hidden = el('input', { type: 'checkbox' });
  const hiddenLabel = el('label', { class: 'dice-hidden' }, hidden, ' 🙈 Приховано (бачу лише я)');
  const message = messageLine();
  const diceButtons = el('div', { class: 'dice-picker' });
  const list = el('ul', { class: 'dice-log' });

  function renderPicker() {
    diceButtons.replaceChildren(...DICE.map((s) => el('button', {
      type: 'button',
      class: `dice-btn${s === sides ? ' dice-btn--active' : ''}`,
      onclick: () => { sides = s; renderPicker(); },
    }, `к${s}`)));
  }

  root.replaceChildren(
    diceButtons,
    el('div', { class: 'dice-row' },
      el('label', {}, 'Кількість ', count),
      el('label', {}, 'Модифікатор ', modifier),
      button('🎲 Кинути', 'btn--ok', async () => {
        const r = await diceState.roll(sides, Number(count.value), Number(modifier.value), hidden.checked);
        message.show(r.ok ? '' : r.error);
      })),
    hiddenLabel,
    message,
    el('h3', { class: 'sheet__title' }, 'Останні кидки'),
    list,
  );
  renderPicker();

  function renderLog(log) {
    if (!log.length) { list.replaceChildren(el('li', { class: 'hint' }, 'Ще ніхто не кидав')); return; }
    list.replaceChildren(...[...log].reverse().map((e) => rollRow(e)));
  }

  // Спливаюче повідомлення про новий кидок.
  let toastTimer = 0;
  function toast(e) {
    toastRoot.replaceChildren(rollRow(e, 'div'));
    toastRoot.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastRoot.hidden = true; }, TOAST_MS);
  }

  diceState.onChange((log, latest) => {
    renderLog(log);
    if (latest) toast(latest);
  });
  session.onChange((user) => { hiddenLabel.hidden = user?.role !== 'dm'; if (hiddenLabel.hidden) hidden.checked = false; });
}

function rollRow(e, tag = 'li') {
  const crit = e.crit === 'success' ? ' dice-roll--crit' : e.crit === 'fail' ? ' dice-roll--fail' : '';
  return el(tag, { class: `dice-roll${e.hidden ? ' dice-roll--hidden' : ''}${crit}` },
    el('span', { class: 'dice-roll__total' }, String(e.total)),
    el('span', { class: 'dice-roll__text' },
      el('strong', {}, describeRoll(e).split(':')[0]),
      el('span', {}, ` ${e.expr}`),
      e.rolls.length > 1 || e.modifier ? el('span', { class: 'hint' }, ` [${e.rolls.join(', ')}${e.modifier ? `${e.modifier > 0 ? ' +' : ' −'}${Math.abs(e.modifier)}` : ''}]`) : null,
      e.crit === 'success' ? el('span', {}, ' ✨ критичний успіх!') : e.crit === 'fail' ? el('span', {}, ' 💀 провал') : null,
      e.hidden ? el('span', { class: 'hint' }, ' 🙈 приховано') : null));
}
