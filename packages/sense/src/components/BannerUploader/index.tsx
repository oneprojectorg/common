'use client';

import * as React from 'react';
import { LuCamera } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { Spinner } from '../ui/spinner';

interface BannerUploaderProps {
  label?: string;
  /** Current image URL, if one is set. */
  value?: string | null;
  onChange?: (file: File) => Promise<void> | void;
  uploading?: boolean;
  error?: string | null;
}

function BannerUploader({
  label,
  value,
  onChange,
  uploading = false,
  error = null,
}: BannerUploaderProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onChange) {
      onChange(file);
    }
  };

  return (
    <div
      data-slot="banner-uploader"
      className="relative flex aspect-[128/55] w-full flex-col items-center justify-center bg-muted"
    >
      <div className="size-full">
        <div className="relative flex size-full items-center justify-center bg-yellowOrange bg-center">
          {value ? (
            <img
              src={value}
              alt=""
              className={cn(
                'absolute size-full object-cover',
                uploading && 'opacity-20',
              )}
            />
          ) : null}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label={label ?? 'Upload banner'}
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

      {(label || error) && (
        <div className="text-center">
          {label ? <p className="text-xs font-strong">{label}</p> : null}
          {error ? (
            <p className="mt-2 text-sm text-destructive">{error}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export { BannerUploader };
