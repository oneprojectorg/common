'use client';

import * as React from 'react';
import { LuCamera } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { Spinner } from '../ui/spinner';

interface AvatarUploaderProps {
  label?: string;
  /** Current image URL, if one is set. */
  value?: string | null;
  onChange?: (file: File) => Promise<void> | void;
  uploading?: boolean;
  error?: string | null;
  className?: string;
}

function AvatarUploader({
  label,
  value,
  onChange,
  uploading = false,
  error = null,
  className,
}: AvatarUploaderProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onChange) {
      onChange(file);
    }
    // Reset so re-selecting the same file fires change again.
    event.target.value = '';
  };

  return (
    <div
      data-slot="avatar-uploader"
      className={cn(
        'flex flex-col items-center justify-center gap-2',
        uploading && 'opacity-50',
        className,
      )}
    >
      <div className="size-full">
        <div className="relative flex aspect-square size-full items-center justify-center rounded-full border-4 border-background bg-redPurple">
          {value ? (
            <img
              src={value}
              alt=""
              className="absolute size-full rounded-full object-cover"
            />
          ) : null}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label={label ? `Upload ${label}` : 'Upload image'}
            className="z-10 cursor-pointer rounded-full bg-foreground/50 p-2 text-background outline-none hover:bg-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed"
          >
            {uploading ? <Spinner /> : <LuCamera className="size-4" />}
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
      </div>

      {label || error ? (
        <div className="text-center">
          {label ? <p className="text-sm font-strong">{label}</p> : null}
          {error ? (
            <p className="mt-1 text-sm text-destructive">{error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { AvatarUploader };
