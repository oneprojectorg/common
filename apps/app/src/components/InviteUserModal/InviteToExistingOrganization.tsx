'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { Field, FieldLabel } from '@op/sense/Field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import React from 'react';

import { useTranslations } from '@/lib/i18n';

import { EmailInviteField } from './EmailInviteField';

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

  // `items` is what lets Select render a label in the trigger rather than the
  // raw value — without it the organization shows its id.
  const organizationItems = user.currentOrganization
    ? [
        {
          value: user.currentOrganization.id,
          label: user.currentProfile?.name ?? '',
        },
      ]
    : [];
  const roleItems = rolesData.roles.map((role) => ({
    value: role.name,
    label: role.name,
  }));

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

  return (
    <div className="flex flex-col gap-6">
      <p>{t('Expand your network and collaborate with others on Common.')}</p>

      <div className="flex flex-col gap-4">
        <EmailInviteField
          emails={emails}
          setEmails={setEmails}
          emailBadges={emailBadges}
          setEmailBadges={setEmailBadges}
          fallbackDomain="example.org"
        />

        <Field>
          <FieldLabel htmlFor="invite-organization">
            {t('Add to organization')}
          </FieldLabel>
          <Select
            items={organizationItems}
            value={selectedOrganization}
            onValueChange={(value) => setSelectedOrganization(value ?? '')}
          >
            <SelectTrigger id="invite-organization" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {user.currentOrganization && (
                  <SelectItem value={user.currentOrganization.id}>
                    {user.currentProfile?.name}
                  </SelectItem>
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="invite-role">{t('Role')}</FieldLabel>
          <Select
            items={roleItems}
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
              <SelectGroup>
                {rolesData.roles.map((role) => (
                  <SelectItem key={role.name} value={role.name}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
};
