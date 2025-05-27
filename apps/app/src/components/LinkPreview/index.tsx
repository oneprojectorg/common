import { Header3 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { useEffect, useState } from 'react';
import { LuGlobe } from 'react-icons/lu';

interface LinkPreviewData {
  title?: string;
  description?: string;
  thumbnail_url?: string;
  author_name?: string;
  author_url?: string;
  provider_name?: string;
  provider_url?: string;
  url: string;
  html?: string;
}

interface LinkPreviewProps {
  url: string;
  className?: string;
}

export const LinkPreview = ({ url, className }: LinkPreviewProps) => {
  const [previewData, setPreviewData] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        setLoading(true);
        setError(null);

        // Using iframely's public API endpoint
        const response = await fetch(
          `https://cdn.iframe.ly/api/iframely?omit_script=1&consent=1&url=${encodeURIComponent(url)}&api_key=${process.env.IFRAMELY_API_KEY}`,
        );

        if (!response.ok) {
          throw new Error('Failed to fetch preview');
        }

        const data = await response.json();
        setPreviewData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preview');
      } finally {
        setLoading(false);
      }
    };

    if (url) {
      fetchPreview();
    }
  }, [url]);

  useEffect(() => {
    // Make sure you load Iframely embed.js script yourself
    window.iframely && window.iframely.load();
  });

  if (loading) {
    return (
      <Skeleton className={className}>
        <div className="mb-2 h-4 rounded bg-gray-200"></div>
        <div className="mb-2 h-3 w-3/4 rounded bg-gray-200"></div>
        <div className="h-20 rounded bg-gray-200"></div>
      </Skeleton>
    );
  }

  if (error || !previewData) {
    return null;
  }

  return (
    <Surface className={className}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block transition-colors"
      >
        {previewData.html && (
          <div
            className="aspect-video w-full"
            dangerouslySetInnerHTML={{ __html: previewData.html }}
          />
        )}
        <div className="p-4">
          {previewData.meta.title && (
            <Header3 className="text-base text-neutral-black">
              {previewData.meta.title}
            </Header3>
          )}
          {previewData.meta.author && (
            <>
              {previewData.site && <span className="mx-1">•</span>}
              <span>{previewData.meta.author}</span>
            </>
          )}
          <div className="flex flex-col text-xs text-gray-500">
            {previewData.meta.site && <span>{previewData.meta.site}</span>}
          </div>
          {previewData.meta.description && (
            <p className="text-sm text-neutral-gray4">
              {previewData.meta.description.length > 200
                ? previewData.meta.description.slice(0, 200) + '...'
                : previewData.meta.description}
            </p>
          )}
          <hr className="my-2 bg-neutral-gray1 text-sm" />
          <div className="flex items-center gap-2 text-xs text-neutral-gray4">
            <LuGlobe className="size-4" /> <span>{url}</span>
          </div>
        </div>
      </a>
    </Surface>
  );
};
