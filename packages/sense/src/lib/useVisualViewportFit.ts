import * as React from 'react';

import { attachRef } from './attachRef';

type FitRef = React.Ref<HTMLDivElement> | undefined;

const EDITABLE = 'input, textarea, select, [contenteditable="true"]';

/**
 * Keeps a `fixed` full-screen surface inside the visual viewport. iOS Safari
 * overlays the keyboard and pans the page instead of shrinking the layout
 * viewport, so a `fixed inset-0` popup slides off the top of the screen rather
 * than scrolling its content. The returned ref writes
 * `--visual-viewport-height` and `--visual-viewport-top` on the node (size the
 * element from those with a layout-viewport fallback) and cancels any vertical
 * touch gesture the surface cannot absorb by scrolling, which is what would
 * otherwise pan the viewport. Base UI's iOS scroll lock is `overflow: hidden`
 * on `<html>` only and does not stop that pan.
 */
function useVisualViewportFit(ref: FitRef): React.RefCallback<HTMLDivElement> {
  return React.useCallback(
    (node: HTMLDivElement | null) => {
      const release = attachRef(ref, node);
      if (!node) {
        return release;
      }
      const stopFit = track(node);
      const stopPan = containTouchScroll(node);
      return () => {
        stopPan();
        stopFit();
        release();
      };
    },
    [ref],
  );
}

function track(node: HTMLElement) {
  const viewport = window.visualViewport;
  if (!viewport) {
    return () => {};
  }
  const fit = () => {
    node.style.setProperty('--visual-viewport-height', `${viewport.height}px`);
    node.style.setProperty('--visual-viewport-top', `${viewport.offsetTop}px`);
  };
  const reset = () => {
    node.style.removeProperty('--visual-viewport-height');
    node.style.removeProperty('--visual-viewport-top');
  };
  // iOS reports the resize only after the keyboard has finished animating.
  // Losing focus is when dismissal starts, so fall back to the layout
  // viewport at once; a focus moving to another field re-measures, and the
  // eventual `resize` confirms either way.
  const onFocusOut = (event: FocusEvent) => {
    if (isEditable(event.target)) {
      reset();
    }
  };
  const onFocusIn = (event: FocusEvent) => {
    if (isEditable(event.target)) {
      fit();
    }
  };
  fit();
  // `scroll` covers the pan iOS still performs while the keyboard is open.
  viewport.addEventListener('resize', fit);
  viewport.addEventListener('scroll', fit);
  node.addEventListener('focusout', onFocusOut);
  node.addEventListener('focusin', onFocusIn);
  return () => {
    viewport.removeEventListener('resize', fit);
    viewport.removeEventListener('scroll', fit);
    node.removeEventListener('focusout', onFocusOut);
    node.removeEventListener('focusin', onFocusIn);
  };
}

function isEditable(target: EventTarget | null) {
  return target instanceof Element && target.closest(EDITABLE) !== null;
}

function containTouchScroll(node: HTMLElement) {
  let startX = 0;
  let startY = 0;
  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (event.touches.length === 1 && touch) {
      startX = touch.clientX;
      startY = touch.clientY;
    }
  };
  const onTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (event.touches.length !== 1 || !touch || !event.cancelable) {
      return;
    }
    // The viewport can only pan while something (the keyboard) shrinks it.
    const viewport = window.visualViewport;
    if (!viewport || viewport.height >= window.innerHeight) {
      return;
    }
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    if (deltaY === 0 || Math.abs(deltaX) > Math.abs(deltaY)) {
      return;
    }
    // Selection handles inside a field need the native gesture.
    if (isEditable(event.target)) {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (!canScrollToward(target, node, deltaY)) {
      event.preventDefault();
    }
  };
  node.addEventListener('touchstart', onTouchStart, { passive: true });
  node.addEventListener('touchmove', onTouchMove, { passive: false });
  return () => {
    node.removeEventListener('touchstart', onTouchStart);
    node.removeEventListener('touchmove', onTouchMove);
  };
}

/** Whether an element between `target` and `root` can still scroll the way a finger moving by `deltaY` asks. */
function canScrollToward(
  target: Element | null,
  root: HTMLElement,
  deltaY: number,
): boolean {
  let element: Element | null = target;
  while (element) {
    const { overflowY } = getComputedStyle(element);
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      element.scrollHeight > element.clientHeight
    ) {
      const atTop = element.scrollTop <= 0;
      const atBottom =
        element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
      if ((deltaY > 0 && !atTop) || (deltaY < 0 && !atBottom)) {
        return true;
      }
    }
    if (element === root) {
      return false;
    }
    element = element.parentElement;
  }
  return false;
}

export { useVisualViewportFit };
