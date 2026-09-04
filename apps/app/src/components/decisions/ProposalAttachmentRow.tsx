import { formatFileSize } from '@/utils/formatting';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@op/sense/Item';
import { Skeleton } from '@op/sense/Skeleton';
import type { ReactNode } from 'react';

export type ProposalAttachmentRowProps = {
  fileName: string;
  fileSize: number;
  /** When set, the file name becomes a download link. */
  url?: string;
  /** Renders skeletons in place of the name + meta while an upload is in flight. */
  isUploading?: boolean;
  /**
   * Trailing control: the remove button in edit mode, the download button in
   * read mode.
   */
  trailing?: ReactNode;
};

/**
 * One attachment row, shared by the proposal editor's list
 * ({@link ProposalAttachmentList}) and the read-only view list
 * ({@link ProposalAttachmentViewList}) — the two were byte-identical apart from
 * their trailing control.
 *
 * Matches the Figma "Resource Compact" row: file name, then `TYPE • size`, with
 * no leading icon tile.
 */
export function ProposalAttachmentRow({
  fileName,
  fileSize,
  url,
  isUploading = false,
  trailing,
}: ProposalAttachmentRowProps) {
  const meta = [getFileTypeLabel(fileName), formatFileSize(fileSize)]
    .filter(Boolean)
    .join(' • ');

  return (
    <Item variant="outline" className="flex-nowrap bg-background">
      <ItemContent className="min-w-0 gap-0">
        {isUploading ? (
          <>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-1 h-3 w-20" />
          </>
        ) : (
          <>
            <ItemTitle className="max-w-full">
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={fileName}
                  className="truncate hover:text-primary hover:underline"
                >
                  {fileName}
                </a>
              ) : (
                <span className="truncate">{fileName}</span>
              )}
            </ItemTitle>
            <ItemDescription className="text-sm">{meta}</ItemDescription>
          </>
        )}
      </ItemContent>
      {trailing ? (
        <ItemActions className="shrink-0">{trailing}</ItemActions>
      ) : null}
    </Item>
  );
}

/**
 * `report.pdf` → `PDF`. Returns an empty string when the name carries no
 * usable extension, so the meta line degrades to the size alone.
 */
function getFileTypeLabel(fileName: string): string {
  const extension = fileName.includes('.')
    ? (fileName.split('.').pop() ?? '')
    : '';
  return extension.length > 0 && extension.length <= 5
    ? extension.toUpperCase()
    : '';
}
