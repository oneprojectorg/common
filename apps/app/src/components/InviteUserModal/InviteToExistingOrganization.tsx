'use client';

import { useUser } from '@/utils/UserProvider';
import { Select, SelectItem } from '@op/ui/Select';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import { toast } from '@op/ui/Toast';
import React from 'react';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

interface InviteToExistingOrganizationProps {
  emails: string;
  setEmails: (emails: string) => void;
  emailBadges: string[];
  setEmailBadges: (badges: string[]) => void;
  selectedRole: string;
  setSelectedRole: (role: string) => void;
  selectedOrganization: string;
  setSelectedOrganization: (orgId: string) => void;
}

export const InviteToExistingOrganization = ({
  emails,
  setEmails,
  emailBadges,
  setEmailBadges,
  selectedRole,
  setSelectedRole,
  selectedOrganization,
  setSelectedOrganization,
}: InviteToExistingOrganizationProps) => {
  const t = useTranslations();
  const { user } = useUser();

  // Ensure first organization is selected if no selection exists
  React.useEffect(() => {
    if (!selectedOrganization && user?.currentOrganization?.id) {
      setSelectedOrganization(user.currentOrganization.id);
    }
  }, [
    selectedOrganization,
    user?.currentOrganization?.id,
    setSelectedOrganization,
  ]);

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const addEmailBadge = (email: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    if (!isValidEmail(trimmedEmail)) {
      toast.error({
        title: 'Invalid email',
        message: `"${trimmedEmail}" is not a valid email address`,
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
      <p>{t('Expand your network and collaborate with others on Common.')}</p>

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
                  ? `name1@${user?.currentOrganization?.domain || 'example.org'}, name2@${user?.currentOrganization?.domain || 'example.org'}, ...`
                  : 'Type emails followed by a comma...'
              }
              className="min-w-[200px] flex-1 resize-none border-none pt-1 outline-none"
              rows={1}
            />
          </div>
        </div>

        <Select
          label={t('Add to organization')}
          selectedKey={selectedOrganization}
          onSelectionChange={(key) => setSelectedOrganization(key as string)}
        >
          {user?.currentOrganization && (
            <SelectItem id={user.currentOrganization.id}>
              {user.currentProfile?.name}
            </SelectItem>
          )}
        </Select>

        <Select
          label={t('Role')}
          selectedKey={selectedRole}
          onSelectionChange={(key) => setSelectedRole(key as string)}
        >
          <SelectItem id="Admin">{t('Admin')}</SelectItem>
        </Select>
      </div>
    </div>
  );
};
