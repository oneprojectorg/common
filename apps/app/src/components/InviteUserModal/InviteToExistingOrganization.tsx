'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { FieldLabel } from '@op/sense/Field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Tag, TagGroup } from '@op/sense/TagGroup';
import { toast } from '@op/sense/Toast';
import React from 'react';

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
  const { user } = useRequiredUser();

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
          toast.error(
            invalidEmails.length === 1
              ? t('Invalid email')
              : t('Invalid emails'),
            {
              description: `"${invalidEmails.join('", "')}" ${invalidEmails.length === 1 ? t('is not a valid email address') : t('are not valid email addresses')}`,
            },
          );
        }

        // Show info for duplicate emails if any
        if (duplicateEmails.length > 0) {
          toast.error(
            duplicateEmails.length === 1
              ? t('Duplicate email')
              : t('Duplicate emails'),
            {
              description: `"${duplicateEmails.join('", "')}" ${duplicateEmails.length === 1 ? t('has already been added') : t('have already been added')}`,
            },
          );
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
          <div className="flex min-h-20 flex-wrap gap-2 rounded-lg border border-neutral-gray2 p-2">
            <TagGroup aria-label={t('Selected emails')}>
              {emailBadges.map((email, index) => (
                <Tag
                  className="sm:rounded-md"
                  key={index}
                  onRemove={() => removeEmailBadge(email)}
                  removeLabel={t('Remove {email}', { email })}
                >
                  {email}
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
              className="min-w-50 flex-1 resize-none border-none pt-1 outline-hidden"
              rows={1}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="invite-organization">
            {t('Add to organization')}
          </FieldLabel>
          <Select
            value={selectedOrganization}
            onValueChange={(value) => setSelectedOrganization(value ?? '')}
          >
            <SelectTrigger id="invite-organization" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {user.currentOrganization && (
                <SelectItem value={user.currentOrganization.id}>
                  {user.currentProfile?.name}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="invite-role">{t('Role')}</FieldLabel>
          <Select
            value={selectedRole}
            onValueChange={(roleName) => {
              if (!roleName) {
                return;
              }

              const selectedRoleData = rolesData.roles.find(
                (role) => role.name === roleName,
              );

              setSelectedRole(roleName);

              if (selectedRoleData) {
                setSelectedRoleId(selectedRoleData.id);
              }
            }}
          >
            <SelectTrigger id="invite-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rolesData.roles.map((role) => (
                <SelectItem key={role.name} value={role.name}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
