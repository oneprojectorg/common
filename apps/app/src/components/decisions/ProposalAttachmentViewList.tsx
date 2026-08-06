'use client';

import type { Proposal } from '@op/common/client';
import { LuDownload } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '../ButtonLink';
import { ProposalAttachmentRow } from './ProposalAttachmentRow';

type ProposalAttachment = NonNullable<Proposal['attachments']>[number];

/**
 * Displays a read-only list of file attachments for viewing a proposal.
 * Shows file name, type + size, and a download button - no edit controls.
 */
export function ProposalAttachmentViewList({
  attachments,
}: {
  attachments: ProposalAttachment[];
}) {
  const t = useTranslations();

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
        <ProposalAttachmentRow
          key={file.id}
          fileName={file.fileName}
          fileSize={file.fileSize}
          url={file.url}
          trailing={
            file.url ? (
              <ButtonLink
                variant="ghost"
                size="icon-sm"
                aria-label={t('Download {name}', { name: file.fileName })}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                download={file.fileName}
              >
                <LuDownload className="size-4" />
              </ButtonLink>
            ) : null
          }
        />
      ))}
    </div>
  );
}
