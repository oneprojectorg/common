import type { MessageInput } from '@mastra/core/agent/message-list';
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

  it('always disables Mastra telemetry, even when the env tries to enable it', async () => {
    vi.stubEnv('MASTRA_TELEMETRY_DISABLED', 'false');
    await importAgentFresh();
    expect(process.env.MASTRA_TELEMETRY_DISABLED).toBe('1');
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
    const fetchMock = vi
      .fn()
      .mockResolvedValue(chatCompletionResponse('Paris'));
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

describe('holding a multi-turn conversation', () => {
  it('threads prior turns into later completions so the model remembers', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(chatCompletionResponse('Nice to meet you, Ada.'))
      .mockResolvedValueOnce(chatCompletionResponse('Your name is Ada.'));
    vi.stubGlobal('fetch', fetchMock);

    const agent = createAIAgent({
      name: 'chatter',
      instructions: 'You are a helpful assistant.',
      model: {
        modelId: 'test-model',
        baseURL: 'https://inference.example.com/v1',
        apiKey: 'test-key',
      },
    });

    // History is just an array the caller owns: append each turn (the user
    // message, then the assistant's reply) and pass the whole array to the
    // next generate() call.
    const history: MessageInput[] = [];

    history.push({ role: 'user', content: 'My name is Ada.' });
    const first = await agent.generate(history);
    history.push({ role: 'assistant', content: first.text });

    history.push({ role: 'user', content: 'What is my name?' });
    const second = await agent.generate(history);

    expect(second.text).toBe('Your name is Ada.');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // The second request carries the whole prior conversation, so the model
    // can answer the follow-up from earlier context.
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    const contents = secondBody.messages.map(
      ({ content }: { content: string }) => content,
    );
    expect(contents).toContain('My name is Ada.');
    expect(contents).toContain('Nice to meet you, Ada.');
    expect(contents).toContain('What is my name?');
  });
});
