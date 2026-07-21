import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAIAgent } from './agent';

// Only the telemetry test needs a fresh module evaluation (the env default is
// an import-time side effect); everything else uses the static import above.
const importAgentFresh = async () => {
  vi.resetModules();
  return import('./agent');
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const chatCompletionResponse = (content: string) =>
  new Response(
    JSON.stringify({
      id: 'mock-completion',
      object: 'chat.completion',
      created: 0,
      model: 'test-model',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

describe('createAIAgent', () => {
  it('creates a Mastra agent', () => {
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

  it('uses an explicit id over the name when given', () => {
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
    await importAgentFresh();
    expect(process.env.MASTRA_TELEMETRY_DISABLED).toBe('1');

    vi.stubEnv('MASTRA_TELEMETRY_DISABLED', 'false');
    await importAgentFresh();
    expect(process.env.MASTRA_TELEMETRY_DISABLED).toBe('false');
  });

  it('defers model resolution so construction works without any config', () => {
    vi.stubEnv('AI_BASE_URL', '');

    expect(() =>
      createAIAgent({
        name: 'test-agent',
        instructions: 'You are a test agent.',
        model: { modelId: 'model-x' },
      }),
    ).not.toThrow();
  });
});

describe('asking an agent a question', () => {
  it('answers via the configured OpenAI-compatible endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatCompletionResponse('Paris'));
    vi.stubGlobal('fetch', fetchMock);

    const agent = createAIAgent({
      name: 'answerer',
      instructions: 'Answer concisely.',
      model: {
        modelId: 'test-model',
        baseURL: 'https://inference.example.com/v1',
        apiKey: 'test-key',
      },
    });

    const result = await agent.generate('What is the capital of France?');

    expect(result.text).toBe('Paris');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      'https://inference.example.com/v1/chat/completions',
    );
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer test-key',
    );

    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe('test-model');
    expect(body.stream).toBeFalsy();

    const contents = body.messages.map(
      ({ content }: { content: string }) => content,
    );
    expect(contents).toContain('Answer concisely.');
    expect(contents).toContain('What is the capital of France?');
  });
});
