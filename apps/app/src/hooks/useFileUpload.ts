import { trpc } from '@op/api/client';
import { toast } from '@op/ui/Toast';
import { useCallback, useState } from 'react';

import { uploadFileViaSignedUrl } from '@/lib/uploadViaSignedUrl';

export interface FilePreview {
  id: string;
  file: File;
  url: string;
  uploading: boolean;
  uploaded?: boolean;
  error?: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

interface UseFileUploadOptions {
  acceptedTypes?: string[];
  maxFiles?: number;
  maxSizePerFile?: number;
}

const DEFAULT_ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
];
const DEFAULT_MAX_FILES = 10;
export const DEFAULT_MAX_SIZE = 25 * 1024 * 1024; // 25MB

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

export const useFileUpload = (options: UseFileUploadOptions) => {
  const {
    acceptedTypes = DEFAULT_ACCEPTED_TYPES,
    maxFiles = DEFAULT_MAX_FILES,
    maxSizePerFile = DEFAULT_MAX_SIZE,
  } = options ?? {};

  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const createUploadUrl =
    trpc.posts.createPostAttachmentUploadUrl.useMutation();
  const uploadAttachment = trpc.posts.uploadPostAttachment.useMutation();

  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `That file type is not supported. Accepted types: ${acceptedTypes.map((t) => t.split('/')[1]).join(', ')}`;
    }

    if (file.size > maxSizePerFile) {
      const maxSizeMB = (maxSizePerFile / 1024 / 1024).toFixed(2);
      return `File too large. Maximum size: ${maxSizeMB}MB`;
    }
    return null;
  };

  const uploadFile = async (
    file: File,
  ): Promise<{
    id: string;
    url: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }> => {
    const validationError = validateFile(file);
    if (validationError) {
      toast.error({ message: validationError });
      throw new Error(validationError);
    }

    const previewId = `${Date.now()}-${Math.random()}`;

    const preview: FilePreview = {
      id: previewId,
      file,
      url: URL.createObjectURL(file),
      uploading: true,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    };

    setFilePreviews((prev) => [...prev, preview]);

    try {
      const result = await uploadFileViaSignedUrl(file, {
        createUploadUrl: (args) => createUploadUrl.mutateAsync(args),
        recordUpload: (args) => uploadAttachment.mutateAsync(args),
      });

      setFilePreviews((prev) =>
        prev.map((f) =>
          f.id === previewId
            ? { ...f, uploading: false, uploaded: true, id: result.id }
            : f,
        ),
      );

      return result;
    } catch (error) {
      toast.error({ message: errorMessage(error, 'Upload failed') });
      setFilePreviews((prev) =>
        prev.map((f) => (f.id === previewId ? { ...f, uploading: false } : f)),
      );
      throw error;
    }
  };

  const removeFile = (id: string) => {
    const preview = filePreviews.find((f) => f.id === id);
    if (preview) {
      URL.revokeObjectURL(preview.url);
      setFilePreviews((prev) => prev.filter((f) => f.id !== id));
    }
  };

  const clearFiles = () => {
    filePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    setFilePreviews([]);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);

      if (filePreviews.length + files.length > maxFiles) {
        toast.error({ message: `Maximum ${maxFiles} files allowed` });
        return;
      }

      const validFiles = files.filter((file) =>
        acceptedTypes.includes(file.type),
      );

      const invalidCount = files.length - validFiles.length;
      if (invalidCount > 0) {
        toast.error({
          message: `${invalidCount} file(s) skipped. Supported types: ${acceptedTypes.join(', ')}`,
        });
      }

      for (const file of validFiles) {
        try {
          await uploadFile(file);
        } catch (error) {
          console.error('Failed to upload file:', file.name, error);
        }
      }
    },
    [filePreviews.length, maxFiles, acceptedTypes, uploadFile],
  );

  const getUploadedAttachmentIds = () => {
    return filePreviews.filter((f) => f.uploaded && !f.error).map((f) => f.id);
  };

  const hasUploadedFiles = () => {
    return filePreviews.some((f) => f.uploaded && !f.error);
  };

  const isUploading = () => {
    return filePreviews.some((f) => f.uploading);
  };

  return {
    filePreviews,
    isDragOver,
    uploadFile,
    removeFile,
    clearFiles,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    getUploadedAttachmentIds,
    hasUploadedFiles,
    isUploading,
    acceptedTypes,
    maxFiles,
    maxSizePerFile,
  };
};
