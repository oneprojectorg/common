import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveAIModel } from './model';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveAIModel', () => {
  it('throws when no inference URL is configured', () => {
    vi.stubEnv('AI_BASE_URL', '');

    expect(() => resolveAIModel({ modelId: 'model-x' })).toThrow('AI_BASE_URL');
  });

  it('uses the given baseURL and apiKey', () => {
    const model = resolveAIModel({
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

  it('prefers explicit config over env fallbacks', () => {
    vi.stubEnv('AI_BASE_URL', 'https://env.example.com/v1');
    vi.stubEnv('AI_API_KEY', 'env-key');

    const model = resolveAIModel({
      modelId: 'model-x',
      baseURL: 'https://user.example.com/v1',
      apiKey: 'user-key',
    });

    expect(model.url).toBe('https://user.example.com/v1');
    expect(model.apiKey).toBe('user-key');
  });

  it('falls back to AI_BASE_URL and AI_API_KEY', () => {
    vi.stubEnv('AI_BASE_URL', 'https://env.example.com/v1');
    vi.stubEnv('AI_API_KEY', 'env-key');

    const model = resolveAIModel({ modelId: 'model-x' });

    expect(model.url).toBe('https://env.example.com/v1');
    expect(model.apiKey).toBe('env-key');
  });

  it('allows keyless endpoints', () => {
    vi.stubEnv('AI_API_KEY', '');

    const model = resolveAIModel({
      modelId: 'model-x',
      baseURL: 'https://ollama.internal/v1',
    });

    expect(model.apiKey).toBeUndefined();
  });
});
