import { useTRPC } from '@op/api/client';
import type { Profile } from '@op/api/encoders';
import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';

import {
  BaseUpdateProfileForm,
  FormFields,
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
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const updateProfile = useMutation(
    trpc.platform.admin.updateUserProfile.mutationOptions(),
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
      trpc.platform.admin.listAllUsers.pathFilter(),
    );
  };

  const handleImageUploadSuccess = () => {
    queryClient.invalidateQueries(
      trpc.platform.admin.listAllUsers.pathFilter(),
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
