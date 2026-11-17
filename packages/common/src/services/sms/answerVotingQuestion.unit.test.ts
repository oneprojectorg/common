import { afterEach, describe, expect, it, vi } from 'vitest';

import { answerVotingQuestion } from './answerVotingQuestion';

const COMMAND_LIST = 'Commands:\nSHOW your decisions\nVOTE register to vote';

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
  const fetchMock = vi.fn().mockResolvedValue(chatCompletionResponse(content));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('answerVotingQuestion', () => {
  it('asks the configured model with the commands, the facts and the question', async () => {
    const fetchMock = stubEndpoint('Text VOTE to register.');

    const answer = await answerVotingQuestion({
      question: 'How do I vote?',
      commandList: COMMAND_LIST,
      facts: ['Decision: "Columbus", voting open.'],
    });

    expect(answer).toBe('Text VOTE to register.');
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe('glm-5.3-flash');
    const contents = body.messages.map(
      ({ content }: { content: string }) => content,
    );
    expect(contents.join('\n')).toContain('VOTE register to vote');
    expect(contents.join('\n')).toContain('Decision: "Columbus", voting open.');
    expect(contents.join('\n')).toContain('Question: How do I vote?');
  });

  it('reads the model id from AI_MODEL_ID when set', async () => {
    const fetchMock = stubEndpoint('ok');
    vi.stubEnv('AI_MODEL_ID', 'other-model');

    await answerVotingQuestion({
      question: 'q',
      commandList: COMMAND_LIST,
      facts: [],
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe('other-model');
  });

  it('clips a long answer to one SMS segment', async () => {
    stubEndpoint('a'.repeat(400));

    const answer = await answerVotingQuestion({
      question: 'q',
      commandList: COMMAND_LIST,
      facts: [],
    });

    expect(answer?.length).toBeLessThanOrEqual(160);
  });

  it('answers null when the endpoint fails', async () => {
    vi.stubEnv('AI_BASE_URL', 'https://inference.example.com/v1');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

    const answer = await answerVotingQuestion({
      question: 'q',
      commandList: COMMAND_LIST,
      facts: [],
    });

    expect(answer).toBeNull();
  });

  it('answers null when the model returns no text', async () => {
    stubEndpoint('');

    const answer = await answerVotingQuestion({
      question: 'q',
      commandList: COMMAND_LIST,
      facts: [],
    });

    expect(answer).toBeNull();
  });
});
