import { describe, expect, it } from 'vitest';

import {
  itemKindFor,
  itemRoleFor,
  messageText,
  storedModelMessageSchema,
} from './modelMessage';

describe('storedModelMessageSchema', () => {
  it('round-trips a plain user message', () => {
    const message = { role: 'user', content: 'L how do I vote?' };
    expect(storedModelMessageSchema.parse(message)).toEqual(message);
  });

  it('round-trips an assistant message with tool-call parts and keeps extra fields', () => {
    const message = {
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'add_picks',
          input: { codes: [101] },
        },
      ],
    };
    expect(storedModelMessageSchema.parse(message)).toEqual(message);
  });

  it('round-trips a tool result message', () => {
    const message = {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'add_picks',
          output: { type: 'json', value: { added: [101] } },
        },
      ],
    };
    expect(storedModelMessageSchema.parse(message)).toEqual(message);
  });

  it('rejects a payload without a role', () => {
    expect(
      storedModelMessageSchema.safeParse({ content: 'hello' }).success,
    ).toBe(false);
  });
});

describe('itemKindFor and itemRoleFor', () => {
  it('classifies a text assistant message as a message item', () => {
    const message = storedModelMessageSchema.parse({
      role: 'assistant',
      content: [{ type: 'text', text: 'Pick 101 added.' }],
    });
    expect(itemKindFor(message)).toBe('message');
    expect(itemRoleFor(message)).toBe('assistant');
  });

  it('classifies an assistant tool call as a tool_call item without a role', () => {
    const message = storedModelMessageSchema.parse({
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'c',
          toolName: 'get_ballot',
          input: {},
        },
      ],
    });
    expect(itemKindFor(message)).toBe('tool_call');
    expect(itemRoleFor(message)).toBeNull();
  });

  it('classifies a tool message as a tool_output item', () => {
    const message = storedModelMessageSchema.parse({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'c',
          toolName: 'get_ballot',
          output: {},
        },
      ],
    });
    expect(itemKindFor(message)).toBe('tool_output');
    expect(itemRoleFor(message)).toBeNull();
  });
});

describe('messageText', () => {
  it('returns string content as it is', () => {
    expect(
      messageText(
        storedModelMessageSchema.parse({ role: 'user', content: 'hi' }),
      ),
    ).toBe('hi');
  });

  it('joins the text parts and skips the rest', () => {
    const message = storedModelMessageSchema.parse({
      role: 'assistant',
      content: [
        { type: 'text', text: 'Added 101. ' },
        { type: 'tool-call', toolCallId: 'c', toolName: 'x', input: {} },
        { type: 'text', text: 'Budget left: $40.' },
      ],
    });
    expect(messageText(message)).toBe('Added 101. Budget left: $40.');
  });
});
