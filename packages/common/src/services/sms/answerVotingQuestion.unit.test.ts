import { createTool } from '@op/ai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { runVotingAssistant } from './answerVotingQuestion';

const COMMAND_LIST = 'Commands:\nSHOW your decisions\nVOTE register to vote';

const STUB_TOOLS = {
  get_stub: createTool({
    id: 'get_stub',
    description: 'A stub tool.',
    inputSchema: z.object({}),
    execute: async () => ({ ok: true }),
  }),
};

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

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const stubEndpoint = (content: string) => {
  vi.stubEnv('AI_BASE_URL', 'https://inference.example.com/v1');
  vi.stubEnv('AI_API_KEY', 'test-key');
  vi.stubEnv('AI_MODEL_ID', '');
  const fetchMock = vi.fn().mockResolvedValue(chatCompletionResponse(content));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('runVotingAssistant', () => {
  it('asks the configured model with the tools, the commands and the question', async () => {
    const fetchMock = stubEndpoint('Text VOTE to register.');

    const result = await runVotingAssistant({
      question: 'How do I vote?',
      commandList: COMMAND_LIST,
      tools: STUB_TOOLS,
    });

    expect(result.answer).toBe('Text VOTE to register.');
    expect(result.responseMessages.at(-1)).toMatchObject({
      role: 'assistant',
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe('glm-5.3-flash');
    expect(JSON.stringify(body.tools)).toContain('get_stub');
    const contents = JSON.stringify(body.messages);
    expect(contents).toContain('VOTE register to vote');
    expect(contents).toContain('Question: How do I vote?');
    expect(contents).toContain('submit_ballot only');
  });

  it('reads the model id from AI_MODEL_ID when set', async () => {
    const fetchMock = stubEndpoint('ok');
    vi.stubEnv('AI_MODEL_ID', 'other-model');

    await runVotingAssistant({
      question: 'q',
      commandList: COMMAND_LIST,
      tools: STUB_TOOLS,
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe('other-model');
  });

  it('clips a long answer to the SMS body cap', async () => {
    stubEndpoint('a'.repeat(2000));

    const result = await runVotingAssistant({
      question: 'q',
      commandList: COMMAND_LIST,
      tools: STUB_TOOLS,
    });

    expect(result.answer?.length).toBeLessThanOrEqual(1600);
  });

  it('answers null when the endpoint fails', async () => {
    vi.stubEnv('AI_BASE_URL', 'https://inference.example.com/v1');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

    const result = await runVotingAssistant({
      question: 'q',
      commandList: COMMAND_LIST,
      tools: STUB_TOOLS,
    });

    expect(result.answer).toBeNull();
    expect(result.responseMessages).toEqual([]);
  });

  it('answers null when the model returns no text', async () => {
    stubEndpoint('');

    const result = await runVotingAssistant({
      question: 'q',
      commandList: COMMAND_LIST,
      tools: STUB_TOOLS,
    });

    expect(result.answer).toBeNull();
  });

  it('sends the replayed history ahead of the question', async () => {
    const fetchMock = stubEndpoint('Your last pick was 101.');

    await runVotingAssistant({
      question: 'what did I just add?',
      commandList: COMMAND_LIST,
      tools: STUB_TOOLS,
      history: [
        { role: 'user', content: 'L add 101' },
        { role: 'assistant', content: 'Added 101.' },
      ],
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const roles = body.messages.map((m: { role: string }) => m.role);
    expect(roles.slice(-3)).toEqual(['user', 'assistant', 'user']);
    const contents = JSON.stringify(body.messages);
    expect(contents.indexOf('L add 101')).toBeGreaterThan(-1);
    expect(contents.indexOf('L add 101')).toBeLessThan(
      contents.indexOf('what did I just add?'),
    );
  });
});
