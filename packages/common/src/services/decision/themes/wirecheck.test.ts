import { createServer } from 'node:http';
import type { AddressInfo, Server } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@op/logging', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { askForJson } from './askForJson';
import {
  THEME_ANALYSIS_MAX_OUTPUT_TOKENS,
  THEME_ANALYSIS_MODEL_ID,
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

beforeAll(async () => {
  server = createServer((request, response) => {
    let raw = '';

    request.on('data', (chunk) => {
      raw += chunk;
    });

    request.on('end', () => {
      requestBodies.push(JSON.parse(raw));

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
