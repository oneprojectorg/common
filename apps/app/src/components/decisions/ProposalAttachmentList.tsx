'use client';

import { Button } from '@op/ui/Button';
import { Skeleton } from '@op/ui/Skeleton';
import { formatFileSize } from '@op/ui/utils';
import { LuFileText, LuX } from 'react-icons/lu';

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
        <div
          key={file.id}
          className="flex items-center gap-4 rounded-lg border border-neutral-gray1 bg-white p-4"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-tealWhite">
            <LuFileText className="size-5 text-neutral-gray4" />
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
                {file.url ? (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={file.fileName}
                    className="truncate text-base font-medium text-neutral-charcoal hover:text-primary-teal hover:underline"
                  >
                    {file.fileName}
                  </a>
                ) : (
                  <span className="truncate text-base font-medium text-neutral-charcoal">
                    {file.fileName}
                  </span>
                )}
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
