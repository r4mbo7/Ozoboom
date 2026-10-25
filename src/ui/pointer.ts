type PointerMove = Pick<PointerEvent, 'pointerType' | 'movementX' | 'movementY'>;

// A menu opening under a resting cursor gets a hover without any move: only a real mouse move takes the selection.
export function isMouseMove(event: PointerMove): boolean {
  return event.pointerType === 'mouse' && (event.movementX !== 0 || event.movementY !== 0);
}

export function onMouseMove(node: HTMLElement, action: () => void): void {
  node.addEventListener('pointermove', (event) => {
    if (isMouseMove(event)) {
      action();
    }
  });
}
