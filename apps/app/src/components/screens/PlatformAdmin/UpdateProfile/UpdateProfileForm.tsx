import { trpc } from '@op/api/client';
import type { Profile } from '@op/api/encoders';

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
  const utils = trpc.useUtils();
  const updateProfile = trpc.platform.admin.updateUserProfile.useMutation();

  const handleSubmit = async (value: FormFields) => {
    await updateProfile.mutateAsync({
      authUserId,
      data: {
        name: value.fullName,
        bio: value.title,
        pronouns: value.customPronouns || value.pronouns || undefined,
        email: value.email || undefined,
        website: value.website || undefined,
        focusAreas: value.focusAreas || undefined,
      },
    });
    utils.platform.admin.listAllUsers.invalidate();
  };

  const handleImageUploadSuccess = () => {
    utils.platform.admin.listAllUsers.invalidate();
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
