import { mergeRouters } from '../../trpcFactory';
import { getMyAccount } from './getMyAccount';
import login from './login';
import { matchingDomainOrganizations } from './matchingDomainOrganizations';
import { switchOrganization } from './updateLastOrgId';
import updateUserProfile from './updateUserProfile';
import { uploadAvatarImage } from './uploadAvatarImage';
import usedStorage from './usedStorage';
import usernameAvailable from './usernameAvailable';

const accountRouter = mergeRouters(
  login,
  getMyAccount,
  updateUserProfile,
  usernameAvailable,
  usedStorage,
  uploadAvatarImage,
  switchOrganization,
  matchingDomainOrganizations,
);

export default accountRouter;
