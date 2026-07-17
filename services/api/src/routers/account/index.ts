import { mergeRouters } from '../../trpcFactory';
import { completeOnboarding } from './completeOnboarding';
import { getMyAccount } from './getMyAccount';
import { getUserProfiles } from './getUserProfiles';
import { listUserInvitesRouter } from './listUserInvites';
import login from './login';
import { matchingDomainOrganizations } from './matchingDomainOrganizations';
import { saveProfileImageRouter } from './saveProfileImage';
import { signProfileImageUploadUrlRouter } from './signProfileImageUploadUrl';
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
  signProfileImageUploadUrlRouter,
  saveProfileImageRouter,
  switchOrganization,
  switchProfile,
  matchingDomainOrganizations,
);

export default accountRouter;
