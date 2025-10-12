import { createAnthropic } from '@ai-sdk/anthropic';
import { TRPCError } from '@trpc/server';
import { convertToCoreMessages, smoothStream, streamText } from 'ai';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import { loggedProcedure, router } from '../../trpcFactory';

const endpoint = 'chat';

const meta: OpenApiMeta = {
  openapi: {
    enabled: false,
    method: 'GET',
    path: `/llm/${endpoint}`,
    protect: true,
    tags: ['llm'],
    summary: 'Test iterables',
  },
};

const providerSchema = z.object({
  vendor: z.literal('anthropic'),
  // model: AnthropicModelsEnum.default('claude-3-5-sonnet-20240620'),
  model: z.string().prefault('claude-3-7-sonnet-latest'),
});

const chat = router({
  chat: loggedProcedure
    // Middlewares
    .use(withAuthenticated)
    .use(withAnalytics)
    // Router
    .meta(meta)
    .input(
      z.object({
        provider: providerSchema,
        apiKey: z.string(),
        messages: z.array(
          z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string(),
          }),
        ),
        system: z.string().optional(),
        temperature: z.number().optional(),
        topK: z.number().optional(),
        topP: z.number().optional(),
        maxTokens: z.number().optional(),
        stopSequences: z.array(z.string()).optional(),
        seed: z.number().optional(),
        frequencyPenalty: z.number().optional(),
        presencePenalty: z.number().optional(),
      }),
    )
    // .output(z.any() as unknown as typeof t)
    .mutation(async ({ input }) => {
      const { apiKey, provider } = input;
      const initialMessages = input.messages
        .slice(0, -1)
        .filter((message) => message.content && message.content !== '');
      const currentMessage = input.messages[input.messages.length - 1];

      if (
        !currentMessage ||
        !currentMessage.content ||
        currentMessage.content === ''
      ) {
        throw new TRPCError({
          message: `currentMessage is undefined`,
          code: 'INTERNAL_SERVER_ERROR',
        });
      }

      const model = createAnthropic({
        apiKey,
      })(provider.model);

      const result = streamText({
        // TODO: there are version mismatches for dep of OpenRouter and ai-sdk
        model,
        messages: [
          ...(input.system
            ? [
                {
                  role: 'system' as const,
                  content: input.system,
                },
              ]
            : []),
          ...convertToCoreMessages(initialMessages),
          {
            role: 'user',
            content: [{ type: 'text', text: currentMessage.content }],
          },
        ],
        temperature: input.temperature,
        topK: input.topK,
        topP: input.topP,
        maxTokens: input.maxTokens,
        stopSequences: input.stopSequences,
        seed: input.seed,
        frequencyPenalty: input.frequencyPenalty,
        presencePenalty: input.presencePenalty,
        experimental_continueSteps: true,
        experimental_transform: smoothStream({
          delayInMs: 5, // optional: defaults to 10ms
          //   chunking: 'word', // optional: defaults to 'word'
        }),
        providerOptions: {
          google: { responseModalities: ['TEXT', 'IMAGE'] },
        },
      });

      return result.fullStream;
    }),
});

export default chat;
