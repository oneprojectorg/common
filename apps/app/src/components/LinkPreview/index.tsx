'use client';

import { trpc } from '@op/api/client';
import { sanitizeUrl } from '@op/core/utils';
import { Spinner } from '@op/sense/Spinner';
import { cn } from '@op/sense/lib/utils';
import { memo, useEffect, useMemo } from 'react';
import { LuGlobe, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

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
  onRemove?: () => void;
}

/**
 * Extracts the domain from a URL for display (e.g., "youtube.com")
 */
function getDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove www. prefix if present
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const LinkPreview = memo(
  ({ url, className, onRemove }: LinkPreviewProps) => {
    const t = useTranslations();
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

    const domain = getDomain(url);
    const safeUrl = useMemo(() => sanitizeUrl(url), [url]);

    useEffect(() => {
      window.iframely?.load();
    }, [previewData?.html]);

    // Loading state: show card with spinner and domain
    if (loading) {
      return (
        <div
          className={cn(
            'overflow-hidden rounded border bg-white',
            'rounded-lg',
            className,
          )}
        >
          <div className="flex aspect-video w-full items-center justify-center bg-secondary">
            <Spinner className="size-8" />
          </div>
          <div className="border-t border-input px-4 py-3">
            <span className="text-sm text-muted-foreground">{domain}</span>
          </div>
        </div>
      );
    }

    // Error/fallback state: show URL as a simple link card
    if (error || !previewData || previewData.error) {
      return (
        <div
          className={cn(
            'overflow-hidden rounded border bg-white',
            'rounded-lg',
            className,
          )}
        >
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4"
          >
            <LuGlobe className="size-5 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm text-muted-foreground">
              {url}
            </span>
          </a>
        </div>
      );
    }

    const title = previewData.meta?.title;

    return (
      <div
        className={cn(
          'overflow-hidden rounded border bg-white',
          'group relative rounded-lg border-border bg-white',
          className,
        )}
      >
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
            className="absolute end-2 top-2 z-10 flex size-8 items-center justify-center rounded border border-border bg-white text-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-secondary focus-visible:opacity-100"
            aria-label={t('Remove preview')}
          >
            <LuX className="size-4" />
          </button>
        )}
        <a
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block outline-none"
        >
          {previewData.html ? (
            <div
              className="aspect-video w-full"
              dangerouslySetInnerHTML={{ __html: previewData.html }}
            />
          ) : previewData.thumbnail_url ? (
            <div className="aspect-video w-full">
              <img
                src={previewData.thumbnail_url}
                alt={title ?? ''}
                className="size-full object-cover"
              />
            </div>
          ) : null}
          <div className="px-4 py-4">
            <span className="text-sm text-foreground">
              {title ?? domain}
              {title && (
                <>
                  {' '}
                  <span className="text-muted-foreground">· {domain}</span>
                </>
              )}
            </span>
          </div>
        </a>
      </div>
    );
  },
);

LinkPreview.displayName = 'LinkPreview';
