import { afterEach, describe, expect, it, vi } from 'vitest';

// The client is a module-level singleton, so each test re-imports a fresh
// module instance to keep env stubs from leaking between tests.
const importClient = async () => {
  vi.resetModules();
  return import('./client');
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getAIClient', () => {
  it('throws when TOGETHER_API_KEY is not set', async () => {
    vi.stubEnv('TOGETHER_API_KEY', '');
    const { getAIClient } = await importClient();

    expect(() => getAIClient()).toThrow('TOGETHER_API_KEY');
  });

  it('creates a client pointed at Together.ai', async () => {
    vi.stubEnv('TOGETHER_API_KEY', 'test-key');
    const { getAIClient } = await importClient();

    const client = getAIClient();

    expect(client.baseURL).toBe('https://api.together.xyz/v1');
    expect(client.apiKey).toBe('test-key');
  });

  it('memoizes the client across calls', async () => {
    vi.stubEnv('TOGETHER_API_KEY', 'test-key');
    const { getAIClient } = await importClient();

    expect(getAIClient()).toBe(getAIClient());
  });
});
