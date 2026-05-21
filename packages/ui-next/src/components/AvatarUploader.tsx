'use client';

import { useRef } from 'react';
import { LuCamera } from 'react-icons/lu';

import { Header2 } from './Header';
import { LoadingSpinner } from './LoadingSpinner';
import { cn } from '../lib/utils';

interface ImageUploaderProps {
  label?: string;
  value?: string | null;
  onChange?: (file: File) => Promise<void> | void;
  uploading?: boolean;
  error?: string | null;
  className?: string;
}

export const AvatarUploader = ({
  label,
  value,
  onChange,
  uploading = false,
  className,
}: ImageUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    if (onChange && file) {
      onChange(file);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2',
        uploading && 'opacity-20',
        className,
      )}
    >
      <div className="size-full">
        <div className="bg-redPurple relative flex aspect-square size-full items-center justify-center rounded-full border-4 border-white">
          {value ? (
            <img
              src={value}
              alt="Profile"
              className="absolute size-full rounded-full object-cover"
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
        <Header2 className="text-sm">{label}</Header2>
      </div>
    </div>
  );
};
