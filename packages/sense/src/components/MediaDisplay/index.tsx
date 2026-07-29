import * as React from 'react';
import { LuFileText, LuGlobe } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import { Separator } from '../ui/separator';

interface MediaDisplayProps {
  className?: string;
  children?: React.ReactNode;
  title?: string;
  author?: string;
  description?: string;
  url?: string;
  site?: string;
  mimeType?: string;
  size?: number;
}

/** Link/file preview card: media above, metadata details below. */
function MediaDisplay({
  className,
  children,
  title,
  author,
  description,
  url,
  site,
  mimeType,
  size,
}: MediaDisplayProps) {
  const isPdf = Boolean(mimeType?.match(/application\/pdf/));
  const isImage = Boolean(mimeType?.startsWith('image/'));

  const details: React.ReactNode[] = [];

  // Images are shown on their own — the filename-as-title is noise. Link
  // previews (no mimeType) and documents still surface their title.
  if (title && !isImage) {
    details.push(
      <p key="title" className="text-base font-strong">
        {title}
      </p>,
    );
  }
  if (author) {
    details.push(<span key="author">{author}</span>);
  }
  if (site) {
    details.push(
      <div key="site" className="flex flex-col text-xs text-muted-foreground">
        {site}
      </div>,
    );
  }
  if (description) {
    details.push(
      <p key="description" className="text-sm text-muted-foreground">
        {description.length > 200
          ? `${description.slice(0, 200)}...`
          : description}
      </p>,
    );
  }
  // No URL row for internal files (they carry a mime type).
  if (!mimeType && url) {
    details.push(
      <React.Fragment key="link">
        <Separator className="my-2" />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <LuGlobe className="size-4 shrink-0" />
          <span className="truncate">{url}</span>
        </div>
      </React.Fragment>,
    );
  }
  if (isPdf) {
    details.push(
      <React.Fragment key="format">
        <Separator className="my-2" />
        <div className="flex gap-1 text-sm text-muted-foreground">
          <LuFileText className="size-4" />
          <span>{size ? `${formatFileSize(size)} • PDF` : 'PDF'}</span>
        </div>
      </React.Fragment>,
    );
  }

  const body = (
    <>
      {children}
      {details.length > 0 && <div className="p-4">{details}</div>}
    </>
  );

  return (
    <Card
      data-slot="media-display"
      className={cn('gap-0 overflow-hidden py-0', className)}
    >
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          {body}
        </a>
      ) : (
        <div className="block">{body}</div>
      )}
    </Card>
  );
}

function formatFileSize(bytes: number) {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export { MediaDisplay };
