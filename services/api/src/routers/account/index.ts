import { mergeRouters } from '../../trpcFactory';
import { getMyAccount } from './getMyAccount';
import { getUserProfiles } from './getUserProfiles';
import login from './login';
import loginAtproto from './loginAtproto';
import { matchingDomainOrganizations } from './matchingDomainOrganizations';
import { switchProfile } from './switchProfile';
import { switchOrganization } from './updateLastOrgId';
import updateUserProfile from './updateUserProfile';
import { uploadAvatarImage } from './uploadAvatarImage';
import { uploadBannerImage } from './uploadBannerImage';
import usedStorage from './usedStorage';
import usernameAvailable from './usernameAvailable';

const accountRouter = mergeRouters(
  login,
  loginAtproto,
  getMyAccount,
  getUserProfiles,
  updateUserProfile,
  usernameAvailable,
  usedStorage,
  uploadAvatarImage,
  uploadBannerImage,
  switchOrganization,
  switchProfile,
  matchingDomainOrganizations,
);

export default accountRouter;
