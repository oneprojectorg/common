import type { RouterOutput } from '@op/api';
import { formatFileSize } from '@op/ui/utils';
import { LuDownload, LuFileText } from 'react-icons/lu';

type ProposalAttachment = NonNullable<
  RouterOutput['decision']['getProposal']['attachments']
>[number];

/**
 * Displays a read-only list of file attachments for viewing a proposal.
 * Shows file name, size, and download link - no edit controls.
 */
export function ProposalAttachmentViewList({
  attachments,
}: {
  attachments: ProposalAttachment[];
}) {
  const files = attachments.flatMap((a) =>
    a.attachment
      ? [
          {
            id: a.id,
            fileName: a.attachment.fileName,
            fileSize: a.attachment.fileSize ?? 0,
            url: a.attachment.url,
          },
        ]
      : [],
  );
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
          </div>

          {/* Download indicator */}
          {file.url && (
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              download={file.fileName}
              className="shrink-0 text-neutral-gray4 hover:text-primary-teal"
              aria-label={`Download ${file.fileName}`}
            >
              <LuDownload className="size-5" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
