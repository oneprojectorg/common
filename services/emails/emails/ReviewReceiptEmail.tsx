import { Section, Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';
import { Header } from '../components/Header';

/**
 * One resolved rubric criterion, already translated to readable labels by
 * `resolveSubmittedReview` in `@op/common` — this template never sees raw
 * option ids or rubric schemas.
 */
export interface ReviewReceiptItem {
  key: string;
  title?: string;
  /** Readable answer, e.g. `4`, `Maybe`, `Yes`. */
  valueLabel?: string;
  /** Option description, score label, or text answer accompanying the value. */
  valueDescription?: string;
  /** Set for scored criteria only; renders the answer as `4 / 5`. */
  maxPoints?: number;
  rationale?: string;
}

const formatDay = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

/**
 * A receipt records a moment, never an action: a debounced burst can deliver
 * either triggering event last, so the body must not word itself as
 * "submitted" or "updated" — the timestamps carry the meaning. The
 * "Last changed" line appears only when the rendered day of `updatedAt`
 * differs from that of `submittedAt`; a strict `>` would show a spurious line
 * on a plain submit because `submittedAt` comes from the app clock while
 * `updatedAt` comes from the DB clock.
 */
export const ReviewReceiptEmail = ({
  processTitle,
  proposalTitle,
  submittedAt,
  updatedAt,
  items,
  feedbackToAuthor,
  reviewUrl = 'https://common.oneproject.org/',
}: {
  processTitle?: string | null;
  proposalTitle: string;
  submittedAt: string;
  updatedAt?: string | null;
  items: ReviewReceiptItem[];
  feedbackToAuthor?: { title: string; comment: string } | null;
  reviewUrl: string;
}) => {
  const submittedDay = formatDay(submittedAt);
  const lastChangedDay = updatedAt ? formatDay(updatedAt) : null;
  const showLastChanged =
    lastChangedDay !== null && lastChangedDay !== submittedDay;

  return (
    <EmailTemplate previewText={`Your review of "${proposalTitle}"`}>
      <Header>Your review of &quot;{proposalTitle}&quot;</Header>

      <Section className="my-8">
        {processTitle && (
          <Text className="my-0 text-lg">
            <strong>{processTitle}</strong>
          </Text>
        )}
        <Text className="my-0 text-lg">{proposalTitle}</Text>
        <Text className="mt-4 mb-0 text-base text-[#5A6572]">
          Submitted on {submittedDay}
        </Text>
        {showLastChanged && (
          <Text className="my-0 text-base text-[#5A6572]">
            Last changed on {lastChangedDay}
          </Text>
        )}
      </Section>

      {items.map((item) => (
        <Section
          key={item.key}
          className="mb-6 border-t border-solid border-neutral-200 pt-4"
        >
          {item.title && (
            <Text className="my-0 text-base font-bold">{item.title}</Text>
          )}
          {item.valueLabel && (
            <Text className="mt-2 mb-0 font-serif text-xl text-[#222D38]">
              {item.maxPoints != null
                ? `${item.valueLabel} / ${item.maxPoints}`
                : item.valueLabel}
            </Text>
          )}
          {item.valueDescription && (
            <Text className="mt-1 mb-0 text-sm text-[#5A6572]">
              {item.valueDescription}
            </Text>
          )}
          {item.rationale && (
            <Text className="mt-2 mb-0 text-base">
              &quot;{item.rationale}&quot;
            </Text>
          )}
        </Section>
      ))}

      {feedbackToAuthor && (
        <Section className="mb-6 border-t border-solid border-neutral-200 pt-4">
          <Text className="my-0 text-base font-bold">
            {feedbackToAuthor.title}
          </Text>
          <Text className="mt-2 mb-0 text-base">
            &quot;{feedbackToAuthor.comment}&quot;
          </Text>
        </Section>
      )}

      <CtaButton href={reviewUrl}>View your review</CtaButton>

      <Footnote>
        You&apos;re receiving this because you reviewed this proposal.
      </Footnote>
    </EmailTemplate>
  );
};

ReviewReceiptEmail.subject = (proposalTitle: string) =>
  `Your review of "${proposalTitle}"`;

ReviewReceiptEmail.PreviewProps = {
  processTitle: 'Participatory Budgeting 2026',
  proposalTitle: 'Riverside Community Garden',
  submittedAt: '2026-08-12T14:00:00.000Z',
  updatedAt: '2026-08-14T09:30:00.000Z',
  items: [
    {
      key: 'feasibility',
      title: 'Feasibility',
      valueLabel: '4',
      valueDescription: 'Strong',
      maxPoints: 5,
      rationale: 'The irrigation budget looks thin for a site this size.',
    },
    {
      key: 'overall_recommendation',
      title: 'Overall recommendation',
      valueLabel: 'Maybe',
    },
  ],
  feedbackToAuthor: {
    title: 'Feedback to Author',
    comment: 'Strong community backing, but the budget needs another pass.',
  },
  reviewUrl: 'https://common.oneproject.org/',
} satisfies Parameters<typeof ReviewReceiptEmail>[0];

export default ReviewReceiptEmail;
