import { trpc } from '@op/api/client';
import { toast } from '@op/ui/Toast';
import { useCallback, useState } from 'react';

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

interface UseProposalFileUploadOptions {
  /** The proposal to link attachments to (required for proposal attachments, optional for inline images) */
  proposalId?: string;
  acceptedTypes?: string[];
  maxFiles?: number;
  maxSizePerFile?: number;
  /** Called after successful upload or delete */
  onMutationSuccess?: () => void;
}

const DEFAULT_ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
];
const DEFAULT_MAX_FILES = 10;
export const DEFAULT_MAX_SIZE = 4 * 1024 * 1024; // 4MB

export const useProposalFileUpload = (
  options: UseProposalFileUploadOptions,
) => {
  const {
    proposalId,
    acceptedTypes = DEFAULT_ACCEPTED_TYPES,
    maxFiles = DEFAULT_MAX_FILES,
    maxSizePerFile = DEFAULT_MAX_SIZE,
    onMutationSuccess,
  } = options ?? {};

  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const uploadAttachment = trpc.decision.uploadProposalAttachment.useMutation({
    onSuccess: onMutationSuccess,
  });
  const deleteAttachment = trpc.decision.deleteProposalAttachment.useMutation({
    onSuccess: onMutationSuccess,
    onError: (error) => toast.error({ message: error.message }),
  });

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
      toast.status({ code: 500, message: validationError });
      throw new Error(validationError);
    }

    const previewId = crypto.randomUUID();

    // Create initial preview
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
      // Convert file to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      const result = await uploadAttachment
        .mutateAsync({
          file: base64,
          fileName: file.name,
          mimeType: file.type,
          proposalId,
        })
        .catch((err) => {
          toast.status(err);
          throw err;
        });

      // Update preview with success
      setFilePreviews((prev) =>
        prev.map((f) =>
          f.id === previewId
            ? { ...f, uploading: false, uploaded: true, id: result.id }
            : f,
        ),
      );

      return result;
    } catch (error) {
      // Update preview with error
      setFilePreviews((prev) =>
        prev.map((f) =>
          f.id === previewId
            ? {
                ...f,
                uploading: false,
              }
            : f,
        ),
      );
      throw error;
    }
  };

  const removeFile = (id: string) => {
    const preview = filePreviews.find((f) => f.id === id);
    if (!preview) {
      return;
    }

    URL.revokeObjectURL(preview.url);
    setFilePreviews((prev) => prev.filter((f) => f.id !== id));

    // If uploaded and linked to a proposal, also delete from backend
    if (preview.uploaded && proposalId) {
      deleteAttachment.mutate({ attachmentId: id, proposalId });
    }
  };

  const clearFiles = () => {
    for (const preview of filePreviews) {
      URL.revokeObjectURL(preview.url);
    }
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
    // Only set drag over to false if we're leaving the main container
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

      // Check file limit
      if (filePreviews.length + files.length > maxFiles) {
        alert(`Maximum ${maxFiles} files allowed`);
        return;
      }

      const validFiles = files.filter((file) =>
        acceptedTypes.includes(file.type),
      );

      if (validFiles.length === 0) {
        alert(
          `Please drop only supported file types: ${acceptedTypes.join(', ')}`,
        );
        return;
      }

      // Upload each valid file
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
    // State
    filePreviews,
    isDragOver,

    // Actions
    uploadFile,
    removeFile,
    clearFiles,

    // Drag and drop handlers
    handleDragOver,
    handleDragLeave,
    handleDrop,

    // Computed values
    getUploadedAttachmentIds,
    hasUploadedFiles,
    isUploading,

    // Configuration
    acceptedTypes,
    maxFiles,
    maxSizePerFile,
  };
};
