'use client';

import { trpc } from '@op/api/client';
import { FileDropZone } from '@op/ui/FileDropZone';
import { toast } from '@op/ui/Toast';
import { startTransition, useOptimistic } from 'react';

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

interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  url?: string;
  pending?: boolean;
}

type OptimisticAction =
  | { type: 'add'; attachment: Attachment }
  | { type: 'remove'; id: string };

function attachmentsReducer(
  state: Attachment[],
  action: OptimisticAction,
): Attachment[] {
  switch (action.type) {
    case 'add':
      return [...state, { ...action.attachment, pending: true }];
    case 'remove':
      return state.filter((a) => a.id !== action.id);
  }
}

/**
 * Attachment section for proposals.
 */
export function ProposalAttachments({
  proposalId,
  attachments,
  onMutate,
}: {
  proposalId: string;
  attachments: {
    id: string;
    fileName: string;
    fileSize: number | null;
    url?: string;
  }[];
  onMutate: () => void;
}) {
  const t = useTranslations();

  // Normalize attachments to ensure fileSize is always a number
  const normalizedAttachments: Attachment[] = attachments.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    fileSize: a.fileSize ?? 0,
    url: a.url,
  }));

  const [optimisticAttachments, dispatch] = useOptimistic(
    normalizedAttachments,
    attachmentsReducer,
  );

  const uploadMutation = trpc.decision.uploadProposalAttachment.useMutation({
    onSuccess: onMutate,
    onError: (err) => {
      toast.error({ message: err.message });
      onMutate(); // Refetch to clear optimistic state on error
    },
  });

  const deleteMutation = trpc.decision.deleteProposalAttachment.useMutation({
    onSuccess: onMutate,
    onError: (err) => {
      toast.error({ message: err.message });
      onMutate(); // Refetch to restore deleted item on error
    },
  });

  const canAddMore = optimisticAttachments.length < MAX_FILES;

  const handleSelectFiles = (files: File[]) => {
    const remainingSlots = MAX_FILES - optimisticAttachments.length;
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

      const tempId = crypto.randomUUID();

      startTransition(async () => {
        dispatch({
          type: 'add',
          attachment: {
            id: tempId,
            fileName: file.name,
            fileSize: file.size,
          },
        });

        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        await uploadMutation.mutateAsync({
          file: base64,
          fileName: file.name,
          mimeType: file.type,
          proposalId,
        });
      });
    }
  };

  const handleRemove = (id: string) => {
    startTransition(async () => {
      dispatch({ type: 'remove', id });

      await deleteMutation.mutateAsync({ attachmentId: id, proposalId });
    });
  };

  const displayFiles = optimisticAttachments.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    fileSize: a.fileSize,
    uploading: a.pending ?? false,
    url: a.url,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="font-serif text-title-sm text-neutral-charcoal">
          {t('Attachments (optional)')}
        </span>
        <p className="text-body-sm text-neutral-charcoal">
          {t(
            'Support your proposal with relevant documents like budgets or supporting research.',
          )}
        </p>
      </div>

      <ProposalAttachmentList files={displayFiles} onRemove={handleRemove} />

      <FileDropZone
        acceptedFileTypes={ACCEPTED_EXTENSIONS}
        onSelectFiles={handleSelectFiles}
        description={t('Accepts PDF, DOCX, XLSX up to {size}MB', {
          size: MAX_SIZE_MB,
        })}
        allowsMultiple
        isDisabled={!canAddMore}
      />

      <p className="text-sm text-neutral-gray4">
        {t('{count}/{max} attachments added', {
          count: optimisticAttachments.length,
          max: MAX_FILES,
        })}
      </p>
    </div>
  );
}
