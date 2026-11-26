import { Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';

export const CategoryAssignmentUnconfirmedEmail = ({
  categoryName,
  processName,
  processUrl,
}: {
  categoryName: string;
  processName: string;
  processUrl: string;
}) => {
  return (
    <EmailTemplate
      previewText={CategoryAssignmentUnconfirmedEmail.subject(categoryName)}
    >
      <Text className="my-8 text-lg">
        Your selections for{' '}
        <strong>
          <bdi>{categoryName}</bdi>
        </strong>{' '}
        in <bdi>{processName}</bdi> were unconfirmed. You can change them and
        confirm again.
      </Text>

      <CtaButton href={processUrl}>
        Open <bdi>{processName}</bdi>
      </CtaButton>
    </EmailTemplate>
  );
};

CategoryAssignmentUnconfirmedEmail.subject = (categoryName: string) =>
  `Your selections for ${categoryName} are no longer confirmed`;

CategoryAssignmentUnconfirmedEmail.PreviewProps = {
  categoryName: 'Parks and Recreation',
  processName: 'Participatory Budgeting 2026',
  processUrl: 'https://common.oneproject.org/',
} satisfies Parameters<typeof CategoryAssignmentUnconfirmedEmail>[0];

export default CategoryAssignmentUnconfirmedEmail;
