import { relationshipMap } from '@op/types';
import { Section, Text } from 'react-email';

import { CtaButton } from '../components/CtaButton';
import EmailTemplate from '../components/EmailTemplate';
import { Footnote } from '../components/Footnote';

interface OPRelationshipRequestEmailProps {
  requesterOrgName: string;
  targetOrgName: string;
  relationshipTypes: string[];
  approvalUrl: string;
  requesterMessage?: string;
}

export const OPRelationshipRequestEmail = ({
  requesterOrgName,
  targetOrgName,
  relationshipTypes,
  approvalUrl,
  requesterMessage,
}: OPRelationshipRequestEmailProps) => {
  const relationshipLabels = relationshipTypes.map(
    (type) => relationshipMap[type]?.noun || type,
  );
  const relationshipText =
    relationshipLabels.length === 1
      ? relationshipLabels[0]
      : relationshipLabels.join('/');

  return (
    <EmailTemplate
      previewText={`Action Required: Accept request for ${requesterOrgName} to add ${targetOrgName} as a/an ${relationshipText} on Common`}
    >
      <Text className="my-8 text-lg">
        <strong>{requesterOrgName}</strong> is waiting for your approval to add{' '}
        <strong>{targetOrgName}</strong> as a{' '}
        <strong>{relationshipText}</strong> on Common.
      </Text>

      {requesterMessage && (
        <Section className="my-6 rounded-lg bg-gray-50 p-4">
          <Text className="mb-2 text-sm font-medium text-gray-700">
            Message from {requesterOrgName}:
          </Text>
          <Text className="text-sm text-gray-600">{requesterMessage}</Text>
        </Section>
      )}

      <CtaButton href={approvalUrl}>Accept now</CtaButton>

      <Footnote>
        Once you accept their request, <strong>{requesterOrgName}</strong> will
        appear in your relationships on Common.
      </Footnote>
    </EmailTemplate>
  );
};

OPRelationshipRequestEmail.subject = `Action Required: Accept request for {{requesterOrgName}} to add {{targetOrgName}} as a/an {{relationshipTypes}} on Common`;

OPRelationshipRequestEmail.PreviewProps = {
  requesterOrgName: 'One Project',
  targetOrgName: 'Community Fund',
  relationshipTypes: ['partner'],
  approvalUrl: 'https://common.oneproject.org/',
  requesterMessage: 'Looking forward to collaborating with your team.',
} satisfies Parameters<typeof OPRelationshipRequestEmail>[0];

export default OPRelationshipRequestEmail;
