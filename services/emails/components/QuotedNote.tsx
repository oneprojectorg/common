import { Section, Text } from 'react-email';

/**
 * A short passage quoted from someone, set apart from the surrounding copy.
 * The attribution line is dropped rather than faked when the author is unknown.
 */
export const QuotedNote = ({
  children,
  authorName,
}: {
  children: string;
  authorName?: string | null;
}) => (
  <Section className="border-neutral-gray1 my-8 rounded-lg border border-solid bg-neutral-50 px-6 py-2">
    <Text className="text-neutral-charcoal my-2 text-lg italic">
      {children}
    </Text>
    {authorName ? (
      <Text className="text-neutral-gray4 my-2 text-sm">{authorName}</Text>
    ) : null}
  </Section>
);
