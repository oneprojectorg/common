'use client';

import { formatDate } from '@/utils/formatting';
import type { ResourceInCollection } from '@op/api/encoders';
import { match, sanitizeUrl } from '@op/core/utils';
import { Surface } from '@op/ui/Surface';
import { cn } from '@op/ui/utils';
import { useState } from 'react';
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

import { getExtension } from './utils';

export const ResourceCard = ({
  resource,
  signedUrl,
  trailing,
}: {
  resource: ResourceInCollection;
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

  const isLink = resource.type === 'link';
  // Thumbnail is resolved server-side during list hydration (resourceDTO),
  // so the card doesn't fan out N preview queries. `setOgImageFailed` covers
  // the case where the URL we got from Iframely later 404s in the browser.
  const [ogImageFailed, setOgImageFailed] = useState(false);
  const ogThumbnail = !ogImageFailed && isLink ? resource.thumbnailUrl : null;

  const previewSrc = isImage
    ? (signedUrl ?? null)
    : isLink
      ? (ogThumbnail ?? null)
      : null;

  const subtitle =
    resource.type === 'link'
      ? getDomain(resource.linkUrl ?? '')
      : (() => {
          const ext = getExtension(attachment?.fileName ?? null);
          if (!resource.createdAt) {
            return ext;
          }
          const added = t('Added on {date}', {
            date: formatDate(resource.createdAt),
          });
          return ext ? `${ext} • ${added}` : added;
        })();

  const preview = previewSrc ? (
    <div className="h-44 w-full overflow-hidden rounded-lg border border-neutral-gray2">
      <img
        src={previewSrc}
        alt=""
        loading="lazy"
        onError={isLink ? () => setOgImageFailed(true) : undefined}
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
          trailing && 'pr-8',
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
          className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-teal focus-visible:ring-offset-2"
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

const getDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const documentIconForMime = (mime: string | null): ReactNode => {
  if (!mime) {
    return <LuFile className="size-10" />;
  }
  if (mime.startsWith('image/')) {
    return <LuImage className="size-10" />;
  }
  return match<ReactNode>(mime, {
    'application/pdf': () => <LuFileText className="size-10" />,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      () => <LuFileText className="size-10" />,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': () => (
      <LuFileSpreadsheet className="size-10" />
    ),
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      () => <LuPresentation className="size-10" />,
    _: () => <LuFile className="size-10" />,
  });
};
