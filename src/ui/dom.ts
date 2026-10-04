export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

export function icon(className: string, svgBody: string, viewBox = '0 0 24 24'): HTMLSpanElement {
  const node = el('span', className);
  node.setAttribute('aria-hidden', 'true');
  node.innerHTML = `<svg viewBox="${viewBox}" focusable="false">${svgBody}</svg>`;
  return node;
}

const ARROW_TURNS: Readonly<Record<string, number>> = { '↑': 0, '→': 90, '↓': 180, '←': 270 };

// Arrow glyphs sit at a different height in each font: they are drawn, and keep their text for
// screen readers.
export function keycap(label: string, style: 'key' | 'button'): HTMLElement {
  const turn = ARROW_TURNS[label];
  if (turn === undefined) {
    return el('kbd', `ui-key ui-key--${style}`, label);
  }
  const key = el('kbd', `ui-key ui-key--${style} ui-key--arrow`);
  key.append(
    icon(
      'ui-key__arrow',
      `<path d="M12 19V5M6 11l6-6 6 6" transform="rotate(${String(turn)} 12 12)" fill="none" ` +
        'stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    ),
    el('span', 'ui-key__text', label),
  );
  return key;
}

export interface HintPart {
  keys: readonly string[];
  label: string;
  // Only on wide or narrow screens, for a menu whose layout changes between them.
  screen?: 'wide' | 'narrow';
}

export function fillHint(
  container: HTMLElement,
  parts: readonly HintPart[],
  style: 'key' | 'button',
): void {
  container.replaceChildren(
    ...parts.map((part) => {
      const item = el(
        'span',
        part.screen === undefined ? 'ui-hint__part' : `ui-hint__part ui-hint__part--${part.screen}`,
      );
      const keys = el('span', 'ui-hint__keys');
      keys.append(...part.keys.map((key) => keycap(key, style)));
      item.append(keys, el('span', 'ui-hint__label', part.label));
      return item;
    }),
  );
}

export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) {
    node.textContent = text;
  }
}

export function setVar(node: HTMLElement, name: string, value: string): void {
  if (node.style.getPropertyValue(name) !== value) {
    node.style.setProperty(name, value);
  }
}

export function setFlag(node: HTMLElement, name: string, on: boolean): void {
  if (on) {
    node.setAttribute(`data-${name}`, '');
  } else {
    node.removeAttribute(`data-${name}`);
  }
}
