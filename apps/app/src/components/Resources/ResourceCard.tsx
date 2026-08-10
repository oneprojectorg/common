'use client';

import { formatDate } from '@/utils/formatting';
import type { ResourceInCollection } from '@op/api/encoders';
import { match, sanitizeUrl } from '@op/core/utils';
import { Card } from '@op/sense/Card';
import { cn } from '@op/sense/lib/utils';
import React, { useState } from 'react';
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

import { useDecisionTranslation } from '@/components/decisions/DecisionTranslationContext';

import { getExtension, hostnameForDisplay } from './utils';

type LinkResource = Extract<ResourceInCollection, { type: 'link' }>;
type DocumentResource = Extract<ResourceInCollection, { type: 'document' }>;

// Returns the translated copy for a resource if the decision is currently
// being viewed in a translated state; otherwise the original strings on the
// resource. Used by every card variant so they stay in sync.
const useTranslatedResourceCopy = (
  resource: ResourceInCollection,
): { title: string; description: string | null } => {
  const decisionTranslation = useDecisionTranslation();
  const translated = decisionTranslation?.resources[resource.id];
  return {
    title: translated?.title ?? resource.title,
    description: translated?.description ?? resource.description,
  };
};

export const ResourceCard = ({
  resource,
  signedUrl,
  trailing,
}: {
  resource: ResourceInCollection;
  signedUrl?: string | null;
  trailing?: ReactNode;
}) => {
  if (resource.type === 'link') {
    return <ResourceLinkCard resource={resource} trailing={trailing} />;
  }
  return (
    <ResourceDocumentCard
      resource={resource}
      signedUrl={signedUrl ?? null}
      trailing={trailing}
    />
  );
};

const ResourceLinkCard = ({
  resource,
  trailing,
}: {
  resource: LinkResource;
  trailing?: ReactNode;
}) => {
  const href = resource.linkUrl ? sanitizeUrl(resource.linkUrl) : null;
  const { title, description } = useTranslatedResourceCopy(resource);

  // Thumbnail is resolved server-side during list hydration (resourceDTO),
  // so the card doesn't fan out N preview queries. `ogImageFailed` covers
  // the case where the URL we got from Iframely later 404s in the browser.
  const [ogImageFailed, setOgImageFailed] = useState(false);
  const previewSrc = ogImageFailed ? null : resource.thumbnailUrl;

  const preview = previewSrc ? (
    <ResourcePreviewImage
      src={previewSrc}
      onError={() => setOgImageFailed(true)}
    />
  ) : (
    <ResourcePreviewFallback icon={<LuGlobe className="size-10" />} />
  );

  return (
    <ResourceCardShell
      title={title}
      description={description}
      subtitle={hostnameForDisplay(resource.linkUrl)}
      preview={preview}
      href={href}
      trailing={trailing}
    />
  );
};

const ResourceDocumentCard = ({
  resource,
  signedUrl,
  trailing,
}: {
  resource: DocumentResource;
  signedUrl: string | null;
  trailing?: ReactNode;
}) => {
  const t = useTranslations();
  const { title, description } = useTranslatedResourceCopy(resource);
  const attachment = resource.attachment;
  const isImage = attachment?.mimeType.startsWith('image/') === true;

  const preview =
    isImage && signedUrl ? (
      <ResourcePreviewImage src={signedUrl} />
    ) : (
      <ResourcePreviewFallback
        icon={documentIconForMime(attachment?.mimeType ?? null)}
      />
    );

  const ext = getExtension(attachment?.fileName ?? null);
  const subtitle = (() => {
    if (!resource.createdAt) {
      return ext;
    }
    const added = t('Added on {date}', {
      date: formatDate(resource.createdAt),
    });
    return ext ? `${ext} • ${added}` : added;
  })();

  return (
    <ResourceCardShell
      title={title}
      description={description}
      subtitle={subtitle}
      preview={preview}
      href={signedUrl}
      trailing={trailing}
    />
  );
};

const ResourceCardShell = ({
  title,
  description,
  subtitle,
  preview,
  href,
  trailing,
}: {
  title: string;
  description: string | null;
  subtitle: string | null;
  preview: ReactNode;
  href: string | null;
  trailing?: ReactNode;
}) => {
  const body = (
    <div className="flex flex-col gap-2">
      <p
        dir="auto"
        className={cn(
          'truncate font-serif text-title-sm text-foreground',
          trailing && 'pe-8',
        )}
      >
        {title}
      </p>
      {preview}
      <div className="flex flex-col gap-0.5">
        {description ? (
          <p dir="auto" className="line-clamp-2 text-sm text-foreground">
            {description}
          </p>
        ) : null}
        {subtitle ? (
          <p dir="auto" className="truncate text-sm text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );

  return (
    <Card className="relative rounded-lg p-4 shadow-none">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={title}
          className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-teal focus-visible:ring-offset-2"
        >
          {body}
        </a>
      ) : (
        body
      )}
      {trailing ? (
        <div className="absolute end-3 top-3 rounded-full bg-white/80 p-1">
          {trailing}
        </div>
      ) : null}
    </Card>
  );
};

const ResourcePreviewImage = ({
  src,
  onError,
}: {
  src: string;
  onError?: () => void;
}) => (
  <div className="h-44 w-full overflow-hidden rounded-lg border border-input">
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={onError}
      className="size-full object-cover"
    />
  </div>
);

const ResourcePreviewFallback = ({ icon }: { icon: ReactNode }) => (
  <div className="flex h-44 w-full items-center justify-center rounded-lg border border-input bg-secondary text-muted-foreground">
    {icon}
  </div>
);

export const iconComponentForMime = (
  mime: string | null,
): React.ComponentType<{ className?: string }> => {
  if (!mime) {
    return LuFile;
  }
  if (mime.startsWith('image/')) {
    return LuImage;
  }
  return match(mime, {
    'application/pdf': () => LuFileText,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      () => LuFileText,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': () =>
      LuFileSpreadsheet,
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      () => LuPresentation,
    _: () => LuFile,
  });
};

const documentIconForMime = (mime: string | null): ReactNode => {
  const Icon = iconComponentForMime(mime);
  return <Icon className="size-10" />;
};
