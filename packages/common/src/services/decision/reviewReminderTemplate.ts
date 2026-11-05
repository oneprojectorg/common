import { renderMessageTemplate } from '../../utils/messageTemplate';

export const REVIEW_REMINDER_TOKENS = ['firstName', 'proposalsLeft'] as const;

export type ReviewReminderToken = (typeof REVIEW_REMINDER_TOKENS)[number];

export const REVIEW_REMINDER_MESSAGE_MAX_LENGTH = 4000;

export const REVIEW_REMINDER_MAX_RECIPIENTS = 1000;

export function getReviewerFirstName(name: string): string {
  const trimmed = name.trim();
  const [firstWord] = trimmed.split(/\s+/);

  return firstWord || trimmed;
}

export function formatProposalsLeft(remainingCount: number): string {
  return remainingCount === 1 ? '1 proposal' : `${remainingCount} proposals`;
}

export function renderReviewReminderMessage({
  template,
  firstName,
  remainingCount,
}: {
  template: string;
  firstName: string;
  remainingCount: number;
}): string {
  return renderMessageTemplate({
    template,
    tokens: REVIEW_REMINDER_TOKENS,
    values: { firstName, proposalsLeft: formatProposalsLeft(remainingCount) },
  });
}
