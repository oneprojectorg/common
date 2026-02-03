'use client';

import type { FilePreview } from '@/hooks/useProposalFileUpload';
import { Button } from '@op/ui/Button';
import { Skeleton } from '@op/ui/Skeleton';
import { LuFile, LuX } from 'react-icons/lu';

function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

export interface ProposalAttachmentListProps {
  files: FilePreview[];
  onRemove: (id: string) => void;
}

/**
 * Displays a list of file attachments for a proposal with remove buttons.
 * Handles loading states during upload and shows file metadata.
 */
export function ProposalAttachmentList({
  files,
  onRemove,
}: ProposalAttachmentListProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center gap-4 rounded-xl border border-neutral-gray2 bg-white px-4 py-3"
        >
          {/* File icon */}
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-neutral-gray1">
            <LuFile className="size-5 text-neutral-gray4" />
          </div>

          {/* File info */}
          <div className="flex min-w-0 flex-1 flex-col">
            {file.uploading ? (
              <>
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-1 h-3 w-20" />
              </>
            ) : (
              <>
                <span className="truncate text-base font-medium text-neutral-charcoal">
                  {file.fileName}
                </span>
                <span className="text-sm text-neutral-gray4">
                  {formatFileSize(file.fileSize)}
                </span>
              </>
            )}
          </div>

          {/* Remove button */}
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
        </div>
      ))}
    </div>
  );
}
