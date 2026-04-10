'use client';

import { getPublicUrl } from '@/utils';
import { formatCurrency, formatDate } from '@/utils/formatting';
import { ProposalStatus } from '@op/api/encoders';
import {
  type Proposal,
  type ProposalTemplateSchema,
  normalizeProposalCategories,
  parseTranslatedMeta,
} from '@op/common/client';
import { AlertBanner } from '@op/ui/AlertBanner';
import { Avatar } from '@op/ui/Avatar';
import { Header1, Header3 } from '@op/ui/Header';
import { Link as UILink } from '@op/ui/Link';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import Image from 'next/image';
import { LuBookmark, LuHeart, LuMessageCircle } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { DocumentNotAvailable } from './DocumentNotAvailable';
import { ProposalAttachmentViewList } from './ProposalAttachmentViewList';
import { ProposalContentRenderer } from './ProposalContentRenderer';
import { ProposalHtmlContent } from './ProposalHtmlContent';
import { resolveProposalSystemFields } from './proposalContentUtils';

export type ProposalTranslation = {
  htmlContent: Record<string, string | string[]>;
  sourceLanguageName: string;
  onViewOriginal: () => void;
};

export type ProposalPreviewProps = {
  proposal: Proposal;
  /** When set, overrides proposal content with translated HTML and shows attribution */
  translation?: ProposalTranslation;
};

export function ProposalPreview({
  proposal,
  translation,
}: ProposalPreviewProps) {
  const t = useTranslations();

  const proposalTemplate =
    (proposal.proposalTemplate as ProposalTemplateSchema) ?? null;

  const isDraft = proposal.status === ProposalStatus.DRAFT;

  const {
    title: originalTitle,
    budget,
    category: originalCategory,
  } = resolveProposalSystemFields(proposal);

  const rawHtmlContent = translation?.htmlContent ?? proposal.htmlContent;
  // Filter to only string values — array fields (e.g. category) are system
  // fields handled separately and not passed to the content renderer.
  const htmlContent = rawHtmlContent
    ? Object.fromEntries(
        Object.entries(rawHtmlContent).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : null;
  const title = (translation?.htmlContent.title as string) ?? originalTitle;
  const categories = translation?.htmlContent.category
    ? normalizeProposalCategories(translation.htmlContent.category)
    : normalizeProposalCategories(originalCategory);
  const translatedMeta = translation
    ? parseTranslatedMeta(translation.htmlContent)
    : null;

  // Legacy proposals store HTML under a single "default" key with no collab doc.
  // Render them directly instead of going through the template-driven renderer.
  const legacyHtml = htmlContent?.default as string | undefined;

  return (
    <div className="flex flex-col gap-8">
      {/* Draft mode banner */}
      {isDraft && (
        <AlertBanner intent="default" variant="banner">
          {t(
            'This proposal is currently in draft mode, only you and collaborators can access it.',
          )}
        </AlertBanner>
      )}

      <div className="space-y-4">
        <Header1 className="font-serif text-title-lg">
          {title || t('Untitled Proposal')}
        </Header1>

        {/* Translation attribution */}
        {translation && (
          <p className="text-sm text-neutral-gray3">
            {t('Translated from {language}', {
              language: translation.sourceLanguageName,
            })}{' '}
            &middot;{' '}
            <UILink
              onPress={translation.onViewOriginal}
              className="text-sm font-semibold"
            >
              {t('View original')}
            </UILink>
          </p>
        )}

        <div className="space-y-6">
          {/* Metadata Row */}
          <div className="flex flex-wrap gap-4 sm:flex-row sm:items-center">
            {budget && (
              <span className="font-serif text-title-base text-neutral-black">
                {formatCurrency(budget.amount, undefined, budget.currency)}
              </span>
            )}
            {categories.length > 0 && (
              <TagGroup className="max-w-full">
                {categories.map((category) => (
                  <Tag
                    key={category}
                    className="max-w-full sm:max-w-96 sm:rounded-md"
                  >
                    <span className="truncate">{category}</span>
                  </Tag>
                ))}
              </TagGroup>
            )}
          </div>

          {/* Author and submission info */}
          <div className="flex items-center gap-2">
            {proposal.submittedBy && (
              <>
                <Link
                  href={`/profile/${proposal.submittedBy.slug}`}
                  className="shrink-0"
                >
                  <Avatar
                    placeholder={
                      proposal.submittedBy.name ||
                      proposal.submittedBy.slug ||
                      'U'
                    }
                    className="size-8"
                  >
                    {proposal.submittedBy.avatarImage?.name ? (
                      <Image
                        src={
                          getPublicUrl(proposal.submittedBy.avatarImage.name) ??
                          ''
                        }
                        alt={
                          proposal.submittedBy.name ||
                          proposal.submittedBy.slug ||
                          ''
                        }
                        fill
                        className="aspect-square object-cover"
                      />
                    ) : null}
                  </Avatar>
                </Link>
                <div className="flex flex-col">
                  <Link
                    href={`/profile/${proposal.submittedBy.slug}`}
                    className="text-base text-neutral-black"
                  >
                    {proposal.submittedBy.name || proposal.submittedBy.slug}
                  </Link>
                  {!isDraft && (
                    <span className="text-sm text-neutral-charcoal">
                      {t('Submitted on')} {formatDate(proposal.createdAt)}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Engagement Stats */}
          <div className="flex items-center gap-4 border-t border-b py-4 text-sm text-neutral-gray4">
            <div className="flex items-center gap-1">
              <LuHeart className="h-4 w-4" />
              <span>
                {proposal.likesCount || 0} {t('Likes')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <LuMessageCircle className="h-4 w-4" />
              <span>
                {proposal.commentsCount || 0}{' '}
                {(proposal.commentsCount || 0) !== 1
                  ? t('Comments')
                  : t('Comment')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <LuBookmark className="size-4" />
              <span>
                {proposal.followersCount || 0}{' '}
                {(proposal.followersCount || 0) !== 1
                  ? t('Followers')
                  : t('Follower')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Proposal Content */}
      {legacyHtml ? (
        <ProposalHtmlContent html={legacyHtml} />
      ) : htmlContent && proposalTemplate ? (
        <ProposalContentRenderer
          proposalTemplate={proposalTemplate}
          htmlContent={htmlContent}
          translatedMeta={translatedMeta}
        />
      ) : (
        <DocumentNotAvailable />
      )}

      {/* Attachments Section */}
      {proposal.attachments && proposal.attachments.length > 0 && (
        <div className="border-t pt-8">
          <Header3 className="mb-4">{t('Attachments')}</Header3>
          <ProposalAttachmentViewList attachments={proposal.attachments} />
        </div>
      )}
    </div>
  );
}
