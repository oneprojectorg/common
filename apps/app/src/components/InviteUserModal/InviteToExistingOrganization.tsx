'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { Select, SelectItem } from '@op/ui/Select';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import { toast } from '@op/ui/Toast';
import React from 'react';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { parseEmails, shouldParseEmails } from './emailUtils';

interface InviteToExistingOrganizationProps {
  emails: string;
  setEmails: (emails: string) => void;
  emailBadges: string[];
  setEmailBadges: (badges: string[]) => void;
  selectedRole: string;
  setSelectedRole: (role: string) => void;
  setSelectedRoleId: (roleId: string) => void;
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
  setSelectedRoleId,
  selectedOrganization,
  setSelectedOrganization,
}: InviteToExistingOrganizationProps) => {
  const t = useTranslations();
  const { user } = useUser();

  const [rolesData] = trpc.organization.getRoles.useSuspenseQuery();

  React.useEffect(() => {
    if (!selectedRole) {
      // Initialize default role if none selected
      // Default to Admin if available, otherwise first role
      const memberRole = rolesData.roles.find((role) => role.name === 'Member');
      const defaultRole = memberRole || rolesData.roles[0];
      if (defaultRole) {
        setSelectedRole(defaultRole.name);
        setSelectedRoleId(defaultRole.id);
      }
    }
  }, [selectedRole, setSelectedRole, setSelectedRoleId]);

  // Ensure first organization is selected if no selection exists
  React.useEffect(() => {
    if (!selectedOrganization && user.currentOrganization?.id) {
      setSelectedOrganization(user.currentOrganization.id);
    }
  }, [
    selectedOrganization,
    user.currentOrganization?.id,
    setSelectedOrganization,
  ]);

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
    <div className="flex flex-col gap-6">
      <p>{t('Expand your network and collaborate with others on Common.')}</p>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">{t('Send to')}</label>
          <div className="flex min-h-[80px] flex-wrap gap-2 rounded-md border border-neutral-gray2 p-2">
            <TagGroup aria-label={t('Selected emails')}>
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
              aria-label={t('Add emails')}
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                emailBadges.length === 0
                  ? `name1@${user.currentOrganization?.domain || 'example.org'}, name2@${user.currentOrganization?.domain || 'example.org'}, ...`
                  : t('Type emails followed by a comma or line break...')
              }
              className="min-w-[200px] flex-1 resize-none border-none pt-1 outline-hidden"
              rows={1}
            />
          </div>
        </div>

        <Select
          label={t('Add to organization')}
          selectedKey={selectedOrganization}
          onSelectionChange={(key) => setSelectedOrganization(key as string)}
        >
          {user.currentOrganization && (
            <SelectItem id={user.currentOrganization.id}>
              {user.currentProfile?.name}
            </SelectItem>
          )}
        </Select>

        <Select
          label={t('Role')}
          selectedKey={selectedRole}
          onSelectionChange={(key) => {
            const roleName = key as string;
            const selectedRoleData = rolesData.roles.find(
              (role: any) => role.name === roleName,
            );
            setSelectedRole(roleName);
            if (selectedRoleData) {
              setSelectedRoleId(selectedRoleData.id);
            }
          }}
        >
          {rolesData.roles.map((role) => (
            <SelectItem key={role.name} id={role.name}>
              {role.name}
            </SelectItem>
          ))}
        </Select>
      </div>
    </div>
  );
};
