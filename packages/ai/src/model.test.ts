import { afterEach, describe, expect, it, vi } from 'vitest';

const importModel = async () => {
  vi.resetModules();
  return import('./model');
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getAIModel', () => {
  it('throws when AI_API_KEY is not set', async () => {
    vi.stubEnv('AI_API_KEY', '');
    const { getAIModel } = await importModel();

    expect(() => getAIModel('some-model')).toThrow('AI_API_KEY');
  });

  it('throws when no model id is given and AI_MODEL is unset', async () => {
    vi.stubEnv('AI_API_KEY', 'test-key');
    vi.stubEnv('AI_MODEL', '');
    const { getAIModel } = await importModel();

    expect(() => getAIModel()).toThrow('AI_MODEL');
  });

  it('builds a model for the given model id', async () => {
    vi.stubEnv('AI_API_KEY', 'test-key');
    const { getAIModel } = await importModel();

    const model = getAIModel('provider-model-x');

    expect(model.modelId).toBe('provider-model-x');
  });

  it('falls back to AI_MODEL when no model id is given', async () => {
    vi.stubEnv('AI_API_KEY', 'test-key');
    vi.stubEnv('AI_MODEL', 'default-model');
    const { getAIModel } = await importModel();

    expect(getAIModel().modelId).toBe('default-model');
  });
});
