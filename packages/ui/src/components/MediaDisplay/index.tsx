import { Header3 } from '@op/ui/Header';
import { Surface } from '@op/ui/Surface';
import { ReactNode } from 'react';
import { LuFileText, LuGlobe } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { formatFileSize } from '../../utils/file';

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
  const detailComponents = [];

  if (title && mimeType?.match(/application\/pdf/)) {
    detailComponents.push(
      <Header3 key="title" className="text-base text-neutral-black">
        {title}
      </Header3>,
    );
  }

  if (author) {
    detailComponents.push(<span key="author">{author}</span>);
  }
  if (site) {
    detailComponents.push(
      <div key="site" className="flex flex-col text-xs text-neutral-gray4">
        {site}
      </div>,
    );
  }

  if (description) {
    detailComponents.push(
      <p key="description" className="text-sm text-neutral-gray4">
        {description.length > 200
          ? description.slice(0, 200) + '...'
          : description}
      </p>,
    );
  }

  // we check for mime type because we generally don't want to show a URL for internal files in our own storage
  if (!mimeType && url) {
    detailComponents.push(
      <>
        <hr key="link-hr" className="my-2" />
        <div
          key="link"
          className="flex items-center gap-2 text-xs text-neutral-gray4"
        >
          <LuGlobe className="size-4" /> <span>{url}</span>
        </div>
      </>,
    );
  }

  if (mimeType?.match(/application\/pdf/)) {
    detailComponents.push(
      <hr key="format-hr" className="my-2" />,
      <div key="format" className="flex gap-1 text-sm text-neutral-gray4">
        <LuFileText className="size-4 text-neutral-gray4" />
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
