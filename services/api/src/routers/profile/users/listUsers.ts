import { listProfileUsers } from '@op/common';

import {
  listProfileUsersInputSchema,
  profileUserListEncoder,
} from '../../../encoders/profiles';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listUsersRouter = router({
  listUsers: commonAuthedProcedure()
    .input(listProfileUsersInputSchema)
    .output(profileUserListEncoder)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileId } = input;

      const users = await listProfileUsers({
        profileId,
        user,
      });

      return profileUserListEncoder.parse(users);
    }),
});
