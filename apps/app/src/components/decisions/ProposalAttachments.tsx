'use client';

import { trpc } from '@op/api/client';
import { createSBBrowserClient } from '@op/supabase/client';
import { FileDropZone } from '@op/ui/FileDropZone';
import { toast } from '@op/ui/Toast';
import { type ReactNode, startTransition, useOptimistic } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ProposalAttachmentList } from './ProposalAttachmentList';

const MAX_FILES = 5;
const MAX_SIZE_MB = 25;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'video/mp4',
];

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

  const createUploadUrlMutation =
    trpc.decision.createProposalAttachmentUploadUrl.useMutation();
  const uploadMutation = trpc.decision.uploadProposalAttachment.useMutation({
    onSuccess: onMutate,
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
        toast.error({
          message: t('File too large: {name}', { name: file.name }),
        });
        continue;
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error({
          message: t('Unsupported file type: {name}', { name: file.name }),
        });
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
          const { path, token } = await createUploadUrlMutation.mutateAsync({
            fileName: file.name,
            mimeType: file.type,
            proposalId,
          });

          const supabase = createSBBrowserClient();
          const { error: uploadError } = await supabase.storage
            .from('assets')
            .uploadToSignedUrl(path, token, file, {
              contentType: file.type,
              upsert: false,
            });

          if (uploadError) {
            throw new Error(uploadError.message);
          }

          await uploadMutation.mutateAsync({
            path,
            fileName: file.name,
            mimeType: file.type,
            fileSize: file.size,
            proposalId,
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : t('Upload failed');
          toast.error({ message });
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="font-serif text-title-sm14 text-neutral-charcoal">
          {t('Attachments (optional)')}
        </span>
        <p className="text-sm text-neutral-charcoal">
          {t(
            'Support your proposal with relevant documents like budgets or supporting research.',
          )}
        </p>
      </div>

      <ProposalAttachmentList files={displayFiles} onRemove={handleRemove} />

      <FileDropZone
        acceptedFileTypes={ACCEPTED_TYPES}
        onSelectFiles={handleSelectFiles}
        label={t.rich('Drag a file here or <browse>browse</browse>', {
          browse: (chunks: ReactNode) => (
            <span className="text-primary-teal hover:text-primary-tealBlack hover:underline">
              {chunks}
            </span>
          ),
        })}
        description={t('Accepts {types} and more up to {size}MB', {
          types: 'MP4, PDF, DOCX, XLSX',
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
