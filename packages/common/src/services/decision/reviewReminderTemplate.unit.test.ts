import { describe, expect, it } from 'vitest';

import {
  getReviewerFirstName,
  renderReviewReminderMessage,
} from './reviewReminderTemplate';

describe('getReviewerFirstName', () => {
  it('takes the first whitespace-separated word', () => {
    expect(getReviewerFirstName('  Ada   King Lovelace ')).toBe('Ada');
  });

  it('is empty when the name has no word', () => {
    expect(getReviewerFirstName('   ')).toBe('');
  });
});

describe('renderReviewReminderMessage', () => {
  it('fills the first name and the singular or plural count', () => {
    const template = 'Hi {{firstName}}, {{proposalsLeft}} left.';

    expect(
      renderReviewReminderMessage({
        template,
        firstName: 'Ada',
        remainingCount: 1,
      }),
    ).toBe('Hi Ada, 1 proposal left.');
    expect(
      renderReviewReminderMessage({
        template,
        firstName: 'Ada',
        remainingCount: 4,
      }),
    ).toBe('Hi Ada, 4 proposals left.');
  });
});
