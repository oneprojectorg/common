import { Skeleton } from '@op/ui/Skeleton';
import { formatFileSize } from '@op/ui/utils';
import { ReactNode } from 'react';
import { LuFileText } from 'react-icons/lu';

/**
 * Shared file-card layout used by both the read-only view list and the
 * editable upload list. Renders the file icon, name (as a download link when a
 * URL is present), and size, with a caller-supplied `trailing` slot for the
 * right-side action (download, remove, etc.). Set `isUploading` to swap the
 * name+size for skeletons during an in-flight upload.
 */
export function ProposalAttachmentFileCard({
  fileName,
  fileSize,
  url,
  trailing,
  isUploading,
}: {
  fileName: string;
  fileSize: number;
  url?: string;
  trailing?: ReactNode;
  isUploading?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-neutral-gray1 bg-white p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-tealWhite">
        <LuFileText className="size-5 text-neutral-gray4" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {isUploading ? (
          <>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-1 h-3 w-20" />
          </>
        ) : (
          <>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                download={fileName}
                className="truncate text-base font-medium text-neutral-charcoal hover:text-primary-teal hover:underline"
              >
                {fileName}
              </a>
            ) : (
              <span className="truncate text-base font-medium text-neutral-charcoal">
                {fileName}
              </span>
            )}
            <span className="text-sm text-neutral-gray4">
              {formatFileSize(fileSize)}
            </span>
          </>
        )}
      </div>

      {trailing}
    </div>
  );
}
