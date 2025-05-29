import { Header3 } from '@op/ui/Header';
import { Surface } from '@op/ui/Surface';
import { ReactNode } from 'react';
import { LuFileText, LuGlobe } from 'react-icons/lu';

export const MediaDisplay = ({
  className,
  children,
  title,
  author,
  description,
  url,
  site,
  mimeType,
}: {
  className?: string;
  children?: ReactNode;
  title?: string;
  author?: string;
  description?: string;
  url?: string;
  site?: string;
  mimeType?: string;
}) => {
  const detailComponents = [];

  if (title && mimeType?.match(/application\/pdf/)) {
    detailComponents.push(
      <Header3 className="text-base text-neutral-black">{title}</Header3>,
    );
  }

  if (author) {
    detailComponents.push(<span>{author}</span>);
  }
  if (site) {
    detailComponents.push(
      <div className="flex flex-col text-xs text-neutral-gray4">{site}</div>,
    );
  }

  if (description) {
    detailComponents.push(
      <p className="text-sm text-neutral-gray4">
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
        <hr className="my-2 bg-neutral-gray1 text-sm" />
        <div className="flex items-center gap-2 text-xs text-neutral-gray4">
          <LuGlobe className="size-4" /> <span>{url}</span>
        </div>
      </>,
    );
  }

  if (mimeType?.match(/application\/pdf/)) {
    detailComponents.push(
      <>
        <hr className="my-2 bg-neutral-gray1 text-sm" />
        <div className="flex gap-1 text-sm text-neutral-gray4">
          <LuFileText className="size-4 text-neutral-gray4" />
          <span>3.2MB • PDF</span>
        </div>
      </>,
    );
  }

  return (
    <Surface className={className}>
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {children}

        {detailComponents.length > 0 && (
          <div className="p-4">{detailComponents}</div>
        )}
      </a>
    </Surface>
  );
};
