'use client';

import { useRef } from 'react';
import { LuCamera } from 'react-icons/lu';

import { Header2 } from './Header';
import { LoadingSpinner } from './LoadingSpinner';
import { cn } from '../lib/utils';

export const BannerUploader = ({
  label,
  value,
  onChange,
  uploading = false,
  error = null,
}: {
  label?: string;
  value?: string | null;
  onChange?: (file: File) => Promise<void> | void;
  uploading?: boolean;
  error?: string | null;
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    if (onChange && file) {
      onChange(file);
    }
  };

  return (
    <div className="bg-offWhite relative flex aspect-[128/55] w-full flex-col items-center justify-center">
      <div className="size-full">
        <div className="bg-yellowOrange relative flex size-full items-center justify-center bg-center">
          {value ? (
            <img
              src={value}
              alt="Profile"
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
            className="z-10 rounded-full bg-black/50 p-2 text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {uploading ? (
              <LoadingSpinner />
            ) : (
              <LuCamera className="stroke-offWhite" />
            )}
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

      <div className="text-center">
        <Header2 className="text-xs">{label}</Header2>
        {error && <p className="text-destructive mt-2">{error}</p>}
      </div>
    </div>
  );
};
