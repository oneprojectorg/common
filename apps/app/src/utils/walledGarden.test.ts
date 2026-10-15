import { beforeEach, describe, expect, it, vi } from 'vitest';

import { redirectToLogin } from './walledGarden';

const mocks = vi.hoisted(() => {
  const state: { pathname: string | null } = { pathname: null };

  return Object.assign(state, {
    redirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT ${url}`);
    }),
  });
});

vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers(
      mocks.pathname === null ? {} : { 'x-pathname': mocks.pathname },
    ),
}));
vi.mock('next/navigation', () => ({
  forbidden: vi.fn(),
  redirect: mocks.redirect,
}));

describe('redirectToLogin', () => {
  beforeEach(() => {
    mocks.pathname = null;
  });

  it('carries the attempted path back through login', async () => {
    mocks.pathname = '/en/decisions/budget/manage';

    await expect(redirectToLogin()).rejects.toThrow(
      'REDIRECT /login?redirect=%2Fen%2Fdecisions%2Fbudget%2Fmanage',
    );
  });

  it('falls back to plain login without a path', async () => {
    await expect(redirectToLogin()).rejects.toThrow(/^REDIRECT \/login$/);
  });

  it('falls back to plain login for an unsafe path', async () => {
    mocks.pathname = '//evil.example.com';

    await expect(redirectToLogin()).rejects.toThrow(/^REDIRECT \/login$/);
  });
});
