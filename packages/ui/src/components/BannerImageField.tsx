import type { ReactNode } from 'react';
import { useRef } from 'react';
import { useButton } from 'react-aria';
import { LuImagePlus, LuTrash2 } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { Button } from './Button';
import { LoadingSpinner } from './LoadingSpinner';

/**
 * All user-facing copy, grouped into one prop so the component stays
 * i18n-agnostic (this package can't call the app's translation hook) without
 * spraying six string props across every call site.
 */
export interface BannerImageCopy {
  /** Field label shown above the field (e.g. "Banner image"). */
  label?: string;
  /** Title in the empty state (e.g. "Upload banner image"). */
  title?: string;
  /** Specs line in the empty state (e.g. "PNG or JPG · max 25MB"). */
  description?: string;
  /** Helper text shown below the empty state. */
  helperText?: string;
  /** Label of the choose-file button (e.g. "Choose file"). */
  chooseFile?: string;
  /** Accessible label for the remove button in the filled state. */
  remove?: string;
}

export interface BannerImageFieldProps {
  /** Current image URL; presence switches the field to its filled state. */
  value?: string | null;
  /** Display name of the current file (filled state). */
  fileName?: string;
  /** Preformatted size label of the current file, e.g. "1.2 MB". */
  fileSizeLabel?: string;
  copy?: BannerImageCopy;
  /** Accepted file types for the picker (the file input `accept`). */
  accept?: string;
  /** Tailwind aspect-ratio class for the preview box. */
  aspectClassName?: string;
  onSelectFile?: (file: File) => void;
  onRemove?: () => void;
  uploading?: boolean;
  error?: string | null;
  /**
   * Renders the preview image. Lets the app inject an optimized `next/image`
   * without dragging `next` into this package. Only called for stable URLs —
   * transient `blob:`/`data:` optimistic frames fall back to a plain `<img>`
   * (next/image can't optimize those), so callers never branch on the scheme.
   */
  renderPreview?: (args: { src: string; className: string }) => ReactNode;
  className?: string;
}

const DEFAULT_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

/**
 * Banner/header image upload field with an empty state (icon + title + specs +
 * "Choose file") and a filled state (preview + remove + filename · size).
 * Behaviour-only and copy-agnostic: strings arrive via `copy`, the preview
 * element via `renderPreview`, so the same primitive serves any app feature
 * (decision overview hero, phase banners, …) through a thin app-side wrapper.
 */
export const BannerImageField = ({
  value,
  fileName,
  fileSizeLabel,
  copy,
  accept = DEFAULT_ACCEPT,
  aspectClassName = 'aspect-[3/1]',
  onSelectFile,
  onRemove,
  uploading = false,
  error = null,
  renderPreview,
  className,
}: BannerImageFieldProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const removeButtonRef = useRef<HTMLButtonElement | null>(null);

  const { buttonProps: removeButtonProps } = useButton(
    { onPress: () => onRemove?.(), 'aria-label': copy?.remove ?? 'Remove' },
    removeButtonRef,
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onSelectFile) {
      onSelectFile(file);
    }
    // Reset so selecting the same file again still fires change.
    event.target.value = '';
  };

  const previewClassName = cn(
    'size-full object-cover',
    uploading && 'opacity-20',
  );
  // The optimistic frame is a local object/data URL next/image can't optimize;
  // keep it on a plain <img> and only hand stable URLs to renderPreview.
  const isTransient =
    !!value && (value.startsWith('blob:') || value.startsWith('data:'));

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      {copy?.label ? (
        <p className="text-sm text-neutral-black">{copy.label}</p>
      ) : null}

      {value ? (
        <div className="flex flex-col gap-2">
          <div
            className={cn(
              'relative w-full overflow-hidden rounded-lg',
              aspectClassName,
            )}
          >
            {renderPreview && !isTransient ? (
              renderPreview({ src: value, className: previewClassName })
            ) : (
              <img src={value} alt="" className={previewClassName} />
            )}
            {uploading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : null}
            <button
              {...removeButtonProps}
              ref={removeButtonRef}
              className="absolute top-2 right-2 rounded-md border bg-white p-2 text-neutral-charcoal shadow-sm hover:bg-neutral-gray1"
            >
              <LuTrash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
          {fileName ? (
            <p className="text-sm text-neutral-gray4">
              {fileName}
              {fileSizeLabel ? ` · ${fileSizeLabel}` : null}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col justify-between gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:p-6">
          <div className="flex gap-4">
            <div className="flex w-32 items-center justify-center rounded-md bg-neutral-gray1">
              {uploading ? (
                <LoadingSpinner />
              ) : (
                <LuImagePlus
                  className="size-4 text-neutral-charcoal"
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="flex flex-col">
              {copy?.title ? (
                <span className="text-base text-neutral-black">
                  {copy.title}
                </span>
              ) : null}
              {copy?.description ? (
                <span className="text-sm text-neutral-gray4">
                  {copy.description}
                </span>
              ) : null}
            </div>
          </div>
          <Button
            color="secondary"
            size="small"
            isDisabled={uploading}
            onPress={() => fileInputRef.current?.click()}
            className="w-auto sm:w-fit"
          >
            {copy?.chooseFile ?? 'Choose file'}
          </Button>
        </div>
      )}

      {copy?.helperText && !value ? (
        <p className="text-sm text-neutral-gray4">{copy.helperText}</p>
      ) : null}
      {error ? <p className="text-sm text-functional-red">{error}</p> : null}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        className="hidden"
      />
    </div>
  );
};
