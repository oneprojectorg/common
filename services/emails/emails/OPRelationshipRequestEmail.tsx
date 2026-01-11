import { relationshipMap } from '@op/types';
import { Button, Section, Text } from '@react-email/components';

import EmailTemplate from '../components/EmailTemplate';

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

      <Section className="pb-0">
        <Button
          href={approvalUrl}
          className="bg-primary-teal hover:bg-primary-teal/90 rounded-lg px-4 py-3 text-white no-underline"
          style={{
            fontSize: '0.875rem',
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          Accept now
        </Button>
      </Section>

      <Text className="text-neutral-gray4 mb-0 text-xs">
        Once you accept their request, <strong>{requesterOrgName}</strong> will
        appear in your relationships on Common.
      </Text>
    </EmailTemplate>
  );
};

OPRelationshipRequestEmail.subject = `Action Required: Accept request for {{requesterOrgName}} to add {{targetOrgName}} as a/an {{relationshipTypes}} on Common`;

export default OPRelationshipRequestEmail;
