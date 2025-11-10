import { DEFAULT_MAX_SIZE } from '@/hooks/useFileUpload';
import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import type { Profile } from '@op/api/encoders';
import { AvatarUploader } from '@op/ui/AvatarUploader';
import { BannerUploader } from '@op/ui/BannerUploader';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ModalFooter } from '@op/ui/Modal';
import type { Option } from '@op/ui/MultiSelectComboBox';
import { Skeleton } from '@op/ui/Skeleton';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import { ReactNode, Suspense, forwardRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { FormContainer } from '../../form/FormContainer';
import { getFieldErrorMessage, useAppForm } from '../../form/utils';
import { FocusAreasField } from './FocusAreasField';
import {
  acceptedImageTypes,
  type FormFields,
  validator,
} from './updateProfileValidator';

export interface BaseUpdateProfileFormProps {
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

    const uploadImage = trpc.account.uploadImage.useMutation();
    const uploadBannerImage = trpc.account.uploadBannerImage.useMutation();

    const profileId = profile.id;

    // Initialize with current profile data
    const [profileImageUrl, setProfileImageUrl] = useState<
      string | undefined
    >(getPublicUrl(profile.avatarImage?.name) || undefined);
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
        await onSubmit(value);
        router.refresh();
        onSuccess();
      },
    });

    const handleImageUpload = async (
      file: File,
      setImageUrl: (url: string | undefined) => void,
      uploadMutation: typeof uploadImage | typeof uploadBannerImage,
    ): Promise<void> => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        const base64 = (e.target?.result as string)?.split(',')[1];

        if (!base64) {
          return;
        }

        if (!acceptedImageTypes.includes(file.type)) {
          toast.error({
            message: `That file type is not supported. Accepted types: ${acceptedImageTypes.map((t) => t.split('/')[1]).join(', ')}`,
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
              onImageUploadSuccess?.();
              router.refresh();
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
                  placeholder:
                    placeholders?.title ?? t('Enter your headline'),
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
  },
);

BaseUpdateProfileForm.displayName = 'BaseUpdateProfileForm';
