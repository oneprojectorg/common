import { describe, expect, it } from 'vitest';

import {
  formatResultAmount,
  renderResultNotificationMessage,
  selectResultNotificationTemplate,
} from './resultNotificationTemplate';

const values = {
  name: 'Ada',
  proposal: 'Community Garden Revamp',
  amount: '$12,000',
};

describe('renderResultNotificationMessage', () => {
  it('substitutes every supported token', () => {
    expect(
      renderResultNotificationMessage({
        template: 'Hi {{name}},\n\n"{{proposal}}" has an outcome.\n\nThanks.',
        values,
      }),
    ).toBe('Hi Ada,\n\n"Community Garden Revamp" has an outcome.\n\nThanks.');
  });

  it('does not re-expand a token that appears inside a substituted value', () => {
    expect(
      renderResultNotificationMessage({
        template: 'Hi {{name}}, about {{proposal}}.',
        values: { ...values, proposal: '{{name}} is not the author' },
      }),
    ).toBe('Hi Ada, about {{name}} is not the author.');
  });

  it('leaves an unknown placeholder exactly as typed', () => {
    expect(
      renderResultNotificationMessage({
        template: 'Hi {{Name}} / {{ name }} / {{proposal_title}}.',
        values,
      }),
    ).toBe('Hi {{Name}} / {{ name }} / {{proposal_title}}.');
  });

  // `amount` is off the token list until something writes an allocation, so a
  // message mentioning it must render literally rather than resolve to ''.
  it('leaves {{amount}} untouched while it is not an offered token', () => {
    expect(
      renderResultNotificationMessage({
        template: 'You were allocated {{amount}}.',
        values,
      }),
    ).toBe('You were allocated {{amount}}.');
  });
});

describe('formatResultAmount', () => {
  it('formats the allocated figure in the proposal budget’s currency', () => {
    expect(
      formatResultAmount({
        allocated: '8000',
        budget: { amount: 12000, currency: 'EUR' },
      }),
    ).toBe('€8,000');
  });

  // The regression that matters: falling back to the budget would tell every
  // funded author they were awarded exactly what they asked for.
  it('never falls back to the requested budget when nothing was allocated', () => {
    expect(
      formatResultAmount({
        allocated: null,
        budget: { amount: 4500, currency: 'EUR' },
      }),
    ).toBe('');
  });

  it('returns empty when the allocation is unparseable', () => {
    expect(formatResultAmount({ allocated: 'not-a-number', budget: {} })).toBe(
      '',
    );
  });

  it('falls back to USD when the stored currency is not a real code', () => {
    expect(
      formatResultAmount({
        allocated: '100',
        budget: { amount: 100, currency: 'NOTACODE' },
      }),
    ).toBe('$100');
  });
});

describe('selectResultNotificationTemplate', () => {
  const messages = { funded: 'You were funded', notFunded: 'Not this round' };

  it.each([
    ['funded', 'You were funded'],
    ['notFunded', 'Not this round'],
  ] as const)('pairs %s with its own copy', (outcome, expected) => {
    expect(selectResultNotificationTemplate({ messages, outcome })).toBe(
      expected,
    );
  });
});
