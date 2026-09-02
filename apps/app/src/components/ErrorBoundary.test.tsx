/**
 * A wrapper element around the fallback becomes the fallback's layout box. The
 * bare `<div>` this branch used to render is a block box with auto height, so
 * the access-denied screen's `height: 100%` collapsed to its content height and
 * the screen stopped centering vertically.
 *
 * The test calls `render()` directly: both server renderers rethrow instead of
 * falling back to the boundary, and the app's vitest environment is `node`.
 */
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

// The default fallback imports next-intl's client navigation, which does not
// resolve under vitest.
vi.mock('./ErrorMessage', () => ({ ErrorMessage: () => null }));

import ErrorBoundary from './ErrorBoundary';

describe('ErrorBoundary', () => {
  it('renders the fallback unwrapped, so it keeps its parent as its layout box', () => {
    const fallback = <p className="size-full">Access denied</p>;
    const boundary = new ErrorBoundary({ fallback, children: null });

    boundary.state = ErrorBoundary.getDerivedStateFromError(new Error('boom'));

    expect(boundary.render()).toBe(fallback);
  });
});
