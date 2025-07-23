import { DEFAULT_MAX_SIZE } from '@/hooks/useFileUpload';
import { zodUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { AvatarUploader } from '@op/ui/AvatarUploader';
import { BannerUploader } from '@op/ui/BannerUploader';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Skeleton } from '@op/ui/Skeleton';
import { toast } from '@op/ui/Toast';
import { ReactNode, Suspense, useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { StepProps } from '../MultiStepForm';
import { FocusAreasField } from '../Profile/ProfileDetails/FocusAreasField';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { getFieldErrorMessage, useAppForm } from '../form/utils';
import { useOnboardingFormStore } from './useOnboardingFormStore';

type FormFields = z.infer<typeof validator>;

export const createValidator = (t: (key: string) => string) =>
  z.object({
    fullName: z
      .string({ message: t('Enter your full name') })
      .trim()
      .min(1, {
        message: t('Enter your full name'),
      })
      .max(200, {
        message: t('Must be at most 200 characters'),
      }),
    title: z
      .string({
        message: t('Enter your professional title'),
      })
      .trim()
      .min(1, {
        message: t('Enter your professional title'),
      })
      .max(200, {
        message: t('Must be at most 200 characters'),
      }),
    email: z
      .string()
      .trim()
      .refine(
        (val) => val === '' || z.string().email().safeParse(val).success,
        {
          message: t('Invalid email'),
        },
      )
      .refine((val) => val.length <= 255, {
        message: t('Must be at most 255 characters'),
      }),
    website: zodUrl({ message: t('Enter a valid website address') }),
    focusAreas: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
        }),
      )
      .optional(),
    profileImageUrl: z.string().optional(),
    bannerImageUrl: z.string().optional(),
  });

// Fallback validator for external use
export const validator = z.object({
  fullName: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  email: z.string().optional(),
  website: z.string().optional(),
  focusAreas: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
      }),
    )
    .optional(),
  profileImageUrl: z.string().optional(),
  bannerImageUrl: z.string().optional(),
});
const acceptedTypes = ['image/gif', 'image/png', 'image/jpeg', 'image/webp'];

export const PersonalDetailsForm = ({
  onNext,
  className,
}: StepProps & { className?: string }): ReactNode => {
  const personalDetails = useOnboardingFormStore((s) => s.personalDetails);
  const setPersonalDetails = useOnboardingFormStore(
    (s) => s.setPersonalDetails,
  );
  const t = useTranslations();
  const utils = trpc.useUtils();
  const uploadImage = trpc.account.uploadImage.useMutation();
  const uploadBannerImage = trpc.account.uploadBannerImage.useMutation();
  const updateProfile = trpc.account.updateUserProfile.useMutation();

  // Get current user's profile ID for the focus areas component
  const { data: userAccount } = trpc.account.getMyAccount.useQuery();
  const profileId = userAccount?.profile?.id;

  // Hydrate profileImageUrl from store if present, else undefined
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>(
    personalDetails?.profileImageUrl,
  );
  const [bannerImageUrl, setBannerImageUrl] = useState<string | undefined>(
    personalDetails?.bannerImageUrl,
  );

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

  // Hydrate form from store if present
  const form = useAppForm({
    defaultValues: {
      fullName: personalDetails?.fullName ?? '',
      title: personalDetails?.title ?? '',
      email: personalDetails?.email ?? '',
      website: personalDetails?.website ?? '',
      focusAreas: personalDetails?.focusAreas ?? [],
      profileImageUrl: personalDetails?.profileImageUrl ?? '',
      bannerImageUrl: personalDetails?.bannerImageUrl ?? '',
    },
    validators: {
      onSubmit: createValidator(t) as any,
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
      if (profileId) {
        utils.individual.getTermsByProfile.invalidate({
          profileId,
        });
      }
      setPersonalDetails({ ...value, profileImageUrl, bannerImageUrl }); // Persist to store on submit

      onNext(value);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        console.log('submit');
        void form.handleSubmit();
      }}
      className={className}
    >
      <FormContainer className="max-w-lg">
        <FormHeader text={t('Add your personal details')}>
          {t('Tell us about yourself so others can find you.')}
        </FormHeader>

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
              label={t('Full Name')}
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

        <form.SubmitButton className="sm:w-full">
          {updateProfile.isPending ||
          uploadImage.isPending ||
          uploadBannerImage.isPending ? (
            <LoadingSpinner />
          ) : (
            t('Continue')
          )}
        </form.SubmitButton>
      </FormContainer>
    </form>
  );
};
