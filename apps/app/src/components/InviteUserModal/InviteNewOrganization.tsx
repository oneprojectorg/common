'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { Field, FieldLabel } from '@op/sense/Field';
import { Textarea } from '@op/sense/Textarea';
import { useId } from 'react';

import { useTranslations } from '@/lib/i18n';

import { EmailInviteField } from './EmailInviteField';

interface InviteNewOrganizationProps {
  emails: string;
  setEmails: (emails: string) => void;
  emailBadges: string[];
  setEmailBadges: (badges: string[]) => void;
  personalMessage: string;
  setPersonalMessage: (message: string) => void;
}

export const InviteNewOrganization = ({
  emails,
  setEmails,
  emailBadges,
  setEmailBadges,
  personalMessage,
  setPersonalMessage,
}: InviteNewOrganizationProps) => {
  const t = useTranslations('org');
  const { user } = useRequiredUser();
  const messageId = useId();

  return (
    <div className="flex flex-col gap-6">
      <p>{t('inviteNewOrgSubtitle')}</p>

      <div className="flex flex-col gap-4">
        <EmailInviteField
          emails={emails}
          setEmails={setEmails}
          emailBadges={emailBadges}
          setEmailBadges={setEmailBadges}
          // No target org on this tab — invitees are new organizations.
          domain={user.currentOrganization?.domain || 'solidarityseeds.org'}
          description={t('inviteEmailsHint')}
        />

        <Field>
          <FieldLabel htmlFor={messageId}>
            {t('invitePersonalMessageLabel')}
          </FieldLabel>
          <Textarea
            id={messageId}
            value={personalMessage}
            onChange={(e) => setPersonalMessage(e.target.value)}
            placeholder={t('invitePersonalMessagePlaceholder')}
            rows={3}
          />
        </Field>
      </div>
    </div>
  );
};
