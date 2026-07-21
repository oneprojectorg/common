import { afterEach, describe, expect, it, vi } from 'vitest';

const importAgent = async () => {
  vi.resetModules();
  return import('./agent');
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createAIAgent', () => {
  it('creates a Mastra agent wired to the configured model', async () => {
    vi.stubEnv('AI_API_KEY', 'test-key');
    const { createAIAgent } = await importAgent();

    const agent = createAIAgent({
      name: 'test-agent',
      instructions: 'You are a test agent.',
      modelId: 'provider-model-x',
    });

    expect(agent.name).toBe('test-agent');
    expect(agent.id).toBe('test-agent');
  });

  it('uses an explicit id over the name when given', async () => {
    vi.stubEnv('AI_API_KEY', 'test-key');
    const { createAIAgent } = await importAgent();

    const agent = createAIAgent({
      id: 'stable-id',
      name: 'Display Name',
      instructions: 'You are a test agent.',
      modelId: 'provider-model-x',
    });

    expect(agent.id).toBe('stable-id');
    expect(agent.name).toBe('Display Name');
  });

  it('defers env config so construction works without AI_API_KEY', async () => {
    vi.stubEnv('AI_API_KEY', '');
    const { createAIAgent } = await importAgent();

    expect(() =>
      createAIAgent({
        name: 'test-agent',
        instructions: 'You are a test agent.',
        modelId: 'provider-model-x',
      }),
    ).not.toThrow();
  });
});
