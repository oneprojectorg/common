'use client';

import { trpc } from '@op/api/client';
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
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
import { useAdminOrganizations } from './useAdminOrganizations';

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

  const [rolesData] = trpc.organization.getRoles.useSuspenseQuery();

  const organizationItems = useAdminOrganizations();
  const roleItems = rolesData.roles.map((role) => ({
    value: role.name,
    label: role.name,
  }));

  React.useEffect(() => {
    if (!selectedRole) {
      const memberRole = rolesData.roles.find((role) => role.name === 'Member');
      const defaultRole = memberRole || rolesData.roles[0];
      if (defaultRole) {
        setSelectedRole(defaultRole.name);
        setSelectedRoleId(defaultRole.id);
      }
    }
  }, [selectedRole, setSelectedRole, setSelectedRoleId]);

  // The parent defaults to the active organization, which the viewer may only
  // be a member of — it would not be in this admin-only list. Never substitute
  // another organization silently: only pick when there is no choice to make,
  // otherwise clear it and let them choose (Send stays disabled until they do).
  React.useEffect(() => {
    if (organizationItems.some((item) => item.value === selectedOrganization)) {
      return;
    }

    const onlyOrganization =
      organizationItems.length === 1 ? organizationItems[0] : undefined;

    setSelectedOrganization(onlyOrganization?.value ?? '');
  }, [organizationItems, selectedOrganization, setSelectedOrganization]);

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
          {organizationItems.length === 0 ? (
            <FieldDescription>
              {t('You can only invite people to organizations you administer.')}
            </FieldDescription>
          ) : (
            <Select
              items={organizationItems}
              value={selectedOrganization}
              onValueChange={(value) => setSelectedOrganization(value ?? '')}
            >
              <SelectTrigger id="invite-organization" className="w-full">
                <SelectValue placeholder={t('Select an organization')} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {organizationItems.map((organization) => (
                    <SelectItem
                      key={organization.value}
                      value={organization.value}
                    >
                      {organization.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
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
