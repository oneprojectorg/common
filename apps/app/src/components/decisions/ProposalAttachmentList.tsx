'use client';

import { Button } from '@op/sense/Button';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalAttachmentRow } from './ProposalAttachmentRow';

export interface AttachmentListItem {
  id: string;
  fileName: string;
  fileSize: number;
  uploading: boolean;
  url?: string;
}

/**
 * Displays a list of file attachments for a proposal with remove buttons.
 * Handles loading states during upload and shows file metadata.
 *
 * Omit `onRemove` for a read-only list: the rows (and their download links) stay,
 * the remove affordance is dropped rather than rendered disabled.
 */
export function ProposalAttachmentList({
  files,
  onRemove,
}: {
  files: AttachmentListItem[];
  onRemove?: (id: string) => void;
}) {
  const t = useTranslations();

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {files.map((file) => (
        <ProposalAttachmentRow
          key={file.id}
          fileName={file.fileName}
          fileSize={file.fileSize}
          url={file.url}
          isUploading={file.uploading}
          trailing={
            onRemove ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onRemove(file.id)}
                disabled={file.uploading}
                aria-label={t('Remove {name}', { name: file.fileName })}
              >
                <LuX className="size-4" />
              </Button>
            ) : undefined
          }
        />
      ))}
    </div>
  );
}
