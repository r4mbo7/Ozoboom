type PointerMove = Pick<PointerEvent, 'pointerType' | 'movementX' | 'movementY'>;

// A menu that opens under a resting cursor gets a hover from the browser without any move: only a
// real move of the mouse may take the selection from the keyboard or the gamepad.
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
