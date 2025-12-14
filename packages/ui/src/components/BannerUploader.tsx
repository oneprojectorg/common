import { Camera } from 'lucide-react';
import { useRef } from 'react';
import { useButton } from 'react-aria';

import { cn } from '../lib/utils';
import { LoadingSpinner } from './LoadingSpinner';

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
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const { buttonProps } = useButton(
    {
      onPress: () => fileInputRef.current?.click(),
    },
    buttonRef,
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];

    if (onChange && file) {
      onChange(file);
    }
  };

  return (
    <div className="relative flex aspect-[128/55] w-full flex-col items-center justify-center bg-offWhite">
      <div className="size-full">
        <div className="relative flex size-full items-center justify-center bg-yellowOrange bg-center">
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
            {...buttonProps}
            ref={buttonRef}
            className="z-10 rounded-full bg-black/50 p-2 text-white hover:bg-neutral-800"
            disabled={uploading}
          >
            {uploading ? (
              <LoadingSpinner />
            ) : (
              <Camera className="stroke-offWhite" />
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
        <h2 className="text-xs">{label}</h2>
        {error && <p className="mt-2 text-red-500">{error}</p>}
      </div>
    </div>
  );
};
