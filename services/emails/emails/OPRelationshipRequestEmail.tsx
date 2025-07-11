import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';

import EmailTemplate from '../components/EmailTemplate';
import { Header } from '../components/Header';

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
  const relationshipText = relationshipTypes.length === 1 
    ? `a ${relationshipTypes[0]} relationship`
    : `${relationshipTypes.length} relationships (${relationshipTypes.join(', ')})`;

  return (
    <EmailTemplate
      previewText={`${requesterOrgName} wants to establish ${relationshipText} with ${targetOrgName}`}
    >
      <Header className="!my-0 mx-0 mt-2 p-0 text-left font-serif text-[28px] font-light tracking-[-0.02625rem] text-[#222D38]">
        New Relationship Request
      </Header>
      
      <Text className="my-8 text-lg">
        <strong>{requesterOrgName}</strong> wants to establish {relationshipText} with <strong>{targetOrgName}</strong>.
      </Text>

      {requesterMessage && (
        <Section className="my-6 rounded-lg bg-gray-50 p-4">
          <Text className="mb-2 text-sm font-medium text-gray-700">Message from {requesterOrgName}:</Text>
          <Text className="text-sm text-gray-600">{requesterMessage}</Text>
        </Section>
      )}

      <Section className="pb-0">
        <Button
          href={approvalUrl}
          className="rounded-lg bg-[#0396A6] px-4 py-3 text-white no-underline hover:bg-[#0396A6]/90"
          style={{
            fontSize: '0.875rem',
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          Review Request
        </Button>
      </Section>

      <Text className="mb-0 text-xs text-[#606A6C]">
        You can approve or decline this request from your organization dashboard.
      </Text>
    </EmailTemplate>
  );
};

OPRelationshipRequestEmail.subject = `New relationship request from {{requesterOrgName}}`;

export default OPRelationshipRequestEmail;