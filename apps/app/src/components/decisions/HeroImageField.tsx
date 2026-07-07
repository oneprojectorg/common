'use client';

import { IMAGE_UPLOAD_SIZE_LIMIT } from '@op/common/client';
import { BannerImageField } from '@op/ui/BannerImageField';
import Image from 'next/image';

import { useTranslations } from '@/lib/i18n';

import { useHeroImage } from './useHeroImage';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

/**
 * App-side wrapper around the @op/ui BannerImageField for a decision hero image,
 * scoped to the overview (no `phaseId`) or a single phase (`phaseId`). Owns the
 * upload hook, translated copy, and the optimized `next/image` preview. Used by
 * the Process Builder (overview + phase editors) and the live "Edit banner"
 * modal.
 */
export function HeroImageField({
  instanceId,
  phaseId,
  initialPath,
  onChange,
}: {
  instanceId: string;
  /** When set, targets that phase's banner; otherwise the overview banner. */
  phaseId?: string;
  /** Stored storage path of the current hero image, if any. */
  initialPath?: string;
  /** Fires after a successful upload/remove (e.g. to refresh an RSC page). */
  onChange?: () => void;
}) {
  const t = useTranslations();
  const {
    previewUrl,
    fileName,
    fileSizeLabel,
    upload,
    remove,
    isUploading,
    isRemoving,
    uploadError,
  } = useHeroImage({ instanceId, phaseId, initialPath, onChange });

  return (
    <BannerImageField
      value={previewUrl}
      fileName={fileName}
      fileSizeLabel={fileSizeLabel}
      accept={ACCEPT}
      copy={{
        label: t('Banner image'),
        title: t('Upload banner image'),
        description: t(
          'PNG, JPG, WebP or GIF · recommended 2400×800px · max {size}MB',
          { size: Math.floor(IMAGE_UPLOAD_SIZE_LIMIT / 1024 / 1024) },
        ),
        helperText: t(
          'The headline appears centered over a dark overlay. Avoid images with key subjects in the middle.',
        ),
        chooseFile: t('Choose file'),
        remove: t('Remove image'),
      }}
      onSelectFile={upload}
      onRemove={remove}
      uploading={isUploading || isRemoving}
      error={uploadError || undefined}
      renderPreview={({ src, className }) => (
        <Image
          src={src}
          alt=""
          fill
          sizes="(min-width: 640px) 40rem, 100vw"
          className={className}
        />
      )}
    />
  );
}
