'use client';

import { trpc } from '@op/api/client';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_PROPOSAL_ATTACHMENT_FILE_SIZE,
  isAllowedUploadMimeType,
} from '@op/common/client';
import { FileDropZone } from '@op/sense/FileDropZone';
import { toast } from '@op/sense/Toast';
import { type ReactNode, startTransition, useOptimistic } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ProposalAttachmentList } from './ProposalAttachmentList';
import { LabeledFieldSet } from './forms/LabeledFieldSet';

const MAX_FILES = 5;
const MAX_SIZE_MB = Math.floor(MAX_PROPOSAL_ATTACHMENT_FILE_SIZE / 1024 / 1024);

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

  const signUrlMutation =
    trpc.decision.signProposalAttachmentUploadUrl.useMutation();
  const recordMutation = trpc.decision.uploadProposalAttachment.useMutation({
    onSuccess: onMutate,
    onError: (err) => {
      toast.error(err.message);
      onMutate(); // Refetch to clear optimistic state on error
    },
  });

  const deleteMutation = trpc.decision.deleteProposalAttachment.useMutation({
    onSuccess: onMutate,
    onError: (err) => {
      toast.error(err.message);
      onMutate(); // Refetch to restore deleted item on error
    },
  });

  const canAddMore = optimisticAttachments.length < MAX_FILES;

  const handleSelectFiles = (files: File[]) => {
    const remainingSlots = MAX_FILES - optimisticAttachments.length;
    const filesToUpload = files.slice(0, remainingSlots);

    for (const file of filesToUpload) {
      if (file.size > MAX_PROPOSAL_ATTACHMENT_FILE_SIZE) {
        toast.error(t('File too large: {name}', { name: file.name }));
        continue;
      }
      const mimeType = file.type;
      if (!isAllowedUploadMimeType(mimeType)) {
        toast.error(t('Unsupported file type: {name}', { name: file.name }));
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

        try {
          // Sign → PUT direct to storage → record. PUTing the file binary
          // avoids the serverless body-size limit that previously broke
          // larger iPhone photos when we round-tripped them as base64 JSON.
          const signed = await signUrlMutation.mutateAsync({
            proposalId,
            fileName: file.name,
          });

          const putRes = await fetch(signed.signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': mimeType },
            body: file,
          });
          if (!putRes.ok) {
            throw new Error(t('Could not upload attachment'));
          }

          await recordMutation.mutateAsync({
            storagePath: signed.storagePath,
            fileName: file.name,
            mimeType,
            proposalId,
          });
        } catch (err) {
          toast.error(
            err instanceof Error
              ? err.message
              : t('Could not upload attachment'),
          );
          onMutate();
        }
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
    <LabeledFieldSet
      legend={t('Attachments ({count}/{max})', {
        count: optimisticAttachments.length,
        max: MAX_FILES,
      })}
      description={t(
        'Support your proposal with relevant documents like budgets or supporting research.',
      )}
    >
      <ProposalAttachmentList files={displayFiles} onRemove={handleRemove} />

      <FileDropZone
        acceptedFileTypes={[...ALLOWED_UPLOAD_MIME_TYPES]}
        onSelectFiles={handleSelectFiles}
        label={t.rich('Drag a file here or <browse>browse</browse>', {
          browse: (chunks: ReactNode) => (
            <span className="text-primary hover:underline">{chunks}</span>
          ),
        })}
        // Figma reads "Accepts PDF, DOCX, XLSX up to 10MB" (no MP4, no "and
        // more"); the code list is kept as the source of truth for what upload
        // actually accepts — copy delta flagged, not applied.
        description={t('Accepts {types} and more up to {size}MB', {
          types: 'MP4, PDF, DOCX, XLSX',
          size: MAX_SIZE_MB,
        })}
        allowsMultiple
        disabled={!canAddMore}
      />
    </LabeledFieldSet>
  );
}
