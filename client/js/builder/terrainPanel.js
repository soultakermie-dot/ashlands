// Вкладка «⛰ Земля» панелі будівельника: вибір і перетягування точок, точна висота,
// додати / видалити точки, розмір ділянки, вибір між землею з точок і terrain.glb.
// Сама нічого не зберігає — викликає дії з builderView.
import { button, el } from '../lib/dom.js';

const TOOLS = [
  { id: 'select', label: '👆 Точки', hint: 'Клік — вибрати точку, Shift+клік — додати до вибору. Тягни зелену стрілку вгору / вниз. Delete — видалити вибрані.' },
  { id: 'add', label: '➕ Додати точку', hint: 'Клікни по землі — там з\'явиться нова точка й з\'єднається з найближчими.' },
];

const round = (v) => Math.round(v * 1000) / 1000;

/**
 * @param ctx { scene3d, terrain (дані з сервера), hasGlb, tool, step,
 *              setTool(id), setMode(mode), setHeights(indices, heights), removeSelected(), resize(w, d), setStep(v) }
 */
export function terrainPanel(ctx) {
  const { scene3d, terrain } = ctx;
  const pt = scene3d.pointTerrain;
  const parts = [];

  if (ctx.hasGlb) {
    parts.push(el('p', { class: 'builder-library__group' }, 'Яку землю показувати'),
      el('div', { class: 'builder-modes builder-modes--2' },
        el('button', { type: 'button', class: `tool-btn${terrain.mode === 'points' ? ' tool-btn--active' : ''}`, onclick: () => ctx.setMode('points') }, '⛰ З точок'),
        el('button', { type: 'button', class: `tool-btn${terrain.mode === 'glb' ? ' tool-btn--active' : ''}`, onclick: () => ctx.setMode('glb') }, '🗿 terrain.glb')));
  }
  if (!pt) {
    parts.push(el('p', { class: 'hint' }, 'Зараз показано terrain.glb з Blender — його змінюють у Blender. Щоб ліпити землю тут, вибери «З точок».'));
    return parts;
  }

  parts.push(el('div', { class: 'builder-modes builder-modes--2' }, TOOLS.map((t) => el('button', {
    type: 'button', class: `tool-btn${ctx.tool === t.id ? ' tool-btn--active' : ''}`, onclick: () => ctx.setTool(t.id),
  }, t.label))));
  parts.push(el('p', { class: 'builder-hint' }, TOOLS.find((t) => t.id === ctx.tool)?.hint ?? ''));

  // Вибрані точки
  const sel = pt.selected;
  if (sel.length) {
    const avg = sel.reduce((s, i) => s + pt.heightOf(i), 0) / sel.length;
    const height = el('input', { type: 'number', step: 'any', class: 'inv-input', value: round(avg), title: 'Висота в метрах (0 — рівень моря міста)' });
    const step = el('input', { type: 'number', step: 'any', min: 0, class: 'inv-input builder-terrain__step', value: ctx.step, title: 'Крок для ▲ ▼, м' });
    step.addEventListener('change', () => ctx.setStep(Math.abs(Number(step.value)) || 1));
    const setAll = () => { const v = Number(height.value); if (Number.isFinite(v)) ctx.setHeights(sel, sel.map(() => v)); };
    height.addEventListener('change', setAll);
    const shift = (dir) => ctx.setHeights(sel, sel.map((i) => pt.heightOf(i) + dir * ctx.step));
    parts.push(el('div', { class: 'builder-selected' },
      el('p', {}, `Вибрано точок: ${sel.length}`),
      el('label', { class: 'field' }, el('span', {}, sel.length > 1 ? 'Висота (усім однакова), м' : 'Висота, м'), height),
      el('div', { class: 'builder-terrain__row' },
        button('▼', 'btn--ghost', () => shift(-1), 'Опустити на крок'),
        button('▲', 'btn--ghost', () => shift(1), 'Підняти на крок'),
        el('span', {}, 'крок'), step, el('span', {}, 'м')),
      el('div', { class: 'builder-row' },
        button('Зняти вибір', 'btn--ghost', () => scene3d.selectPoints([]) || ctx.rerender()),
        button('🗑 Видалити точки', 'btn--bad', ctx.removeSelected, 'Клавіша Delete'))));
  } else if (ctx.tool === 'select') {
    parts.push(el('p', { class: 'hint' }, 'Точок не вибрано.'));
  }

  // Розмір ділянки
  const w = el('input', { type: 'number', min: 10, max: 2000, step: 'any', class: 'inv-input', value: terrain.size.w });
  const d = el('input', { type: 'number', min: 10, max: 2000, step: 'any', class: 'inv-input', value: terrain.size.d });
  const estimate = el('p', { class: 'hint' });
  const updateEstimate = () => {
    const W = Number(w.value); const D = Number(d.value); const s = terrain.spacing;
    // Скільки точок сітки (як на сервері: кратні кроку від центру + краї).
    const n = (len) => { const h = len / 2; const a = Math.ceil(-h / s - 1e-9); const b = Math.floor(h / s + 1e-9); return b - a + 1 + (a * s > -h + 1e-6) + (b * s < h - 1e-6); };
    const added = Math.max(0, n(W) * n(D) - n(Math.min(W, terrain.size.w)) * n(Math.min(D, terrain.size.d)));
    estimate.textContent = `Точок зараз: ${pt.count.toLocaleString('uk')}. Після зміни ≈ ${(pt.count + added).toLocaleString('uk')} (максимум 300 000). Нова площа — рівна, висота 0; що за межами — зникне.`;
  };
  w.addEventListener('input', updateEstimate);
  d.addEventListener('input', updateEstimate);
  updateEstimate();
  parts.push(
    el('h3', { class: 'sheet__title' }, 'Розмір ділянки'),
    el('div', { class: 'builder-terrain__size' },
      el('label', { class: 'field' }, el('span', {}, 'Ширина, м'), w),
      el('label', { class: 'field' }, el('span', {}, 'Глибина, м'), d)),
    estimate,
    button('Змінити розмір', 'btn--ghost', () => ctx.resize(Number(w.value), Number(d.value))),
    el('p', { class: 'hint' }, `Відстань між точками сітки: ${terrain.spacing} м.`),
  );
  return parts;
}
