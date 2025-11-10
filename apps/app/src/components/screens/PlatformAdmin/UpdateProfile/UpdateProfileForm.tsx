import { trpc } from '@op/api/client';
import type { Profile } from '@op/api/encoders';

import {
  BaseUpdateProfileForm,
  FormFields,
} from '@/components/Profile/ProfileDetails/UpdateProfile';

import type { User } from '../types';

export const UpdateProfileForm = ({
  user,
  profile,
  onSuccess,
  className,
}: {
  user: User;
  profile: Profile;
  onSuccess: () => void;
  className?: string;
}) => {
  const utils = trpc.useUtils();
  const updateProfile = trpc.platform.admin.updateUserProfile.useMutation();

  const handleSubmit = async (value: FormFields) => {
    await updateProfile.mutateAsync({
      authUserId: user.authUserId,
      data: {
        name: value.fullName,
        bio: value.title,
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
      placeholders={{
        fullName: 'Enter full name',
        title: 'Enter headline',
        titleDescription:
          'Add a descriptive headline for the profile. This could be their professional title at their organization or their focus areas.',
        email: 'Enter email address',
        website: 'Enter website URL',
      }}
    />
  );
};
