import { mergeRouters } from '../../trpcFactory';
import { getMyAccount } from './getMyAccount';
import { getUserProfiles } from './getUserProfiles';
import login from './login';
import { matchingDomainOrganizations } from './matchingDomainOrganizations';
import { switchOrganization } from './updateLastOrgId';
import { switchProfile } from './switchProfile';
import updateUserProfile from './updateUserProfile';
import { uploadAvatarImage } from './uploadAvatarImage';
import usedStorage from './usedStorage';
import usernameAvailable from './usernameAvailable';

const accountRouter = mergeRouters(
  login,
  getMyAccount,
  getUserProfiles,
  updateUserProfile,
  usernameAvailable,
  usedStorage,
  uploadAvatarImage,
  switchOrganization,
  switchProfile,
  matchingDomainOrganizations,
);

export default accountRouter;
