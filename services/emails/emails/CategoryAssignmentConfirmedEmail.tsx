import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';

export const CategoryAssignmentConfirmedEmail = ({
  categoryName,
  processName,
  confirmedCount,
  assignmentCount,
  processUrl,
}: {
  categoryName: string;
  processName: string;
  confirmedCount: number;
  assignmentCount: number;
  processUrl: string;
}) => {
  return (
    <EmailTemplate
      previewText={CategoryAssignmentConfirmedEmail.subject(categoryName)}
    >
      <Text className="my-8 text-lg">
        Your selections for{' '}
        <strong>
          <bdi>{categoryName}</bdi>
        </strong>{' '}
        in <bdi>{processName}</bdi> were confirmed.{' '}
        {formatConfirmedSentence({ confirmedCount, assignmentCount })} This
        message is a record of the confirm.
      </Text>

      <CtaButton href={processUrl}>
        Open <bdi>{processName}</bdi>
      </CtaButton>
    </EmailTemplate>
  );
};

CategoryAssignmentConfirmedEmail.subject = (categoryName: string) =>
  `Your selections for ${categoryName} are confirmed`;

CategoryAssignmentConfirmedEmail.PreviewProps = {
  categoryName: 'Parks and Recreation',
  processName: 'Participatory Budgeting 2026',
  confirmedCount: 1,
  assignmentCount: 2,
  processUrl: 'https://common.oneproject.org/',
} satisfies Parameters<typeof CategoryAssignmentConfirmedEmail>[0];

export default CategoryAssignmentConfirmedEmail;

function formatConfirmedSentence({
  confirmedCount,
  assignmentCount,
}: {
  confirmedCount: number;
  assignmentCount: number;
}): string {
  return assignmentCount === 1
    ? `${confirmedCount} of 1 person has confirmed this category.`
    : `${confirmedCount} of ${assignmentCount} people have confirmed this category.`;
}
