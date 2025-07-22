import { DEFAULT_MAX_SIZE } from '@/hooks/useFileUpload';
import { getPublicUrl, zodUrl } from '@/utils';
import { trpc } from '@op/api/client';
import type { Profile } from '@op/api/encoders';
import { AvatarUploader } from '@op/ui/AvatarUploader';
import { BannerUploader } from '@op/ui/BannerUploader';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ModalFooter } from '@op/ui/Modal';
import type { Option } from '@op/ui/MultiSelectComboBox';
import { Skeleton } from '@op/ui/Skeleton';
import { toast } from '@op/ui/Toast';
import { ReactNode, Suspense, forwardRef, useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { FormContainer } from '../../form/FormContainer';
import { getFieldErrorMessage, useAppForm } from '../../form/utils';
import { FocusAreasField } from './FocusAreasField';

export const validator = z.object({
  fullName: z
    .string({ message: 'Enter your full name' })
    .trim()
    .min(1, {
      message: 'Enter your full name',
    })
    .max(200, {
      message: 'Must be at most 200 characters',
    }),
  title: z
    .string({
      message: 'Enter your professional title',
    })
    .trim()
    .min(1, {
      message: 'Enter your professional title',
    })
    .max(200, {
      message: 'Must be at most 200 characters',
    }),
  email: z
    .string()
    .trim()
    .refine((val) => val === '' || z.string().email().safeParse(val).success, {
      message: 'Invalid email',
    })
    .refine((val) => val.length <= 255, {
      message: 'Must be at most 255 characters',
    }),
  website: zodUrl({ message: 'Enter a valid website address' }),
  focusAreas: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
      }),
    )
    .optional(),
});

type FormFields = z.infer<typeof validator>;

const acceptedTypes = ['image/gif', 'image/png', 'image/jpeg', 'image/webp'];

export const UpdateProfileForm = forwardRef<
  HTMLFormElement,
  {
    profile: Profile;
    onSuccess: () => void;
    className?: string;
  }
>(({ profile, onSuccess, className }, ref): ReactNode => {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const uploadImage = trpc.account.uploadImage.useMutation();
  const uploadBannerImage = trpc.account.uploadBannerImage.useMutation();
  const updateProfile = trpc.account.updateUserProfile.useMutation();

  // Get current user's profile ID for the focus areas component
  const { data: userAccount } = trpc.account.getMyAccount.useQuery();
  const profileId = userAccount?.profile?.id;

  // Initialize with current profile data
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>(
    getPublicUrl(profile.avatarImage?.name) || undefined,
  );
  const [bannerImageUrl, setBannerImageUrl] = useState<string | undefined>(
    getPublicUrl(profile.headerImage?.name) || undefined,
  );

  const form = useAppForm({
    defaultValues: {
      fullName: profile.name ?? '',
      title: profile.bio ?? '',
      email: profile.email ?? '',
      website: profile.website ?? '',
      focusAreas: [] as Option[],
    },
    validators: {
      // @ts-expect-error - zodUrl is not returning the right type here
      onSubmit: validator,
    },
    onSubmit: async ({ value }: { value: FormFields }) => {
      await updateProfile.mutateAsync({
        name: value.fullName,
        bio: value.title,
        email: value.email || undefined,
        website: value.website || undefined,
        focusAreas: value.focusAreas || undefined,
      });
      utils.account.getMyAccount.invalidate();
      utils.account.getUserProfiles.invalidate();
      utils.individual.getTermsByProfile.invalidate({
        profileId,
      });
      onSuccess();
    },
  });

  const handleImageUpload = async (
    file: File,
    setImageUrl: (url: string | undefined) => void,
    uploadMutation: any,
  ): Promise<void> => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      const base64 = (e.target?.result as string)?.split(',')[1];

      if (!base64) {
        return;
      }

      if (!acceptedTypes.includes(file.type)) {
        toast.error({
          message: `That file type is not supported. Accepted types: ${acceptedTypes.map((t) => t.split('/')[1]).join(', ')}`,
        });
        return;
      }

      if (file.size > DEFAULT_MAX_SIZE) {
        const maxSizeMB = (DEFAULT_MAX_SIZE / 1024 / 1024).toFixed(2);
        toast.error({
          message: `File too large. Maximum size: ${maxSizeMB}MB`,
        });
        return;
      }

      const dataUrl = `data:${file.type};base64,${base64}`;
      setImageUrl(dataUrl);

      const res = await uploadMutation.mutateAsync(
        {
          file: base64,
          fileName: file.name,
          mimeType: file.type,
        },
        {
          onSuccess: () => {
            utils.account.getMyAccount.invalidate();
            utils.account.getUserProfiles.invalidate();
          },
        },
      );

      if (res?.url) {
        setImageUrl(res.url);
      }
    };

    reader.readAsDataURL(file);
  };

  return (
    <form
      ref={ref}
      id="update-profile-form"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FormContainer className={className}>
        {/* Header Images */}
        <div className="relative w-full pb-12 sm:pb-20">
          <BannerUploader
            className="relative aspect-[128/55] w-full bg-offWhite"
            value={bannerImageUrl ?? undefined}
            onChange={(file: File) =>
              handleImageUpload(file, setBannerImageUrl, uploadBannerImage)
            }
            uploading={uploadBannerImage.isPending}
            error={uploadBannerImage.error?.message || undefined}
          />
          <AvatarUploader
            label={t('Profile Picture')}
            className="absolute bottom-0 left-4 aspect-square size-20 sm:size-28"
            value={profileImageUrl ?? undefined}
            onChange={(file: File) =>
              handleImageUpload(file, setProfileImageUrl, uploadImage)
            }
            uploading={uploadImage.isPending}
            error={uploadImage.error?.message || undefined}
          />
        </div>
        <form.AppField
          name="fullName"
          children={(field) => (
            <field.TextField
              isRequired
              label={t('Name')}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              inputProps={{
                placeholder: t('Enter your full name'),
              }}
            />
          )}
        />
        <form.AppField
          name="title"
          children={(field) => (
            <field.TextField
              isRequired
              label={t('Headline')}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              description={t(
                'Add a descriptive headline for your profile. This could be your professional title at your organization or your focus areas.',
              )}
              inputProps={{
                placeholder: t('Enter your headline'),
              }}
            />
          )}
        />
        <form.AppField
          name="email"
          children={(field) => (
            <field.TextField
              label={t('Email')}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              isRequired
              inputProps={{
                placeholder: t('Enter your email address'),
                type: 'email',
              }}
            />
          )}
        />
        <form.AppField
          name="website"
          children={(field) => (
            <field.TextField
              label={t('Website')}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              inputProps={{
                placeholder: t('Enter your website URL'),
              }}
            />
          )}
        />
        {profileId && (
          <form.AppField
            name="focusAreas"
            children={(field) => (
              <Suspense fallback={<Skeleton className="h-8 w-full" />}>
                <FocusAreasField profileId={profileId} field={field} />
              </Suspense>
            )}
          />
        )}
      </FormContainer>
      <ModalFooter className="hidden sm:flex">
        <form.SubmitButton className="sm:w-auto">
          {updateProfile.isPending ||
          uploadImage.isPending ||
          uploadBannerImage.isPending ? (
            <LoadingSpinner />
          ) : (
            t('Save')
          )}
        </form.SubmitButton>
      </ModalFooter>
    </form>
  );
});

UpdateProfileForm.displayName = 'UpdateProfileForm';
