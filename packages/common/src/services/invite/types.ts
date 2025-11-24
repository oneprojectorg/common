export interface InviteMetadata {
  invitedBy: string;
  invitedAt: string;
  inviteType: 'existing_organization' | 'new_organization' | 'profile';
  personalMessage?: string;
  roleId?: string;
  organizationId?: string;
  profileId?: string;
  inviterOrganizationName?: string;
  inviterProfileName?: string;
}
