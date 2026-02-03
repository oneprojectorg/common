'use client';

import { trpc } from '@op/api/client';
import { FileDropZone } from '@op/ui/FileDropZone';
import { toast } from '@op/ui/Toast';
import { useState } from 'react';

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

/**
 * Attachment section for proposals.
 * Renders attachments from getProposal and handles upload/delete.
 */
export function ProposalAttachments({
  proposalId,
  attachments,
  onMutate,
}: {
  proposalId: string;
  attachments: { id: string; fileName: string; fileSize: number | null }[];
  onMutate: () => void;
}) {
  const t = useTranslations();
  const [uploadingFiles, setUploadingFiles] = useState<
    { id: string; fileName: string; fileSize: number }[]
  >([]);

  const uploadMutation = trpc.decision.uploadProposalAttachment.useMutation({
    onSuccess: () => {
      onMutate();
      setUploadingFiles([]);
    },
    onError: (err) => {
      toast.error({ message: err.message });
      setUploadingFiles([]);
    },
  });

  const deleteMutation = trpc.decision.deleteProposalAttachment.useMutation({
    onSuccess: onMutate,
    onError: (err) => toast.error({ message: err.message }),
  });

  const totalCount = attachments.length + uploadingFiles.length;
  const canAddMore = totalCount < MAX_FILES;

  const handleSelectFiles = async (files: File[]) => {
    const remainingSlots = MAX_FILES - totalCount;
    const filesToUpload = files.slice(0, remainingSlots);

    for (const file of filesToUpload) {
      if (file.size > MAX_SIZE_BYTES) {
        toast.error({ message: `File too large: ${file.name}` });
        continue;
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error({ message: `Unsupported file type: ${file.name}` });
        continue;
      }

      const tempId = `uploading-${Date.now()}`;
      setUploadingFiles((prev) => [
        ...prev,
        { id: tempId, fileName: file.name, fileSize: file.size },
      ]);

      const reader = new FileReader();
      reader.onload = () => {
        uploadMutation.mutate({
          file: reader.result as string,
          fileName: file.name,
          mimeType: file.type,
          proposalId,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemove = (id: string) => {
    deleteMutation.mutate({ attachmentId: id, proposalId });
  };

  const allFiles = [
    ...attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileSize: a.fileSize ?? 0,
      uploading: false,
    })),
    ...uploadingFiles.map((f) => ({ ...f, uploading: true })),
  ];

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

      <ProposalAttachmentList files={allFiles} onRemove={handleRemove} />

      <FileDropZone
        acceptedFileTypes={ACCEPTED_EXTENSIONS}
        onSelectFiles={handleSelectFiles}
        description={t('Accepts PDF, DOCX, XLSX up to {size}MB', {
          size: MAX_SIZE_MB,
        })}
        allowsMultiple
        isDisabled={!canAddMore || uploadMutation.isPending}
      />

      <p className="text-sm text-neutral-gray4">
        {t('{count}/{max} attachments added', {
          count: totalCount,
          max: MAX_FILES,
        })}
      </p>
    </div>
  );
}
