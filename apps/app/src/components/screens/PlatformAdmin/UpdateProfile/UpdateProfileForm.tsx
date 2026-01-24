import type { Profile } from '@op/api/encoders';
import { trpcOptions } from '@op/api/trpcTanstackQuery';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  BaseUpdateProfileForm,
  type FormFields,
} from '@/components/Profile/ProfileDetails/UpdateProfile';

import type { User } from '../types';

export const UpdateProfileForm = ({
  authUserId,
  profile,
  onSuccess,
  className,
}: {
  authUserId: User['authUserId'];
  profile: Profile;
  onSuccess: () => void;
  className?: string;
}) => {
  const queryClient = useQueryClient();
  const updateProfile = useMutation(
    trpcOptions.platform.admin.updateUserProfile.mutationOptions(),
  );

  const handleSubmit = async (value: FormFields) => {
    await updateProfile.mutateAsync({
      authUserId,
      data: {
        name: value.fullName,
        bio: value.title,
        email: value.email || undefined,
        website: value.website || undefined,
        focusAreas: value.focusAreas || undefined,
      },
    });
    queryClient.invalidateQueries(
      trpcOptions.platform.admin.listAllUsers.queryFilter(),
    );
  };

  const handleImageUploadSuccess = () => {
    queryClient.invalidateQueries(
      trpcOptions.platform.admin.listAllUsers.queryFilter(),
    );
  };

  return (
    <BaseUpdateProfileForm
      profile={profile}
      onSuccess={onSuccess}
      className={className}
      formId="platform-admin-update-profile-form"
      onSubmit={handleSubmit}
      onImageUploadSuccess={handleImageUploadSuccess}
      isSubmitting={updateProfile.isPending}
    />
  );
};
