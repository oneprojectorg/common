import { useRef } from 'react';
import { useButton } from 'react-aria';
import { LuImagePlus, LuTrash2 } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { Button } from './Button';
import { LoadingSpinner } from './LoadingSpinner';

export interface BannerImageFieldProps {
  /** Field label shown above the field (e.g. "Banner image"). */
  label?: string;
  /** Current image URL; presence switches the field to its filled state. */
  value?: string | null;
  /** Display name of the current file (filled state). */
  fileName?: string;
  /** Preformatted size label of the current file, e.g. "1.2 MB". */
  fileSizeLabel?: string;
  /** Title in the empty state (e.g. "Upload banner image"). */
  title?: string;
  /** Specs line in the empty state (e.g. "PNG or JPG · max 3MB"). */
  description?: string;
  /** Helper text shown below the empty state. */
  helperText?: string;
  /** Label of the choose-file button (e.g. "Choose file"). */
  chooseFileLabel?: string;
  /** Accessible label for the remove button in the filled state. */
  removeLabel?: string;
  onSelectFile?: (file: File) => void;
  onRemove?: () => void;
  uploading?: boolean;
  error?: string | null;
  className?: string;
}

/**
 * Banner/header image upload field with an empty state (icon + title + specs +
 * "Choose file") and a filled state (preview + remove + filename · size). All
 * copy is passed in as props so callers own translation; upload + remove are
 * delegated to the caller.
 */
export const BannerImageField = ({
  label,
  value,
  fileName,
  fileSizeLabel,
  title,
  description,
  helperText,
  chooseFileLabel = 'Choose file',
  removeLabel = 'Remove',
  onSelectFile,
  onRemove,
  uploading = false,
  error = null,
  className,
}: BannerImageFieldProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const removeButtonRef = useRef<HTMLButtonElement | null>(null);

  const { buttonProps: removeButtonProps } = useButton(
    { onPress: () => onRemove?.(), 'aria-label': removeLabel },
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

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      {label ? <p className="text-sm text-neutral-black">{label}</p> : null}

      {value ? (
        <div className="flex flex-col gap-2">
          <div className="relative aspect-[3/1] w-full overflow-hidden rounded-lg">
            <img
              src={value}
              alt=""
              className={cn(
                'size-full object-cover',
                uploading && 'opacity-20',
              )}
            />
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
        <div className="flex items-center justify-between gap-4 rounded-lg border p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-20 items-center justify-center rounded bg-neutral-gray1">
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
              {title ? (
                <span className="text-base text-neutral-black">{title}</span>
              ) : null}
              {description ? (
                <span className="text-sm text-neutral-gray4">
                  {description}
                </span>
              ) : null}
            </div>
          </div>
          <Button
            color="secondary"
            size="small"
            isDisabled={uploading}
            onPress={() => fileInputRef.current?.click()}
          >
            {chooseFileLabel}
          </Button>
        </div>
      )}

      {helperText && !value ? (
        <p className="text-sm text-neutral-gray4">{helperText}</p>
      ) : null}
      {error ? <p className="text-sm text-functional-red">{error}</p> : null}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
      />
    </div>
  );
};
