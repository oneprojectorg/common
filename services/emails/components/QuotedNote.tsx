import { Section, Text } from 'react-email';

export const QuotedNote = ({
  children,
  authorName,
}: {
  children: string;
  authorName?: string | null;
}) => (
  <Section className="border-neutral-gray1 my-8 rounded-lg border border-solid bg-neutral-50 px-6 py-2">
    {/* The note comes from a textarea; keep its paragraph breaks. */}
    <Text className="text-neutral-charcoal my-2 text-lg whitespace-pre-line italic">
      {children}
    </Text>
    {authorName ? (
      <Text className="text-neutral-gray4 my-2 text-sm">{authorName}</Text>
    ) : null}
  </Section>
);
