'use client';

import { useUser } from '@/utils/UserProvider';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import { toast } from '@op/ui/Toast';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

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

  const addEmailBadge = (email: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    if (!isValidEmail(trimmedEmail)) {
      toast.error({
        title: t('Invalid email'),
        message: `"${trimmedEmail}" ${t('is not a valid email address')}`,
      });
      return;
    }

    setEmailBadges([...emailBadges, trimmedEmail]);
  };

  const removeEmailBadge = (emailToRemove: string) => {
    setEmailBadges(emailBadges.filter((email) => email !== emailToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      if (emails.trim()) {
        addEmailBadge(emails.trim());
        setEmails('');
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <p>{t('Invite new organizations onto Common.')}</p>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">{t('Send to')}</label>
          <div className="flex min-h-[80px] flex-wrap gap-2 rounded-md border border-gray-300 p-2">
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
                  ? `name1@${user?.currentOrganization?.domain || 'solidarityseeds.org'}, name2@${user?.currentOrganization?.domain || 'solidarityseeds.org'}, ...`
                  : t('Type emails followed by a comma...')
              }
              className="min-w-[200px] flex-1 resize-none border-none pt-1 outline-none"
              rows={1}
            />
          </div>
          <p className="text-sm text-gray-500">
            {t('Separate multiple emails with commas')}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">{t('Personal Message')}</label>
          <textarea
            value={personalMessage}
            onChange={(e) => setPersonalMessage(e.target.value)}
            placeholder={t('Add a personal note to your invitation')}
            className="min-h-[80px] rounded-md border border-gray-300 p-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            rows={3}
          />
        </div>
      </div>
    </div>
  );
};
