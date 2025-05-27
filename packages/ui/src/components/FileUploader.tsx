import { useCallback, useRef, useState } from 'react';
import { useButton } from 'react-aria';
import { LuX } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { LoadingSpinner } from './LoadingSpinner';
import { MediaDisplay } from './MediaDisplay';

interface FilePreview {
  id: string;
  file: File;
  url: string;
  uploading: boolean;
  uploaded?: boolean;
  error?: string | null;
}

interface FileUploaderProps {
  onUpload: (file: File) => Promise<{
    id: string;
    url: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }>;
  onRemove?: (id: string) => void;
  maxFiles?: number;
  maxSizePerFile?: number; // in bytes
  acceptedTypes?: string[];
  className?: string;
  children?: React.ReactNode;
}

const ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

export const FileUploader = ({
  onUpload,
  onRemove,
  maxFiles = MAX_FILES,
  maxSizePerFile = MAX_FILE_SIZE,
  acceptedTypes = ACCEPTED_TYPES,
  className,
  children,
}: FileUploaderProps) => {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const { buttonProps } = useButton(
    {
      onPress: () => fileInputRef.current?.click(),
      isDisabled: files.length >= maxFiles,
    },
    buttonRef,
  );

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `File type ${file.type} not supported. Accepted types: ${acceptedTypes.join(', ')}`;
    }
    if (file.size > maxSizePerFile) {
      return `File too large. Maximum size: ${formatFileSize(maxSizePerFile)}`;
    }
    return null;
  };

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files || []);

      if (selectedFiles.length === 0) return;

      // Check if adding these files would exceed max files
      if (files.length + selectedFiles.length > maxFiles) {
        alert(`Maximum ${maxFiles} files allowed`);
        return;
      }

      // Create preview objects
      const newPreviews: FilePreview[] = selectedFiles.map((file) => {
        const error = validateFile(file);
        return {
          id: `${Date.now()}-${Math.random()}`,
          file,
          url: URL.createObjectURL(file),
          uploading: !error,
          error,
        };
      });

      setFiles((prev) => [...prev, ...newPreviews]);

      // Upload valid files
      for (const preview of newPreviews) {
        if (!preview.error) {
          try {
            const result = await onUpload(preview.file);
            setFiles((prev) =>
              prev.map((f) =>
                f.id === preview.id
                  ? { ...f, uploading: false, uploaded: true, id: result.id }
                  : f,
              ),
            );
          } catch (error) {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === preview.id
                  ? {
                      ...f,
                      uploading: false,
                      error:
                        error instanceof Error
                          ? error.message
                          : 'Upload failed',
                    }
                  : f,
              ),
            );
          }
        }
      }

      // Clear input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [files.length, maxFiles, onUpload, acceptedTypes, maxSizePerFile],
  );

  const handleRemove = useCallback(
    (id: string) => {
      const file = files.find((f) => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.url);
        setFiles((prev) => prev.filter((f) => f.id !== id));
        onRemove?.(id);
      }
    },
    [files, onRemove],
  );

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      {/* Upload Button */}
      <button
        {...buttonProps}
        ref={buttonRef}
        className={cn(
          'flex items-center gap-2 text-sm text-charcoal transition-colors hover:text-black',
          files.length >= maxFiles && 'cursor-not-allowed opacity-50',
        )}
        disabled={files.length >= maxFiles}
      >
        {children}
      </button>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={acceptedTypes.join(',')}
        multiple={maxFiles > 1}
        className="hidden"
      />

      {/* File Previews */}
      {files.length > 0 && (
        <div className="flex w-full flex-col gap-2">
          {files.map((filePreview) => (
            <MediaDisplay
              key={filePreview.id}
              title={filePreview.file.name}
              mimeType={filePreview.file.type}
            >
              <div className="relative flex aspect-video w-full items-center justify-center rounded bg-orangePurple text-white">
                {filePreview.uploading && <LoadingSpinner size="md" />}
                {filePreview.error && (
                  <p className="text-title-sm">{filePreview.error}</p>
                )}
                {!filePreview.uploading &&
                  (filePreview.file.type.startsWith('image/') ? (
                    <img
                      src={filePreview.url}
                      alt={filePreview.file.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="font-serif text-title-md">
                      {filePreview.file.name}
                    </div>
                  ))}
                <button
                  onClick={() => handleRemove(filePreview.id)}
                  className="absolute right-4 top-4"
                  disabled={filePreview.uploading}
                >
                  <LuX className="size-3" />
                </button>
              </div>
            </MediaDisplay>
          ))}
        </div>
      )}
    </div>
  );
};
