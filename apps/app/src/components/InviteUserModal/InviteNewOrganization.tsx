'use client';

import { useUser } from '@/utils/UserProvider';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import { toast } from '@op/ui/Toast';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { parseEmails, shouldParseEmails } from './emailUtils';

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
  const { user } = useUser();

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const removeEmailBadge = (emailToRemove: string) => {
    setEmailBadges(emailBadges.filter((email) => email !== emailToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (shouldParseEmails(e.key)) {
      e.preventDefault();
      if (emails.trim()) {
        const { emails: parsedEmails, hasLineBreaks } = parseEmails(emails);
        const validEmails: string[] = [];
        const invalidEmails: string[] = [];
        const duplicateEmails: string[] = [];

        parsedEmails.forEach((email) => {
          if (!isValidEmail(email)) {
            invalidEmails.push(email);
          } else if (emailBadges.includes(email)) {
            duplicateEmails.push(email);
          } else {
            validEmails.push(email);
          }
        });

        // Add valid emails as badges in a single state update
        if (validEmails.length > 0) {
          setEmailBadges([...emailBadges, ...validEmails]);
        }

        // Keep invalid emails in the input field, preserving original separator format
        const separator = hasLineBreaks ? '\n' : ', ';
        setEmails(invalidEmails.join(separator));

        // Show error for invalid emails if any
        if (invalidEmails.length > 0) {
          toast.error({
            title:
              invalidEmails.length === 1
                ? t('Invalid email')
                : t('Invalid emails'),
            message: `"${invalidEmails.join('", "')}" ${invalidEmails.length === 1 ? t('is not a valid email address') : t('are not valid email addresses')}`,
          });
        }

        // Show info for duplicate emails if any
        if (duplicateEmails.length > 0) {
          toast.error({
            title:
              duplicateEmails.length === 1
                ? t('Duplicate email')
                : t('Duplicate emails'),
            message: `"${duplicateEmails.join('", "')}" ${duplicateEmails.length === 1 ? t('has already been added') : t('have already been added')}`,
          });
        }
      }
    }
  };

  return (
    <div className="gap-6 flex flex-col">
      <p>{t('Invite new organizations onto Common.')}</p>

      <div className="gap-4 flex flex-col">
        <div className="gap-2 flex flex-col">
          <label className="font-medium text-sm">{t('Send to')}</label>
          <div className="gap-2 p-2 flex min-h-[80px] flex-wrap rounded-md border border-neutral-gray2">
            <TagGroup>
              {emailBadges.map((email, index) => (
                <Tag className="sm:rounded-sm" key={index}>
                  {email}
                  <button onClick={() => removeEmailBadge(email)}>
                    <LuX className="size-3" />
                  </button>
                </Tag>
              ))}
            </TagGroup>
            <textarea
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                emailBadges.length === 0
                  ? `name1@${user.currentOrganization?.domain || 'solidarityseeds.org'}, name2@${user.currentOrganization?.domain || 'solidarityseeds.org'}, ...`
                  : t('Type emails followed by a comma or line break...')
              }
              className="pt-1 min-w-[200px] flex-1 resize-none border-none outline-hidden"
              rows={1}
            />
          </div>
          <p className="text-gray-500 text-sm">
            {t('Separate multiple emails with commas or line breaks')}
          </p>
        </div>

        <div className="gap-2 flex flex-col">
          <label className="font-medium text-sm">{t('Personal Message')}</label>
          <textarea
            value={personalMessage}
            onChange={(e) => setPersonalMessage(e.target.value)}
            placeholder={t('Add a personal note to your invitation')}
            className="p-2 min-h-[80px] rounded-md border border-neutral-gray2 outline-hidden focus:border-primary-teal focus:ring-1 focus:ring-primary-teal"
            rows={3}
          />
        </div>
      </div>
    </div>
  );
};
