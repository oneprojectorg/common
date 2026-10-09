import { mergeRouters } from '../../trpcFactory';
import { completeOnboarding } from './completeOnboarding';
import { getMyAccount } from './getMyAccount';
import { getUserProfiles } from './getUserProfiles';
import { listUserInvitesRouter } from './listUserInvites';
import login from './login';
import { matchingDomainOrganizations } from './matchingDomainOrganizations';
import { notificationPreferences } from './notificationPreferences';
import { switchProfile } from './switchProfile';
import { switchOrganization } from './updateLastOrgId';
import updateUserProfile from './updateUserProfile';

const accountRouter = mergeRouters(
  login,
  getMyAccount,
  completeOnboarding,
  getUserProfiles,
  listUserInvitesRouter,
  updateUserProfile,
  switchOrganization,
  switchProfile,
  matchingDomainOrganizations,
  notificationPreferences,
);

export default accountRouter;
