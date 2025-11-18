import { trpc } from '@op/api/client';
import type { Profile } from '@op/api/encoders';
import { ReactNode, forwardRef } from 'react';

import { BaseUpdateProfileForm, FormFields } from './BaseUpdateProfileForm';

export const UpdateProfileForm = forwardRef<
  HTMLFormElement,
  {
    profile: Profile;
    onSuccess: () => void;
    className?: string;
  }
>(({ profile, onSuccess, className }, ref): ReactNode => {
  const utils = trpc.useUtils();
  const updateProfile = trpc.account.updateUserProfile.useMutation();

  // Get current user's profile ID for the focus areas component
  const { data: userAccount } = trpc.account.getMyAccount.useQuery();
  const profileId = userAccount?.profile?.id;

  const handleSubmit = async (value: FormFields) => {
    await updateProfile.mutateAsync({
      name: value.fullName,
      bio: value.title,
      pronouns:
        value.pronouns === 'custom'
          ? value.customPronouns
          : value.pronouns || undefined,
      email: value.email || undefined,
      website: value.website || undefined,
      focusAreas: value.focusAreas || undefined,
    });
    utils.account.getMyAccount.invalidate();
    utils.account.getUserProfiles.invalidate();
    utils.profile.getBySlug.invalidate({
      slug: profile.slug,
    });
    utils.profile.list.invalidate();
    utils.individual.getTermsByProfile.invalidate({
      profileId,
    });
  };

  const handleImageUploadSuccess = () => {
    utils.account.getMyAccount.invalidate();
    utils.account.getUserProfiles.invalidate();
    utils.profile.getBySlug.invalidate({
      slug: profile.slug,
    });
  };

  return (
    <BaseUpdateProfileForm
      ref={ref}
      profile={profile}
      onSuccess={onSuccess}
      className={className}
      formId="update-profile-form"
      onSubmit={handleSubmit}
      onImageUploadSuccess={handleImageUploadSuccess}
      isSubmitting={updateProfile.isPending}
    />
  );
});

UpdateProfileForm.displayName = 'UpdateProfileForm';
