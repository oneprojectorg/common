import type { ConversationItemKind, ConversationItemRole } from '@op/db/schema';
import { z } from 'zod';

const partSchema = z.looseObject({ type: z.string() });

const contentSchema = z.union([z.string(), z.array(partSchema)]);

export const storedModelMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'tool']),
  content: contentSchema,
});

export type StoredModelMessage = z.infer<typeof storedModelMessageSchema>;

export type ReplayMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string };

export const messageText = (message: StoredModelMessage): string =>
  typeof message.content === 'string'
    ? message.content
    : message.content
        .map((part) =>
          'text' in part && typeof part.text === 'string' ? part.text : '',
        )
        .join('');

export const itemKindFor = (
  message: StoredModelMessage,
): ConversationItemKind => {
  if (message.role === 'tool') {
    return 'tool_output';
  }
  if (
    message.role === 'assistant' &&
    Array.isArray(message.content) &&
    message.content.some((part) => part.type === 'tool-call')
  ) {
    return 'tool_call';
  }
  return 'message';
};

export const itemRoleFor = (
  message: StoredModelMessage,
): ConversationItemRole | null =>
  itemKindFor(message) === 'message' && message.role !== 'tool'
    ? message.role
    : null;
