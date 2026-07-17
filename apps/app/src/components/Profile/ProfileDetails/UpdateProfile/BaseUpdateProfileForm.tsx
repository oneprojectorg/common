import { useProfileImageUpload } from '@/hooks/useProfileImageUpload';
import { getPublicUrl } from '@/utils';
import type { Profile } from '@op/api/encoders';
import { zodUrl } from '@op/common/validation';
import { AvatarUploader } from '@op/ui/AvatarUploader';
import { BannerUploader } from '@op/ui/BannerUploader';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ModalFooter } from '@op/ui/Modal';
import type { Option } from '@op/ui/MultiSelectComboBox';
import { SelectItem } from '@op/ui/Select';
import { Skeleton } from '@op/ui/Skeleton';
import { useRouter } from 'next/navigation';
import { ReactNode, Suspense, forwardRef } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { FormContainer } from '../../../form/FormContainer';
import { getFieldErrorMessage, useAppForm } from '../../../form/utils';
import { FocusAreasField } from '../FocusAreasField';

interface BaseUpdateProfileFormProps {
  profile: Profile;
  onSuccess: () => void;
  className?: string;
  formId?: string;
  onSubmit: (value: FormFields) => Promise<void>;
  onImageUploadSuccess?: () => void;
  isSubmitting?: boolean;
  placeholders?: {
    fullName?: string;
    title?: string;
    titleDescription?: string;
    email?: string;
    website?: string;
  };
}

export const BaseUpdateProfileForm = forwardRef<
  HTMLFormElement,
  BaseUpdateProfileFormProps
>(
  (
    {
      profile,
      onSuccess,
      className,
      formId = 'update-profile-form',
      onSubmit,
      onImageUploadSuccess,
      isSubmitting = false,
      placeholders,
    },
    ref,
  ): ReactNode => {
    const t = useTranslations();
    const router = useRouter();

    const profileId = profile.id;

    const handleImageUploadSuccess = () => {
      onImageUploadSuccess?.();
      router.refresh();
    };
    const avatarUpload = useProfileImageUpload({
      profileId,
      imageType: 'avatar',
      initialUrl: getPublicUrl(profile.avatarImage?.name) || undefined,
      onSuccess: handleImageUploadSuccess,
    });
    const bannerUpload = useProfileImageUpload({
      profileId,
      imageType: 'banner',
      initialUrl: getPublicUrl(profile.headerImage?.name) || undefined,
      onSuccess: handleImageUploadSuccess,
    });

    const form = useAppForm({
      defaultValues: {
        fullName: profile.name ?? '',
        title: profile.bio ?? '',
        pronouns: profile.individual?.pronouns
          ? ['he/him', 'she/her', 'they/them'].includes(
              profile.individual.pronouns,
            )
            ? profile.individual.pronouns
            : 'custom'
          : '',
        customPronouns:
          profile.individual?.pronouns &&
          !['he/him', 'she/her', 'they/them'].includes(
            profile.individual.pronouns,
          )
            ? profile.individual.pronouns
            : '',
        email: profile.email ?? '',
        website: profile.website ?? '',
        focusAreas: [] as Option[],
      },
      validators: {
        // @ts-expect-error - zodUrl is not returning the right type here
        onSubmit: validator,
      },
      onSubmit: async ({ value }: { value: FormFields }) => {
        await onSubmit(value);
        router.refresh();
        onSuccess();
      },
    });

    return (
      <form
        ref={ref}
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FormContainer className={className}>
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
                label={t('Name')}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                errorMessage={getFieldErrorMessage(field)}
                inputProps={{
                  placeholder:
                    placeholders?.fullName ?? t('Enter your full name'),
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
                description={
                  placeholders?.titleDescription ??
                  t(
                    'Add a descriptive headline for your profile. This could be your professional title at your organization or your focus areas.',
                  )
                }
                inputProps={{
                  placeholder: placeholders?.title ?? t('Enter your headline'),
                }}
              />
            )}
          />
          <form.AppField
            name="pronouns"
            children={(field) => (
              <field.Select
                label={t('Pronouns')}
                placeholder={t('Select your preferred pronouns')}
                selectedKey={field.state.value}
                onBlur={field.handleBlur}
                onSelectionChange={(key) => field.handleChange(String(key))}
                errorMessage={getFieldErrorMessage(field)}
              >
                <SelectItem id="she/her">{t('She/Her')}</SelectItem>
                <SelectItem id="he/him">{t('He/Him')}</SelectItem>
                <SelectItem id="they/them">{t('They/Them')}</SelectItem>
                <SelectItem id="custom">{t('Custom')}</SelectItem>
              </field.Select>
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
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={field.handleChange}
                      errorMessage={getFieldErrorMessage(field)}
                      isRequired
                      inputProps={{
                        placeholder: t('Enter your custom pronouns'),
                      }}
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
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                errorMessage={getFieldErrorMessage(field)}
                isRequired
                inputProps={{
                  placeholder:
                    placeholders?.email ?? t('Enter your email address'),
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
                  placeholder:
                    placeholders?.website ?? t('Enter your website URL'),
                  // Not `type="url"`: our zodUrl validation accepts a bare
                  // domain (e.g. "venuecms.com") and auto-prefixes `https://`,
                  // but the browser's native URL validation rejects the
                  // scheme-less value and silently blocks form submission.
                  // `inputMode` keeps the URL-optimized keyboard without that
                  // native constraint.
                  inputMode: 'url',
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
        <ModalFooter className="sticky">
          <form.SubmitButton className="sm:w-auto">
            {isSubmitting ||
            avatarUpload.isUploading ||
            bannerUpload.isUploading ? (
              <LoadingSpinner />
            ) : (
              t('Save')
            )}
          </form.SubmitButton>
        </ModalFooter>
      </form>
    );
  },
);

BaseUpdateProfileForm.displayName = 'BaseUpdateProfileForm';

export const validator = z
  .object({
    fullName: z
      .string({
        error: 'Enter your full name',
      })
      .trim()
      .min(1, {
        error: 'Enter your full name',
      })
      .max(200, {
        error: 'Must be at most 200 characters',
      }),
    title: z
      .string({
        error: 'Enter your professional title',
      })
      .trim()
      .min(1, {
        error: 'Enter your professional title',
      })
      .max(200, {
        error: 'Must be at most 200 characters',
      }),
    pronouns: z.string().trim().optional(),
    customPronouns: z.string().trim().optional(),
    email: z
      .email()
      .trim()
      .refine((val) => val === '' || z.email().safeParse(val).success, {
        error: 'Invalid email',
      })
      .refine((val) => val.length <= 255, {
        error: 'Must be at most 255 characters',
      }),
    website: zodUrl({
      error: 'Enter a valid website address',
    }),
    focusAreas: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
        }),
      )
      .optional(),
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
      message: 'Please provide your custom pronouns',
      path: ['customPronouns'],
    },
  );

export type FormFields = z.infer<typeof validator>;
