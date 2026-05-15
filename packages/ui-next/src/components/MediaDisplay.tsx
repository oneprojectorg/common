import type { ReactNode } from 'react';
import { LuFileText, LuGlobe } from 'react-icons/lu';

import { Header3 } from './Header';
import { Surface } from './Surface';
import { cn, formatFileSize } from '../lib/utils';

export const MediaDisplay = ({
  className,
  children,
  title,
  author,
  description,
  url,
  site,
  mimeType,
  size,
}: {
  className?: string;
  children?: ReactNode;
  title?: string;
  author?: string;
  description?: string;
  url?: string;
  site?: string;
  mimeType?: string;
  size?: number;
}) => {
  const detailComponents: ReactNode[] = [];

  if (title && mimeType?.match(/application\/pdf/)) {
    detailComponents.push(
      <Header3 key="title" className="text-foreground text-base">
        {title}
      </Header3>,
    );
  }

  if (author) {
    detailComponents.push(<span key="author">{author}</span>);
  }
  if (site) {
    detailComponents.push(
      <div key="site" className="text-muted-foreground flex flex-col text-xs">
        {site}
      </div>,
    );
  }

  if (description) {
    detailComponents.push(
      <p key="description" className="text-muted-foreground text-sm">
        {description.length > 200
          ? description.slice(0, 200) + '...'
          : description}
      </p>,
    );
  }

  if (!mimeType && url) {
    detailComponents.push(
      <div key="link-wrap">
        <hr key="link-hr" className="my-2" />
        <div
          key="link"
          className="text-muted-foreground flex items-center gap-2 text-xs"
        >
          <LuGlobe className="size-4" /> <span>{url}</span>
        </div>
      </div>,
    );
  }

  if (mimeType?.match(/application\/pdf/)) {
    detailComponents.push(
      <hr key="format-hr" className="my-2" />,
      <div key="format" className="text-muted-foreground flex gap-1 text-sm">
        <LuFileText className="text-muted-foreground size-4" />
        <span>{size ? `${formatFileSize(size)} • PDF` : 'PDF'}</span>
      </div>,
    );
  }

  return (
    <Surface className={cn('mediaItem', className)}>
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {children}
        {detailComponents.length > 0 && (
          <div className="p-4">{detailComponents}</div>
        )}
      </a>
    </Surface>
  );
};
