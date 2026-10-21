import * as React from 'react';

import { attachRef } from './attachRef';

type FitRef = React.Ref<HTMLDivElement> | undefined;

/**
 * Keeps a `fixed` full-screen surface inside the visual viewport. iOS Safari
 * overlays the keyboard and pans the page instead of shrinking the layout
 * viewport, so a `fixed inset-0` popup slides off the top of the screen rather
 * than scrolling its content. The returned ref writes
 * `--visual-viewport-height` and `--visual-viewport-top` on the node; size the
 * element from those with a layout-viewport fallback.
 */
function useVisualViewportFit(ref: FitRef): React.RefCallback<HTMLDivElement> {
  return React.useCallback(
    (node: HTMLDivElement | null) => {
      const release = attachRef(ref, node);
      const stop = node ? track(node) : () => {};
      return () => {
        stop();
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
  fit();
  // `scroll` covers the pan iOS still performs while the keyboard is open.
  viewport.addEventListener('resize', fit);
  viewport.addEventListener('scroll', fit);
  return () => {
    viewport.removeEventListener('resize', fit);
    viewport.removeEventListener('scroll', fit);
  };
}

export { useVisualViewportFit };
