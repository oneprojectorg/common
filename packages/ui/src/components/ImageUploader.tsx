// import { createClient } from '@supabase/supabase-js';
import { Camera } from 'lucide-react';
import { useRef, useState } from 'react';
import { useButton } from 'react-aria';

// const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const ImageUploader = ({ label }: { label?: string }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const buttonRef = useRef(null);

  const { buttonProps } = useButton(
    {
      onPress: () => fileInputRef.current?.click(),
    },
    buttonRef,
  );

  const uploadImage = async (event) => {
    try {
      setUploading(true);
      setError(null);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload the file to Supabase Storage
      // const { data, error } = await supabase.storage
      // .from('profile-pictures')
      // .upload(filePath, file);

      // if (error) {
      // throw error;
      // }

      // Get the public URL
      // const { data: urlData } = supabase.storage
      // .from('profile-pictures')
      // .getPublicUrl(filePath);

      // setImageUrl(urlData.publicUrl);
    } catch (error) {
      setError(error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="size-32">
        {imageUrl ? (
          <img
            src={imageUrl}
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
          onChange={uploadImage}
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
