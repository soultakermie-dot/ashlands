// Маленькі помічники для створення елементів, щоб код інтерфейсу був коротшим.

// el('div', { class: 'x', title: 'y', onclick: fn }, ...діти) — діти: рядки або елементи.
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key in node && key !== 'list') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

export function button(label, css, onClick, title = '') {
  return el('button', {
    type: 'button',
    class: `btn btn--small ${css}`,
    title,
    onclick: async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try { await onClick(e); } finally { btn.disabled = false; }
    },
  }, label);
}

// Повідомлення про помилку/успіх під формою.
export function messageLine() {
  const node = el('p', { class: 'form-message', hidden: true });
  node.show = (text, kind = 'error') => {
    node.textContent = text;
    node.hidden = !text;
    node.classList.toggle('form-message--info', kind === 'info');
  };
  return node;
}
