import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';

export const CategoryDevelopmentConfirmedAdminEmail = ({
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
        All reviewers of <strong>{categoryName}</strong> confirmed their
        selections. {formatAdvancingSentence(advancingCount)} You can open the
        category now.
      </Text>

      <CtaButton href={processUrl}>Open {processName}</CtaButton>
    </EmailTemplate>
  );
};

CategoryDevelopmentConfirmedAdminEmail.subject = (
  categoryName: string,
  processName: string,
) => `${categoryName} is confirmed in ${processName}`;

CategoryDevelopmentConfirmedAdminEmail.PreviewProps = {
  categoryName: 'Parks and Recreation',
  processName: 'Participatory Budgeting 2026',
  advancingCount: 4,
  processUrl: 'https://common.oneproject.org/',
} satisfies Parameters<typeof CategoryDevelopmentConfirmedAdminEmail>[0];

export default CategoryDevelopmentConfirmedAdminEmail;

function formatAdvancingSentence(advancingCount: number): string {
  return advancingCount === 1
    ? '1 proposal advances.'
    : `${advancingCount} proposals advance.`;
}
