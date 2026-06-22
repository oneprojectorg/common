/**
 * Regression test: TRPCProvider must instantiate a fresh QueryClient on every
 * mount, never a module-level singleton.
 *
 * The bug it guards against: Next App Router server-renders client components,
 * so a `const queryClient = new QueryClient()` at module scope is shared by
 * every concurrent SSR request on the same Node worker. With a 24h gcTime,
 * one user's account row stayed cached and leaked into the next request's
 * useSuspenseQuery hit.
 */
import { useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The httpLink in ./links requires an OPURLConfig-resolved trpcUrl that isn't
// wired in the test env. We're testing the QueryClient lifecycle, not the
// transport, so stub the links module to a no-op array.
vi.mock('./links', () => ({
  createLinks: () => [],
}));

import { TRPCProvider } from './TRPCProvider';

describe('TRPCProvider', () => {
  it('isolates QueryClient between renders — no cross-request leak', () => {
    const captured: Array<ReturnType<typeof useQueryClient>> = [];

    const Capture = () => {
      captured.push(useQueryClient());
      return null;
    };

    renderToString(
      <TRPCProvider ssrCookies="user-a">
        <Capture />
      </TRPCProvider>,
    );
    renderToString(
      <TRPCProvider ssrCookies="user-b">
        <Capture />
      </TRPCProvider>,
    );

    const [clientA, clientB] = captured;
    expect(clientA).toBeDefined();
    expect(clientB).toBeDefined();
    expect(clientA).not.toBe(clientB);

    // Seed render A's cache; the leak path was render B reading A's data.
    clientA!.setQueryData(['account.getMyAccount'], { email: 'user-a@x' });
    expect(clientB!.getQueryData(['account.getMyAccount'])).toBeUndefined();
  });
});
