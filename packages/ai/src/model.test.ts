import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveAIModelConfig } from './model';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveAIModelConfig', () => {
  it('throws when no inference URL is configured', () => {
    vi.stubEnv('AI_BASE_URL', '');

    expect(() => resolveAIModelConfig({ modelId: 'model-x' })).toThrow(
      'AI_BASE_URL',
    );
  });

  it('throws on an explicitly empty baseURL instead of using the env fallback', () => {
    vi.stubEnv('AI_BASE_URL', 'https://env.example.com/v1');

    expect(() =>
      resolveAIModelConfig({ modelId: 'model-x', baseURL: '' }),
    ).toThrow('No inference URL configured');
  });

  it('uses the given baseURL and apiKey', () => {
    const model = resolveAIModelConfig({
      modelId: 'model-x',
      baseURL: 'https://inference.example.com/v1',
      apiKey: 'user-key',
    });

    expect(model).toEqual({
      providerId: 'op-ai',
      modelId: 'model-x',
      url: 'https://inference.example.com/v1',
      apiKey: 'user-key',
    });
  });

  it('falls back to AI_BASE_URL and AI_API_KEY', () => {
    vi.stubEnv('AI_BASE_URL', 'https://env.example.com/v1');
    vi.stubEnv('AI_API_KEY', 'env-key');

    const model = resolveAIModelConfig({ modelId: 'model-x' });

    expect(model.url).toBe('https://env.example.com/v1');
    expect(model.apiKey).toBe('env-key');
  });

  it('never attaches the env key to a caller-supplied endpoint', () => {
    vi.stubEnv('AI_API_KEY', 'deploy-key');

    const model = resolveAIModelConfig({
      modelId: 'model-x',
      baseURL: 'https://user-endpoint.example.com/v1',
    });

    expect(model.apiKey).toBeUndefined();
  });

  it('allows keyless env-configured endpoints', () => {
    vi.stubEnv('AI_BASE_URL', 'https://env.example.com/v1');
    vi.stubEnv('AI_API_KEY', '');

    const model = resolveAIModelConfig({ modelId: 'model-x' });

    expect(model.apiKey).toBeUndefined();
  });

  it('treats an explicit empty apiKey as keyless on the env endpoint', () => {
    vi.stubEnv('AI_BASE_URL', 'https://env.example.com/v1');
    vi.stubEnv('AI_API_KEY', 'deploy-key');

    const model = resolveAIModelConfig({ modelId: 'model-x', apiKey: '' });

    expect(model.apiKey).toBeUndefined();
  });
});
