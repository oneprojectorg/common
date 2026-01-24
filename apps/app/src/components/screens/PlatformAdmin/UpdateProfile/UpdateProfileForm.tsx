import { usersCollection } from '@op/api/collections';
import type { Profile } from '@op/api/encoders';
import { trpcClient } from '@op/api/trpcTanstackQuery';
import { toast } from '@op/ui/Toast';
import { createTransaction } from '@tanstack/db';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  BaseUpdateProfileForm,
  type FormFields,
} from '@/components/Profile/ProfileDetails/UpdateProfile';

import type { User } from '../types';

/**
 * Form for updating a user's profile with optimistic updates.
 * Uses TanStack DB transactions to:
 * 1. Apply optimistic update to collection immediately
 * 2. Send mutation to server
 * 3. On success: commit (automatic)
 * 4. On error: rollback + show error toast
 */
export const UpdateProfileForm = ({
  userId,
  authUserId,
  profile,
  onSuccess,
  className,
}: {
  /** The user's internal ID (collection key for optimistic updates) */
  userId: User['id'];
  /** The user's auth ID (for the mutation) */
  authUserId: User['authUserId'];
  profile: Profile;
  onSuccess: () => void;
  className?: string;
}) => {
  const t = useTranslations();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (value: FormFields) => {
    setIsSubmitting(true);

    const mutationData = {
      authUserId,
      data: {
        name: value.fullName,
        bio: value.title,
        email: value.email || undefined,
        website: value.website || undefined,
        focusAreas: value.focusAreas || undefined,
      },
    };

    // Create a transaction for optimistic updates
    const tx = createTransaction({
      mutationFn: async () => {
        // Send the mutation to the server
        await trpcClient.platform.admin.updateUserProfile.mutate(mutationData);
      },
    });

    // Apply optimistic update within the transaction
    tx.mutate(() => {
      usersCollection.update(userId, (draft) => {
        if (draft.profile) {
          draft.profile.name = value.fullName;
          draft.profile.bio = value.title;
          if (value.email !== undefined) {
            draft.profile.email = value.email || null;
          }
          if (value.website !== undefined) {
            draft.profile.website = value.website || null;
          }
        }
      });
    });

    try {
      // Wait for the transaction to be persisted
      await tx.isPersisted.promise;
      onSuccess();
    } catch (error) {
      // Transaction automatically rolls back on error
      // Show error toast to user
      toast.error({
        message: t('platformAdmin_updateProfile_error'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUploadSuccess = () => {
    // Image upload is handled separately, no optimistic update needed
    // The server will update the image and we'll refetch
  };

  return (
    <BaseUpdateProfileForm
      profile={profile}
      onSuccess={onSuccess}
      className={className}
      formId="platform-admin-update-profile-form"
      onSubmit={handleSubmit}
      onImageUploadSuccess={handleImageUploadSuccess}
      isSubmitting={isSubmitting}
    />
  );
};
