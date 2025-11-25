import { trpc } from '@op/api/client';
import type { Profile } from '@op/api/encoders';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
  const queryClient = useQueryClient();
  const updateProfile = useMutation({
    mutationFn: (input: Parameters<typeof trpc.platform.admin.updateUserProfile.mutate>[0]) =>
      trpc.platform.admin.updateUserProfile.mutate(input),
  });

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
    queryClient.invalidateQueries({
      queryKey: [['platform', 'admin', 'listAllUsers']],
    });
  };

  const handleImageUploadSuccess = () => {
    queryClient.invalidateQueries({
      queryKey: [['platform', 'admin', 'listAllUsers']],
    });
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
