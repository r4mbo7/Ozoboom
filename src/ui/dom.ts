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

export function keycap(label: string, style: 'key' | 'button'): HTMLElement {
  return el('kbd', `ui-key ui-key--${style}`, label);
}

export interface HintPart {
  keys: readonly string[];
  label: string;
}

export function fillHint(
  container: HTMLElement,
  parts: readonly HintPart[],
  style: 'key' | 'button',
): void {
  container.replaceChildren(
    ...parts.map((part) => {
      const item = el('span', 'ui-hint__part');
      item.append(...part.keys.map((key) => keycap(key, style)), el('span', '', part.label));
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
