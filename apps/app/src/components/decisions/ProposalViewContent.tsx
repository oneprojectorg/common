'use client';

import { getPublicUrl } from '@/utils';
import { formatCurrency, formatDate } from '@/utils/formatting';
import type { RouterOutput } from '@op/api';
import {
  type ProposalTemplateSchema,
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

interface ProposalViewContentProps {
  isDraft: boolean;
  title: string | null | undefined;
  translatedTitleHtml?: string;
  sourceLanguageName?: string;
  onViewOriginal?: () => void;
  category?: string | null;
  budget?: {
    amount?: number | null;
    currency?: string | null;
  } | null;
  submittedBy?: Proposal['submittedBy'];
  createdAt?: Proposal['createdAt'];
  likesCount?: number;
  commentsCount?: number;
  followersCount?: number;
  legacyHtml?: string;
  resolvedHtmlContent?: Proposal['htmlContent'];
  proposalTemplate: ProposalTemplateSchema | null;
  translatedMeta: ReturnType<typeof parseTranslatedMeta> | null;
  attachments?: Proposal['attachments'];
}

/**
 * Renders the proposal body without page layout or data fetching concerns.
 */
export function ProposalViewContent({
  isDraft,
  title,
  translatedTitleHtml,
  sourceLanguageName,
  onViewOriginal,
  category,
  budget,
  submittedBy,
  createdAt,
  likesCount = 0,
  commentsCount = 0,
  followersCount = 0,
  legacyHtml,
  resolvedHtmlContent,
  proposalTemplate,
  translatedMeta,
  attachments,
}: ProposalViewContentProps) {
  const t = useTranslations();

  return (
    <div className="flex-1 px-6 py-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        {isDraft && (
          <AlertBanner intent="default" variant="banner">
            {t(
              'This proposal is currently in draft mode, only you and collaborators can access it.',
            )}
          </AlertBanner>
        )}

        <div className="space-y-4">
          <Header1 className="font-serif text-title-lg">
            {translatedTitleHtml ? (
              <span dangerouslySetInnerHTML={{ __html: translatedTitleHtml }} />
            ) : (
              title || t('Untitled Proposal')
            )}
          </Header1>

          {translatedTitleHtml && sourceLanguageName && onViewOriginal && (
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
              {budget?.amount != null && budget.currency && (
                <span className="font-serif text-title-base text-neutral-black">
                  {formatCurrency(budget.amount, undefined, budget.currency)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {submittedBy && (
                <>
                  <Avatar
                    placeholder={submittedBy.name || submittedBy.slug || 'U'}
                    className="size-8"
                  >
                    {submittedBy.avatarImage?.name ? (
                      <Image
                        src={getPublicUrl(submittedBy.avatarImage.name) ?? ''}
                        alt={submittedBy.name || submittedBy.slug || ''}
                        fill
                        className="aspect-square object-cover"
                      />
                    ) : null}
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-base text-neutral-black">
                      {submittedBy.name || submittedBy.slug}
                    </span>
                    {!isDraft && createdAt && (
                      <span className="text-sm text-neutral-charcoal">
                        {t('Submitted on')} {formatDate(createdAt)}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-b py-4 text-sm text-neutral-gray4">
              <div className="flex items-center gap-1">
                <LuHeart className="h-4 w-4" />
                <span>
                  {likesCount} {t('Likes')}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <LuMessageCircle className="h-4 w-4" />
                <span>
                  {commentsCount}{' '}
                  {commentsCount !== 1 ? t('Comments') : t('Comment')}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <LuBookmark className="size-4" />
                <span>
                  {followersCount}{' '}
                  {followersCount !== 1 ? t('Followers') : t('Follower')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {legacyHtml ? (
          <ProposalHtmlContent html={legacyHtml} />
        ) : resolvedHtmlContent && proposalTemplate ? (
          <ProposalContentRenderer
            proposalTemplate={proposalTemplate}
            htmlContent={resolvedHtmlContent}
            translatedMeta={translatedMeta}
          />
        ) : (
          <DocumentNotAvailable />
        )}

        {attachments && attachments.length > 0 && (
          <div className="border-t pt-8">
            <h3 className="mb-4 text-lg font-semibold text-neutral-charcoal">
              {t('Attachments')}
            </h3>
            <ProposalAttachmentViewList attachments={attachments} />
          </div>
        )}
      </div>
    </div>
  );
}
