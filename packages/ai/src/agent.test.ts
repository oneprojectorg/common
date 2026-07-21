import { afterEach, describe, expect, it, vi } from 'vitest';

const importAgent = async () => {
  vi.resetModules();
  return import('./agent');
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createAIAgent', () => {
  it('creates a Mastra agent', async () => {
    const { createAIAgent } = await importAgent();

    const agent = createAIAgent({
      name: 'test-agent',
      instructions: 'You are a test agent.',
      model: {
        modelId: 'model-x',
        baseURL: 'https://inference.example.com/v1',
      },
    });

    expect(agent.name).toBe('test-agent');
    expect(agent.id).toBe('test-agent');
  });

  it('uses an explicit id over the name when given', async () => {
    const { createAIAgent } = await importAgent();

    const agent = createAIAgent({
      id: 'stable-id',
      name: 'Display Name',
      instructions: 'You are a test agent.',
      model: {
        modelId: 'model-x',
        baseURL: 'https://inference.example.com/v1',
      },
    });

    expect(agent.id).toBe('stable-id');
    expect(agent.name).toBe('Display Name');
  });

  it('disables Mastra telemetry by default without clobbering an explicit value', async () => {
    vi.stubEnv('MASTRA_TELEMETRY_DISABLED', '');
    await importAgent();
    expect(process.env.MASTRA_TELEMETRY_DISABLED).toBe('1');

    vi.stubEnv('MASTRA_TELEMETRY_DISABLED', 'false');
    await importAgent();
    expect(process.env.MASTRA_TELEMETRY_DISABLED).toBe('false');
  });

  it('defers model resolution so construction works without any config', async () => {
    vi.stubEnv('AI_BASE_URL', '');
    const { createAIAgent } = await importAgent();

    expect(() =>
      createAIAgent({
        name: 'test-agent',
        instructions: 'You are a test agent.',
        model: { modelId: 'model-x' },
      }),
    ).not.toThrow();
  });
});
