'use client';

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
  const t = useTranslations();
  const messageId = useId();

  return (
    <div className="flex flex-col gap-6">
      <p>{t('Invite new organizations onto Common.')}</p>

      <div className="flex flex-col gap-4">
        <EmailInviteField
          emails={emails}
          setEmails={setEmails}
          emailBadges={emailBadges}
          setEmailBadges={setEmailBadges}
          fallbackDomain="solidarityseeds.org"
          description={t('Separate multiple emails with commas or line breaks')}
        />

        <Field>
          <FieldLabel htmlFor={messageId}>{t('Personal Message')}</FieldLabel>
          <Textarea
            id={messageId}
            value={personalMessage}
            onChange={(e) => setPersonalMessage(e.target.value)}
            placeholder={t('Add a personal note to your invitation')}
            rows={3}
          />
        </Field>
      </div>
    </div>
  );
};
