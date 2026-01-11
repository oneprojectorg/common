'use client';

import { trpc } from '@op/api/client';
import { Header3 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { memo, useEffect } from 'react';
import { LuGlobe } from 'react-icons/lu';

declare global {
  interface Window {
    iframely?: {
      load: () => void;
    };
  }
}

interface LinkPreviewProps {
  url: string;
  className?: string;
}

export const LinkPreview = memo(({ url, className }: LinkPreviewProps) => {
  const {
    data: previewData,
    isLoading: loading,
    error,
  } = trpc.content.linkPreview.useQuery(
    { url },
    {
      enabled: !!url,
      retry: false,
    },
  );

  useEffect(() => {
    // relies on the embed.js from iframely being loaded
    window.iframely && window.iframely.load();
  });

  if (loading) {
    return (
      <Skeleton className={className}>
        <Skeleton className="mb-2 h-4" />
        <Skeleton className="mb-2 h-3 w-3/4 bg-gray-200" />
        <Skeleton className="h-20 bg-gray-200" />
      </Skeleton>
    );
  }

  if (error || !previewData || previewData.error) {
    return null;
  }

  return (
    <Surface className={className}>
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {previewData.html && (
          <div
            className="aspect-video w-full"
            dangerouslySetInnerHTML={{ __html: previewData.html }}
          />
        )}
        <div className="p-4">
          {previewData.meta?.title && (
            <Header3 className="text-neutral-black text-base">
              {previewData.meta.title}
            </Header3>
          )}
          {previewData.meta?.author && <span>{previewData.meta.author}</span>}
          <div className="text-neutral-gray4 flex flex-col text-xs">
            {previewData.meta?.site && <span>{previewData.meta.site}</span>}
          </div>
          {previewData.meta?.description && (
            <p className="text-neutral-gray4 text-sm">
              {previewData.meta.description.length > 200
                ? previewData.meta.description.slice(0, 200) + '...'
                : previewData.meta.description}
            </p>
          )}
          <hr className="my-2" />
          <div className="text-neutral-gray4 flex items-center gap-2 text-xs">
            <LuGlobe className="size-4" /> <span>{url}</span>
          </div>
        </div>
      </a>
    </Surface>
  );
});

LinkPreview.displayName = 'LinkPreview';
