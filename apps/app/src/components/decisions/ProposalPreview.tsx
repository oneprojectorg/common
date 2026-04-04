'use client';

import { getPublicUrl } from '@/utils';
import { formatCurrency, formatDate } from '@/utils/formatting';
import type { RouterOutput } from '@op/api';
import { ProposalStatus } from '@op/api/encoders';
import type {
  MoneyAmount,
  ProposalTemplateSchema,
  parseTranslatedMeta,
} from '@op/common/client';
import { AlertBanner } from '@op/ui/AlertBanner';
import { Avatar } from '@op/ui/Avatar';
import { Header1 } from '@op/ui/Header';
import { Link } from '@op/ui/Link';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import Image from 'next/image';
import { LuBookmark, LuHeart, LuMessageCircle } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { DocumentNotAvailable } from './DocumentNotAvailable';
import { ProposalAttachmentViewList } from './ProposalAttachmentViewList';
import { ProposalContentRenderer } from './ProposalContentRenderer';
import { ProposalHtmlContent } from './ProposalHtmlContent';

type Proposal = RouterOutput['decision']['getProposal'];

type TranslatedMeta = ReturnType<typeof parseTranslatedMeta>;

export type ProposalPreviewProposal = Pick<
  Proposal,
  | 'submittedBy'
  | 'status'
  | 'likesCount'
  | 'commentsCount'
  | 'followersCount'
  | 'attachments'
  | 'proposalTemplate'
  | 'createdAt'
  | 'htmlContent'
>;

export type ProposalPreviewProps = {
  proposal: ProposalPreviewProposal;
  /** Pre-resolved title (from document fragments or proposalData, optionally translated) */
  title: string | null | undefined;
  /** Pre-resolved budget (from document fragments or proposalData) */
  budget: MoneyAmount | null | undefined;
  /** Category string — may be translated HTML */
  category: string | null | undefined;
  /** When set, overrides proposal.htmlContent with translated HTML and shows attribution */
  translatedHtmlContent?: Record<string, string>;
  /** Parsed translation metadata for field titles/descriptions/option labels */
  translatedMeta: TranslatedMeta | null;
  /** Shown in "Translated from {language}" attribution — only relevant when translatedHtmlContent is set */
  sourceLanguageName?: string;
  onViewOriginal?: () => void;
};

export function ProposalPreview({
  proposal,
  title,
  budget,
  category,
  translatedHtmlContent,
  translatedMeta,
  sourceLanguageName,
  onViewOriginal,
}: ProposalPreviewProps) {
  const t = useTranslations();

  const proposalTemplate =
    (proposal.proposalTemplate as ProposalTemplateSchema) ?? null;

  const isDraft = proposal.status === ProposalStatus.DRAFT;

  const htmlContent = translatedHtmlContent ?? proposal.htmlContent;

  // Legacy proposals store HTML under a single "default" key with no collab doc.
  // Render them directly instead of going through the template-driven renderer.
  const legacyHtml = htmlContent?.default as string | undefined;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
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
        {sourceLanguageName && (
          <p className="text-sm text-neutral-gray3">
            {t('Translated from {language}', {
              language: sourceLanguageName,
            })}{' '}
            &middot;{' '}
            <Link onPress={onViewOriginal} className="text-sm font-semibold">
              {t('View original')}
            </Link>
          </p>
        )}

        <div className="space-y-6">
          {/* Metadata Row */}
          <div className="flex flex-wrap gap-4 sm:flex-row sm:items-center">
            {category && (
              <TagGroup className="max-w-full">
                <Tag className="max-w-full sm:max-w-96 sm:rounded-md">
                  <span
                    className="truncate"
                    dangerouslySetInnerHTML={{ __html: category }}
                  />
                </Tag>
              </TagGroup>
            )}
            {budget && (
              <span className="font-serif text-title-base text-neutral-black">
                {formatCurrency(budget.amount, undefined, budget.currency)}
              </span>
            )}
          </div>

          {/* Author and submission info */}
          <div className="flex items-center gap-2">
            {proposal.submittedBy && (
              <>
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
                <div className="flex flex-col">
                  <span className="text-base text-neutral-black">
                    {proposal.submittedBy.name || proposal.submittedBy.slug}
                  </span>
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
          <h3 className="mb-4 text-lg font-semibold text-neutral-charcoal">
            {t('Attachments')}
          </h3>
          <ProposalAttachmentViewList attachments={proposal.attachments} />
        </div>
      )}
    </div>
  );
}
