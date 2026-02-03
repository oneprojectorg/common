'use client';

import { useProposalFileUpload } from '@/hooks/useProposalFileUpload';
import { FileDropZone } from '@op/ui/FileDropZone';

import { useTranslations } from '@/lib/i18n';

import { ProposalAttachmentList } from './ProposalAttachmentList';

const MAX_FILES = 5;
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.xlsx'];

export interface ProposalAttachmentsProps {
  /** Callback to get uploaded attachment IDs for form submission */
  onAttachmentsChange?: (attachmentIds: string[]) => void;
}

/**
 * Complete attachment section for proposals.
 * Includes file drop zone and attachment list with upload handling.
 */
export function ProposalAttachments({
  onAttachmentsChange,
}: ProposalAttachmentsProps) {
  const t = useTranslations();

  const fileUpload = useProposalFileUpload({
    acceptedTypes: ACCEPTED_TYPES,
    maxFiles: MAX_FILES,
    maxSizePerFile: MAX_SIZE_BYTES,
  });

  const handleSelectFiles = async (files: File[]) => {
    const remainingSlots = MAX_FILES - fileUpload.filePreviews.length;
    const filesToUpload = files.slice(0, remainingSlots);

    for (const file of filesToUpload) {
      try {
        await fileUpload.uploadFile(file);
        // Notify parent of new attachment IDs after each upload
        onAttachmentsChange?.(fileUpload.getUploadedAttachmentIds());
      } catch {
        // Error handling is done in the hook
      }
    }

    // Final update after all uploads complete
    onAttachmentsChange?.(fileUpload.getUploadedAttachmentIds());
  };

  const handleRemoveFile = (id: string) => {
    fileUpload.removeFile(id);
    // Get IDs after removal - need to filter manually since state update is async
    const remainingIds = fileUpload.filePreviews
      .filter((f) => f.id !== id && f.uploaded && !f.error)
      .map((f) => f.id);
    onAttachmentsChange?.(remainingIds);
  };

  const canAddMore = fileUpload.filePreviews.length < MAX_FILES;
  const fileCount = fileUpload.filePreviews.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-medium text-neutral-charcoal">
          {t('Attachments (optional)')}
        </h3>
        <p className="text-sm text-neutral-gray4">
          {t(
            'Support your proposal with relevant documents like budgets or supporting research.',
          )}
        </p>
      </div>

      {/* List of uploaded files */}
      <ProposalAttachmentList
        files={fileUpload.filePreviews}
        onRemove={handleRemoveFile}
      />

      {/* Drop zone */}
      <FileDropZone
        acceptedFileTypes={ACCEPTED_EXTENSIONS}
        onSelectFiles={handleSelectFiles}
        description={t('Accepts PDF, DOCX, XLSX up to {size}MB', {
          size: MAX_SIZE_MB,
        })}
        allowsMultiple={true}
        isDisabled={!canAddMore || fileUpload.isUploading()}
      />

      {/* Counter */}
      <p className="text-sm text-neutral-gray4">
        {t('{count}/{max} attachments added', {
          count: fileCount,
          max: MAX_FILES,
        })}
      </p>
    </div>
  );
}

/**
 * Hook to access the attachment IDs for form submission.
 * Use this alongside ProposalAttachments when you need programmatic access.
 */
export { useProposalFileUpload };
