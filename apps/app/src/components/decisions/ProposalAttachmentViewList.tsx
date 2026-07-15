import type { Proposal } from '@op/api/encoders';
import { MediaDisplay } from '@op/ui/MediaDisplay';
import { LuDownload } from 'react-icons/lu';

import { AttachmentImage } from '../AttachmentImage';
import { ProposalAttachmentFileCard } from './ProposalAttachmentFileCard';

type ProposalAttachment = NonNullable<Proposal['attachments']>[number];

/**
 * Displays a read-only list of file attachments for viewing a proposal.
 * Images render an inline preview via the same `MediaDisplay` + `AttachmentImage`
 * pair used by posts; other files fall back to a file card with a download link.
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
            mimeType: a.attachment.mimeType,
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
      {files.map((file) =>
        file.mimeType.startsWith('image/') && file.url ? (
          <MediaDisplay
            key={file.id}
            title={file.fileName}
            mimeType={file.mimeType}
            url={file.url}
            size={file.fileSize}
          >
            <AttachmentImage
              mimeType={file.mimeType}
              fileName={file.fileName}
              url={file.url}
            />
          </MediaDisplay>
        ) : (
          <ProposalAttachmentFileCard
            key={file.id}
            fileName={file.fileName}
            fileSize={file.fileSize}
            url={file.url}
            trailing={
              file.url ? (
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
              ) : null
            }
          />
        ),
      )}
    </div>
  );
}
