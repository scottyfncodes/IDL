import { afterEach } from 'vitest';

afterEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

// jsdom has no PointerEvent; a MouseEvent subclass carries what our touch
// handling reads (pointerId, pointerType, clientX/Y).
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = PointerEventPolyfill;
  (globalThis as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = PointerEventPolyfill;
}
