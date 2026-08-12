import { mergeRouters } from '../../trpcFactory';
import { completeOnboarding } from './completeOnboarding';
import { deleteAccountRouter } from './deleteAccount';
import { getMyAccount } from './getMyAccount';
import { getUserProfiles } from './getUserProfiles';
import { listUserInvitesRouter } from './listUserInvites';
import login from './login';
import { matchingDomainOrganizations } from './matchingDomainOrganizations';
import { switchProfile } from './switchProfile';
import { switchOrganization } from './updateLastOrgId';
import updateUserProfile from './updateUserProfile';

const accountRouter = mergeRouters(
  login,
  getMyAccount,
  completeOnboarding,
  deleteAccountRouter,
  getUserProfiles,
  listUserInvitesRouter,
  updateUserProfile,
  switchOrganization,
  switchProfile,
  matchingDomainOrganizations,
);

export default accountRouter;
