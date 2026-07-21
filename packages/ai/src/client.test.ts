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
  it('throws when AI_API_KEY is not set', async () => {
    vi.stubEnv('AI_API_KEY', '');
    const { getAIClient } = await importClient();

    expect(() => getAIClient()).toThrow('AI_API_KEY');
  });

  it('points the client at the configured provider endpoint', async () => {
    vi.stubEnv('AI_API_KEY', 'test-key');
    vi.stubEnv('AI_BASE_URL', 'https://provider.example.com/v1');
    const { getAIClient } = await importClient();

    const client = getAIClient();

    expect(client.baseURL).toBe('https://provider.example.com/v1');
    expect(client.apiKey).toBe('test-key');
  });

  it('falls back to the SDK default endpoint when AI_BASE_URL is unset', async () => {
    vi.stubEnv('AI_API_KEY', 'test-key');
    vi.stubEnv('AI_BASE_URL', '');
    const { getAIClient } = await importClient();

    expect(getAIClient().baseURL).toBe('https://api.openai.com/v1');
  });

  it('memoizes the client across calls', async () => {
    vi.stubEnv('AI_API_KEY', 'test-key');
    const { getAIClient } = await importClient();

    expect(getAIClient()).toBe(getAIClient());
  });
});
