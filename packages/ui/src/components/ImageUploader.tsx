// @ts-nocheck - This is a STUB. Fixing this up shortly
// import { createClient } from '@supabase/supabase-js';
import { Camera } from 'lucide-react';
import { useRef, useState } from 'react';
import { useButton } from 'react-aria';

// const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ImageUploaderProps {
  label?: string;
  value?: string | null;
  onChange?: (file: File) => void;
  uploading?: boolean;
  error?: string | null;
}

export const ImageUploader = ({ label, value, onChange, uploading = false, error = null }: ImageUploaderProps) => {
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
    if (onChange) {
      onChange(file);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="size-32">
        {value ? (
          <img
            src={value}
            alt="Profile"
            className="size-full rounded-full border-4 border-gray-200 object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center rounded-full bg-lightGray">
            <button
              {...buttonProps}
              ref={buttonRef}
              className="rounded-full bg-black/50 p-2 text-white hover:bg-neutral-800"
              disabled={uploading}
            >
              <Camera className="stroke-offWhite stroke-1" />
            </button>
          </div>
        )} 

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
        {uploading && <p className="mt-2 text-blue-500">Uploading...</p>}
      </div>
    </div>
  );
};
