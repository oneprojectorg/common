import { createServer } from 'node:http';
import type { AddressInfo, Server } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@op/logging', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { createAIAgent } from '@op/ai';
import { logger } from '@op/logging';

import { askForJson } from './askForJson';
import {
  THEME_ANALYSIS_MAX_OUTPUT_TOKENS,
  THEME_ANALYSIS_MODEL_ID,
  THEME_ANALYSIS_THINKING_OFF,
} from './constants';

/**
 * The real `@op/ai` stack, against a stub endpoint.
 *
 * Everything else in this directory mocks `createAIAgent`, which means the only
 * untested link is the one between our options and the bytes Mastra actually
 * sends — exactly where a silently-ignored setting hides. This starts an
 * OpenAI-compatible server, records the request, and answers in the shape the
 * model we run on answers in.
 */
let server: Server;
let requestBodies: Array<Record<string, unknown>> = [];
let reply = '';
/** When set, the stub accepts the request and never answers. */
let hang = false;

beforeAll(async () => {
  server = createServer((request, response) => {
    let raw = '';

    request.on('data', (chunk) => {
      raw += chunk;
    });

    request.on('end', () => {
      requestBodies.push(JSON.parse(raw));

      if (hang) {
        return;
      }

      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          id: 'stub',
          object: 'chat.completion',
          created: 0,
          model: 'stub-model',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: reply },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const { port } = server.address() as AddressInfo;

  process.env.AI_BASE_URL = `http://127.0.0.1:${port}/v1`;
  process.env.AI_API_KEY = 'stub-key';
});

afterAll(() => {
  server.close();
});

const ask = () =>
  askForJson({
    name: 'proposal-themes',
    instructions: 'Report the themes.',
    prompt: 'Here is the corpus.',
    schema: {
      safeParse: (value: unknown) => ({ success: true as const, data: value }),
    } as never,
  });

describe('the model call as it goes over the wire', () => {
  it('sends our output cap rather than leaving it to the endpoint', async () => {
    requestBodies = [];
    reply = '{"themes": []}';

    await ask();

    const [body] = requestBodies;

    // A cap we set that never leaves the process is not a cap. This is the
    // only check that the option name we pass is one Mastra forwards rather
    // than one it quietly drops.
    expect(body?.max_tokens).toBe(THEME_ANALYSIS_MAX_OUTPUT_TOKENS);
    expect(body?.model).toBe(THEME_ANALYSIS_MODEL_ID);
  });

  // Provider-specific fields are routed by provider name and dropped in silence
  // when the name does not match — and a camelCase key is dropped even when it
  // does. Neither failure is visible from the call site, and both leave the
  // model thinking exactly as much as before.
  it('sends the thinking-off field the model family understands', async () => {
    requestBodies = [];
    reply = '{"themes": []}';

    await ask();

    expect(requestBodies[0]).toMatchObject({
      thinking: THEME_ANALYSIS_THINKING_OFF.thinking,
    });
  });

  // Logged numbers that are always undefined are worse than no numbers: they
  // read as "the model reported nothing" rather than "we asked wrongly". This
  // is the only check that the usage fields survive the trip from the provider
  // response to our log line.
  it("carries the provider's token usage through to the log", async () => {
    requestBodies = [];
    reply = '{"themes": []}';

    await ask();

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      'Theme analysis pass answered',
      expect.objectContaining({
        // What the stub reports as completion_tokens / total_tokens.
        outputTokens: 1,
        totalTokens: 2,
      }),
    );
  });

  // The failure this whole change is about: a thinking model that narrates
  // before it answers, in prose full of braces.
  it('parses a reply that reasons about JSON before writing it', async () => {
    requestBodies = [];
    reply =
      '<think>They want {"themes": [...]}, so I will list one.</think>\n' +
      '```json\n{"themes": [{"title": "Street space"}]}\n```\n' +
      'Let me know if {anything} needs changing.';

    await expect(ask()).resolves.toEqual({
      themes: [{ title: 'Street space' }],
    });
  });
});

describe('an abort against the real SDK', () => {
  // The behaviour our whole timeout path depends on, and the reason a pass that
  // ran out of time was reported as unusable JSON. Mastra does NOT reject when
  // the abort signal fires: it resolves with empty text and a 'tripwire' finish
  // reason. Code that only inspects the catch block therefore sees a model that
  // answered with nothing, and says so.
  //
  // Pinned here because it is a third-party behaviour we rely on and cannot
  // detect changing. If Mastra starts throwing, this fails and the success-path
  // check in `generateWithin` becomes dead code that should be removed.
  it('resolves empty with a tripwire finish reason instead of throwing', async () => {
    hang = true;

    const agent = createAIAgent({
      name: 'abort-probe',
      instructions: 'Answer in JSON.',
      model: { modelId: THEME_ANALYSIS_MODEL_ID },
    });

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 200);

    const outcome = await agent
      .generate('Hello', { abortSignal: controller.signal })
      .then((value) => ({
        threw: false,
        text: value.text,
        finishReason: value.finishReason,
      }))
      .catch(() => ({ threw: true, text: undefined, finishReason: undefined }));

    hang = false;

    expect(outcome).toEqual({
      threw: false,
      text: '',
      finishReason: 'tripwire',
    });
  }, 30_000);
});
