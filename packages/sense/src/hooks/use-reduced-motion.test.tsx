// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  prefersReducedMotion,
  usePrefersReducedMotion,
} from './use-reduced-motion';

// jsdom has no matchMedia; this stub lets a test flip the preference and fire `change`.
function stubMatchMedia(initial: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches: initial,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => false,
  };
  vi.stubGlobal('matchMedia', () => mql);
  return {
    listeners,
    set(matches: boolean) {
      mql.matches = matches;
      listeners.forEach((listener) => listener());
    },
  };
}

function Probe() {
  return <span>{String(usePrefersReducedMotion())}</span>;
}

describe('prefersReducedMotion', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the media query synchronously', () => {
    stubMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    stubMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('usePrefersReducedMotion', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('tracks the preference and re-renders on change', () => {
    const media = stubMatchMedia(false);
    act(() => root.render(<Probe />));
    expect(container.textContent).toBe('false');

    act(() => media.set(true));
    expect(container.textContent).toBe('true');
  });

  it('removes its listener on unmount', () => {
    const media = stubMatchMedia(false);
    act(() => root.render(<Probe />));
    expect(media.listeners.size).toBe(1);

    act(() => root.unmount());
    expect(media.listeners.size).toBe(0);
    root = createRoot(container);
  });

  it('renders false on the server', () => {
    stubMatchMedia(true);
    expect(renderToString(<Probe />)).toContain('false');
  });
});
