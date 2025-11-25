import { trpc } from '@op/api/client';
import type { Profile } from '@op/api/encoders';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  const updateProfile = useMutation({
    mutationFn: (input: {
      name: string;
      bio: string;
      pronouns?: string;
      email?: string;
      website?: string;
      focusAreas?: any;
    }) => trpc.account.updateUserProfile.mutate(input),
  });

  const { data: userAccount } = useQuery({
    queryKey: [['account', 'getMyAccount']],
    queryFn: () => trpc.account.getMyAccount.query(),
  });
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
    queryClient.invalidateQueries({ queryKey: [['account', 'getMyAccount']] });
    queryClient.invalidateQueries({ queryKey: [['account', 'getUserProfiles']] });
    queryClient.invalidateQueries({
      queryKey: [['profile', 'getBySlug'], { slug: profile.slug }],
    });
    queryClient.invalidateQueries({ queryKey: [['profile', 'list']] });
    queryClient.invalidateQueries({
      queryKey: [['individual', 'getTermsByProfile'], { profileId }],
    });
  };

  const handleImageUploadSuccess = () => {
    queryClient.invalidateQueries({ queryKey: [['account', 'getMyAccount']] });
    queryClient.invalidateQueries({ queryKey: [['account', 'getUserProfiles']] });
    queryClient.invalidateQueries({
      queryKey: [['profile', 'getBySlug'], { slug: profile.slug }],
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
