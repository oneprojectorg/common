import { describe, expect, it } from 'vitest';

import { renderMessageTemplate } from './messageTemplate';

const tokens = ['firstName', 'proposalsLeft'] as const;

describe('renderMessageTemplate', () => {
  it('replaces every listed token, also when a token occurs twice', () => {
    expect(
      renderMessageTemplate({
        template:
          'Hi {{firstName}}, {{proposalsLeft}} left. Bye {{firstName}}.',
        tokens,
        values: { firstName: 'Ada', proposalsLeft: '3 proposals' },
      }),
    ).toBe('Hi Ada, 3 proposals left. Bye Ada.');
  });

  it('does not expand a token that a value contains', () => {
    expect(
      renderMessageTemplate({
        template: 'Hi {{firstName}}, {{proposalsLeft}} left.',
        tokens,
        values: { firstName: '{{proposalsLeft}}', proposalsLeft: '1 proposal' },
      }),
    ).toBe('Hi {{proposalsLeft}}, 1 proposal left.');
  });

  it('keeps an unknown or malformed placeholder as typed', () => {
    expect(
      renderMessageTemplate({
        template: '{{FirstName}} {{ firstName }} {{lastName}} {firstName}',
        tokens,
        values: { firstName: 'Ada', proposalsLeft: '1 proposal' },
      }),
    ).toBe('{{FirstName}} {{ firstName }} {{lastName}} {firstName}');
  });

  it('keeps markup in the template and in the values as plain text', () => {
    expect(
      renderMessageTemplate({
        template: '<b>{{firstName}}</b>',
        tokens,
        values: { firstName: '<script>x</script>', proposalsLeft: '' },
      }),
    ).toBe('<b><script>x</script></b>');
  });

  it('returns the template unchanged when there are no tokens', () => {
    expect(
      renderMessageTemplate({
        template: 'Hi {{firstName}}',
        tokens: [],
        values: {},
      }),
    ).toBe('Hi {{firstName}}');
  });
});
