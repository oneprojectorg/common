import { createSBServiceClient } from '@op/supabase/server';

import { CommonError } from '../../utils/error';
import type { PhoneNumber } from '../notification/types';

export const createAccountFromPhone = async ({
  phone,
}: {
  phone: PhoneNumber;
}): Promise<{ authUserId: string }> => {
  const supabase = createSBServiceClient();

  const { data, error } = await supabase.auth.admin.createUser({
    phone,
    phone_confirm: true,
  });

  if (error || !data.user) {
    throw new CommonError(
      `Failed to create account for phone signup: ${error?.message ?? 'no user returned'}`,
    );
  }

  return { authUserId: data.user.id };
};
