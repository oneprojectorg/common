import { useProfileImageUpload } from '@/hooks/useProfileImageUpload';
import { trpc } from '@op/api/client';
import { zodUrl } from '@op/common/validation';
import { AvatarUploader } from '@op/sense/AvatarUploader';
import { BannerUploader } from '@op/sense/BannerUploader';
import { Skeleton } from '@op/sense/Skeleton';
import { ReactNode, Suspense } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';
import type { TranslateFn } from '@/lib/i18n';

import { StepProps } from '../MultiStepForm';
import { FocusAreasField } from '../Profile/ProfileDetails/FocusAreasField';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { useAppForm } from '../form/utils';
import { useOnboardingFormStore } from './useOnboardingFormStore';

type FormFields = z.infer<typeof validator>;

export const createValidator = (t: TranslateFn) =>
  z
    .object({
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
      pronouns: z
        .string({ message: t('Pronouns') })
        .trim()
        .optional(),
      customPronouns: z.string().optional(),
      email: z
        .email({ error: t('Enter a valid email address') })
        .trim()
        .refine((val) => val.length <= 255, {
          message: t('Must be at most 255 characters'),
        }),
      website: zodUrl({ error: t('Enter a valid website address') }),
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
    })
    .refine(
      (data) => {
        // If pronouns is "custom" require custom pronouns
        if (data.pronouns === 'custom') {
          return data.customPronouns && data.customPronouns.trim().length > 0;
        }
        return true;
      },
      {
        message: t('Please provide your custom pronouns'),
        path: ['customPronouns'],
      },
    );

// Fallback validator for external use
export const validator = z.object({
  fullName: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  email: z.string().optional(),
  website: z.string().optional(),
  pronouns: z.string().optional(),
  customPronouns: z.string().optional(),
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
  const updateProfile = trpc.account.updateUserProfile.useMutation();
  // Get current user's profile ID for the focus areas component
  const { data: userAccount } = trpc.account.getMyAccount.useQuery();
  const profileId = userAccount?.profile?.id;

  const handleImageUploadSuccess = () => {
    utils.account.getMyAccount.invalidate();
    utils.account.getUserProfiles.invalidate();
  };
  // Hydrate previews from the store if present
  const avatarUpload = useProfileImageUpload({
    profileId,
    imageType: 'avatar',
    initialUrl: personalDetails?.profileImageUrl,
    onSuccess: handleImageUploadSuccess,
  });
  const bannerUpload = useProfileImageUpload({
    profileId,
    imageType: 'banner',
    initialUrl: personalDetails?.bannerImageUrl,
    onSuccess: handleImageUploadSuccess,
  });

  // Hydrate form from store if present
  const form = useAppForm({
    defaultValues: {
      fullName: personalDetails?.fullName ?? '',
      title: personalDetails?.title ?? '',
      pronouns: personalDetails?.pronouns ?? '',
      customPronouns: personalDetails?.customPronouns ?? '',
      email: personalDetails?.email ?? '',
      website: personalDetails?.website ?? '',
      focusAreas: personalDetails?.focusAreas ?? [],
      profileImageUrl: personalDetails?.profileImageUrl ?? '',
      bannerImageUrl: personalDetails?.bannerImageUrl ?? '',
    },
    validators: {
      // @ts-expect-error - zodUrl is not returning the right type here
      onChange: createValidator(t),
      // @ts-expect-error - zodUrl is not returning the right type here
      onSubmit: createValidator(t),
    },
    onSubmit: async ({ value }: { value: FormFields }) => {
      await updateProfile.mutateAsync({
        name: value.fullName,
        bio: value.title,
        email: value.email || undefined,
        pronouns:
          value.pronouns === 'custom'
            ? value.customPronouns
            : value.pronouns || undefined,
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
      setPersonalDetails({
        ...value,
        profileImageUrl: avatarUpload.url,
        bannerImageUrl: bannerUpload.url,
      }); // Persist to store on submit
      onNext(value);
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
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
            value={bannerUpload.url}
            onChange={bannerUpload.upload}
            uploading={bannerUpload.isUploading}
            error={bannerUpload.uploadError}
          />
          <AvatarUploader
            label={t('Profile Picture')}
            className="absolute start-4 bottom-0 aspect-square size-20 sm:size-28"
            value={avatarUpload.url}
            onChange={avatarUpload.upload}
            uploading={avatarUpload.isUploading}
            error={avatarUpload.uploadError}
          />
        </div>
        <form.AppField
          name="fullName"
          children={(field) => (
            <field.TextField
              isRequired
              label={t('Full name')}
              placeholder={t('Enter your full name')}
            />
          )}
        />
        <form.AppField
          name="title"
          children={(field) => (
            <field.TextField
              isRequired
              label={t('Headline')}
              description={t(
                'Add a descriptive headline for your profile. This could be your professional title at your organization or your focus areas.',
              )}
              placeholder={t('Enter your headline')}
            />
          )}
        />
        <form.AppField
          name="pronouns"
          children={(field) => (
            <field.Select
              label={t('Pronouns')}
              placeholder={t('Select your preferred pronouns')}
              options={[
                { value: 'she/her', label: t('She/Her') },
                { value: 'he/him', label: t('He/Him') },
                { value: 'they/them', label: t('They/Them') },
                { value: 'custom', label: t('Custom') },
              ]}
            />
          )}
        />
        <form.Subscribe
          selector={(state) => state.values.pronouns}
          children={(pronouns) =>
            pronouns === 'custom' ? (
              <form.AppField
                name="customPronouns"
                children={(field) => (
                  <field.TextField
                    label={t('Custom Pronouns')}
                    isRequired
                    placeholder={t('Enter your custom pronouns')}
                  />
                )}
              />
            ) : null
          }
        />
        <form.AppField
          name="email"
          children={(field) => (
            <field.TextField
              label={t('Email')}
              isRequired
              placeholder={t('Enter your email address')}
              type="email"
            />
          )}
        />
        <form.AppField
          name="website"
          children={(field) => (
            <field.TextField
              label={t('Website')}
              placeholder={t('Enter your website URL')}
              // Not `type="url"`: our zodUrl validation accepts a bare domain
              // (e.g. "venuecms.com") and auto-prefixes `https://`, but the
              // browser's native URL validation rejects the scheme-less value
              // and silently blocks form submission. `inputMode` keeps the
              // URL-optimized keyboard without that native constraint.
              inputMode="url"
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

        <form.SubmitButton
          className="sm:w-full"
          loading={
            updateProfile.isPending ||
            avatarUpload.isUploading ||
            bannerUpload.isUploading
          }
        >
          {t('Continue')}
        </form.SubmitButton>
      </FormContainer>
    </form>
  );
};
