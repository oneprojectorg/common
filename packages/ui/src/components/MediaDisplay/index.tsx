import { Header3 } from '@op/ui/Header';
import { Surface } from '@op/ui/Surface';
import { ReactNode } from 'react';
import { LuGlobe } from 'react-icons/lu';

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
  return (
    <Surface className={className}>
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {children}
        <div className="p-4">
          {title && !mimeType?.match(/application\/pdf/) && (
            <Header3 className="text-base text-neutral-black">{title}</Header3>
          )}
          {author && <span>{author}</span>}
          <div className="flex flex-col text-xs text-neutral-gray4">
            {site && <span>{site}</span>}
          </div>
          {description && (
            <p className="text-sm text-neutral-gray4">
              {description.length > 200
                ? description.slice(0, 200) + '...'
                : description}
            </p>
          )}
          {url ? (
            <>
              <hr className="my-2 bg-neutral-gray1 text-sm" />
              <div className="flex items-center gap-2 text-xs text-neutral-gray4">
                <LuGlobe className="size-4" /> <span>{url}</span>
              </div>
            </>
          ) : null}
        </div>
      </a>
    </Surface>
  );
};
