import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';

export const CategoryDevelopmentConfirmedReviewerEmail = ({
  categoryName,
  processName,
  advancingCount,
  processUrl,
}: {
  categoryName: string;
  processName: string;
  advancingCount: number;
  processUrl: string;
}) => {
  return (
    <EmailTemplate
      previewText={`${categoryName} is confirmed in ${processName}`}
    >
      <Text className="my-8 text-lg">
        The selections for <strong>{categoryName}</strong> in{' '}
        <strong>{processName}</strong> are confirmed.{' '}
        {formatAdvancingSentence(advancingCount)} This message is a record of
        the confirm. You do not need to do anything.
      </Text>

      <CtaButton href={processUrl}>Open {processName}</CtaButton>
    </EmailTemplate>
  );
};

CategoryDevelopmentConfirmedReviewerEmail.subject = (
  categoryName: string,
  processName: string,
) => `${categoryName} is confirmed in ${processName}`;

CategoryDevelopmentConfirmedReviewerEmail.PreviewProps = {
  categoryName: 'Parks and Recreation',
  processName: 'Participatory Budgeting 2026',
  advancingCount: 1,
  processUrl: 'https://common.oneproject.org/',
} satisfies Parameters<typeof CategoryDevelopmentConfirmedReviewerEmail>[0];

export default CategoryDevelopmentConfirmedReviewerEmail;

function formatAdvancingSentence(advancingCount: number): string {
  return advancingCount === 1
    ? '1 proposal advances.'
    : `${advancingCount} proposals advance.`;
}
