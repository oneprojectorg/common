'use client';

import { Button } from '@op/ui/Button';
import { LuX } from 'react-icons/lu';

import { ProposalAttachmentFileCard } from './ProposalAttachmentFileCard';

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
 */
export function ProposalAttachmentList({
  files,
  onRemove,
}: {
  files: AttachmentListItem[];
  onRemove: (id: string) => void;
}) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {files.map((file) => (
        <ProposalAttachmentFileCard
          key={file.id}
          fileName={file.fileName}
          fileSize={file.fileSize}
          url={file.url}
          isUploading={file.uploading}
          trailing={
            <Button
              color="ghost"
              size="small"
              onPress={() => onRemove(file.id)}
              isDisabled={file.uploading}
              className="shrink-0"
              aria-label={`Remove ${file.fileName}`}
            >
              <LuX className="size-5" />
            </Button>
          }
        />
      ))}
    </div>
  );
}
