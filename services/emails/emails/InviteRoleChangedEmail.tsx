import { Text } from '@react-email/components';

import EmailTemplate from '../components/EmailTemplate';
import { Header } from '../components/Header';

interface InviteRoleChangedEmailProps {
  profileName: string;
  newRoleName: string;
}

export const InviteRoleChangedEmail = ({
  profileName,
  newRoleName,
}: InviteRoleChangedEmailProps) => {
  return (
    <EmailTemplate
      previewText={`Your role for ${profileName} has been updated to ${newRoleName}`}
    >
      <Header className="mx-0 !my-0 mt-2 p-0 text-left font-serif text-[28px] font-light tracking-[-0.02625rem] text-[#222D38]">
        Your invite role has been updated
      </Header>
      <Text className="my-8 text-lg">
        Your pending invite to <strong>{profileName}</strong> has been updated.
        Your new role is <strong>{newRoleName}</strong>.
      </Text>
    </EmailTemplate>
  );
};

export default InviteRoleChangedEmail;
