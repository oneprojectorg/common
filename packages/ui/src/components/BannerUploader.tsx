import { Camera } from 'lucide-react';
import { useRef } from 'react';
import { useButton } from 'react-aria';

import { cn } from '../lib/utils';

interface ImageUploaderProps {
  label?: string;
  value?: string | null;
  onChange?: (file: File) => Promise<void> | void;
  uploading?: boolean;
  error?: string | null;
  className?: string;
}

export const BannerUploader = ({
  label,
  value,
  onChange,
  uploading = false,
  className,
  error = null,
}: ImageUploaderProps) => {
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
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        uploading && 'opacity-20',
        className,
      )}
    >
      <div className="size-full">
        <div className="relative flex size-full items-center justify-center bg-redTeal bg-center">
          {value ? (
            <img
              src={value}
              alt="Profile"
              className="absolute size-full object-cover"
            />
          ) : null}
          <button
            {...buttonProps}
            ref={buttonRef}
            className="z-10 rounded-full bg-black/50 p-2 text-white hover:bg-neutral-800"
            disabled={uploading}
          >
            <Camera className="stroke-offWhite stroke-1" />
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
