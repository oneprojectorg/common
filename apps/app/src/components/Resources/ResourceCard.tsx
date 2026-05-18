'use client';

import { formatDate } from '@/utils/formatting';
import { sanitizeUrl } from '@op/core/utils';
import { Surface } from '@op/ui/Surface';
import { cn } from '@op/ui/utils';
import type { ReactNode } from 'react';
import {
  LuFile,
  LuFileSpreadsheet,
  LuFileText,
  LuGlobe,
  LuImage,
  LuPresentation,
} from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { ResourceItem } from './types';

const getDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const getExtension = (fileName: string | null): string | null => {
  if (!fileName) {
    return null;
  }
  const dot = fileName.lastIndexOf('.');
  if (dot < 0 || dot === fileName.length - 1) {
    return null;
  }
  return fileName.slice(dot + 1).toUpperCase();
};

const documentIconForMime = (mime: string | null): ReactNode => {
  if (!mime) {
    return <LuFile className="size-10" />;
  }
  if (mime.startsWith('image/')) {
    return <LuImage className="size-10" />;
  }
  if (mime === 'application/pdf') {
    return <LuFileText className="size-10" />;
  }
  if (mime.includes('spreadsheet') || mime === 'text/csv') {
    return <LuFileSpreadsheet className="size-10" />;
  }
  if (mime.includes('presentation')) {
    return <LuPresentation className="size-10" />;
  }
  if (mime.includes('wordprocessing') || mime === 'text/plain') {
    return <LuFileText className="size-10" />;
  }
  return <LuFile className="size-10" />;
};

export const ResourceCard = ({
  resource,
  signedUrl,
  trailing,
}: {
  resource: ResourceItem;
  signedUrl?: string | null;
  trailing?: ReactNode;
}) => {
  const t = useTranslations();
  const href =
    resource.type === 'link'
      ? resource.linkUrl
        ? sanitizeUrl(resource.linkUrl)
        : null
      : (signedUrl ?? null);

  const attachment = resource.attachment;
  const isImage =
    resource.type === 'document' &&
    attachment?.mimeType.startsWith('image/') === true;

  const previewSrc = isImage ? (signedUrl ?? null) : null;

  const subtitle =
    resource.type === 'link'
      ? getDomain(resource.linkUrl ?? '')
      : (() => {
          const ext = getExtension(attachment?.fileName ?? null);
          const added = t('Added on {date}', {
            date: formatDate(resource.createdAt.toISOString()),
          });
          return ext ? `${ext} • ${added}` : added;
        })();

  const preview = previewSrc ? (
    <div className="h-44 w-full overflow-hidden rounded-lg border border-neutral-gray2">
      <img
        src={previewSrc}
        alt=""
        loading="lazy"
        className="size-full object-cover"
      />
    </div>
  ) : (
    <div className="flex h-44 w-full items-center justify-center rounded-lg border border-neutral-gray2 bg-neutral-gray1 text-neutral-gray4">
      {resource.type === 'link' ? (
        <LuGlobe className="size-10" />
      ) : (
        documentIconForMime(attachment?.mimeType ?? null)
      )}
    </div>
  );

  const body = (
    <div className="flex flex-col gap-2">
      <p
        className={cn(
          'truncate font-serif text-title-sm text-neutral-black',
          trailing ? 'pr-8' : null,
        )}
      >
        {resource.title}
      </p>
      {preview}
      <div className="flex flex-col gap-0.5">
        {resource.description ? (
          <p className="line-clamp-2 text-sm text-neutral-charcoal">
            {resource.description}
          </p>
        ) : null}
        {subtitle ? (
          <p className="truncate text-sm text-neutral-gray4">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );

  return (
    <Surface className={cn('relative rounded-lg p-4')}>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={resource.title}
          className="block outline-none"
        >
          {body}
        </a>
      ) : (
        body
      )}
      {trailing ? (
        <div className="absolute top-3 right-3 rounded-full bg-white/80 p-1">
          {trailing}
        </div>
      ) : null}
    </Surface>
  );
};
