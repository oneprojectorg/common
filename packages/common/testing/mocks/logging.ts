import { vi } from 'vitest';

export const loggingMock = {
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
  },
  metrics: {
    getMeter: vi.fn(() => ({
      createCounter: vi.fn(() => ({
        add: vi.fn(),
      })),
    })),
  },
  transformMiddlewareRequest: vi.fn(() => ['test request', {}]),
  withLogContext: vi.fn(<T>(fn: () => T): T => fn()),
  setLogDistinctId: vi.fn(),
  setLogSessionId: vi.fn(),
  getPosthogCookieName: vi.fn(() => undefined),
  parsePosthogDistinctId: vi.fn(() => undefined),
  getPosthogDistinctIdFromCookieHeader: vi.fn(() => undefined),
};
