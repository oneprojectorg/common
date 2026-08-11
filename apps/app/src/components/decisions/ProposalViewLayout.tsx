'use client';

import { useUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import { Button } from '@op/ui/Button';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { ReactNode } from 'react';
import {
  LuArrowLeft,
  LuBookmark,
  LuHeart,
  LuPencil,
  LuStickyNote,
} from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { useRouter } from '@/lib/i18n/routing';

import { LocaleChooser } from '../LocaleChooser';
import { JoinAccountModal, JoinOrUserMenu } from './JoinAccountModal';
import { ReportProposalDialog } from './ReportProposalDialog';

export function ProposalViewLayout({
  children,
  backHref,
  title,
  onLike,
  onFollow,
  isLiked = false,
  isFollowing = false,
  isLoading = false,
  editHref,
  canEdit = false,
  canEngage = false,
  canJoin = false,
  reportProposalId,
  revisionToggle,
}: {
  children: ReactNode;
  backHref: string;
  title?: string;
  onLike?: () => void;
  onFollow?: () => void;
  isLiked?: boolean;
  isFollowing?: boolean;
  isLoading?: boolean;
  editHref?: string;
  canEdit?: boolean;
  /** Mirrors the server-side engagement gate — hides Like/Follow otherwise. */
  canEngage?: boolean;
  /**
   * Public process (viewer can submit proposals without an account): the
   * header offers "Join" (account claim, see JoinAccountModal) instead of
   * "Log in" to logged-out and anonymous visitors.
   */
  canJoin?: boolean;
  /** When set, renders the "Report" action (opens the report dialog) for the
   *  proposal with this id. */
  reportProposalId?: string;
  /**
   * When provided, renders a sticky-note toggle button in the header with an
   * orange indicator dot. `isActive` reflects the aria-pressed state.
   */
  revisionToggle?: {
    onToggle: () => void;
    isActive: boolean;
  };
}) {
  const t = useTranslations();
  const router = useRouter();
  const { user } = useUser();
  const revisionRequestLabel = t('Revision request');

  return (
    <div className="grid h-screen min-h-0 min-w-0 grid-cols-1 grid-rows-[auto_1fr] bg-white">
      {/* Header (pinned — fixed grid row above the scrolling body) */}
      <div className="grid grid-cols-3 items-center border-b px-6 py-4">
        <button
          onClick={() => router.push(backHref)}
          className="flex cursor-pointer items-center gap-2 text-base text-primary-teal hover:text-primary-tealBlack"
        >
          <LuArrowLeft className="size-6 text-neutral-charcoal sm:size-4 sm:text-primary-teal rtl:-scale-x-100" />
          <span className="hidden sm:block">{t('Back to Proposals')}</span>
        </button>

        <div className="flex justify-center text-lg font-medium text-neutral-black">
          {title ?? null}
        </div>

        <div className="flex items-center justify-end gap-4">
          {canEdit && editHref && (
            <Button
              color="secondary"
              surface="outline"
              size="small"
              onPress={() => router.push(editHref)}
              className="px-4 py-2"
            >
              <LuPencil className="h-4 w-4" />
              {t('Edit')}
            </Button>
          )}
          {/* Report is a safety action the moderation API accepts from any
              caller (signed-in, anonymous, or sessionless). Offer it to any
              viewer so inappropriate content is always flaggable. */}
          {reportProposalId && (
            <ReportProposalDialog proposalId={reportProposalId} />
          )}
          {/* Like/Follow are user-scoped writes gated at the API — only offer
              them to a signed-in, non-anonymous member with engagement
              access. */}
          {userCanInteract(user) && canEngage ? (
            <>
              <Button
                surface="outline"
                color={isLiked ? 'verified' : 'secondary'}
                size="small"
                onPress={onLike}
                isDisabled={isLoading}
              >
                <LuHeart className="size-4" />
                {isLiked ? t('Liked') : t('Like')}
              </Button>
              <Button
                surface="outline"
                color={isFollowing ? 'verified' : 'secondary'}
                size="small"
                onPress={onFollow}
              >
                <LuBookmark className="size-4" />

                {isFollowing ? t('Following') : t('Follow')}
              </Button>
            </>
          ) : null}
          {revisionToggle && (
            <TooltipTrigger>
              <Button
                color="secondary"
                variant="icon"
                size="small"
                onPress={revisionToggle.onToggle}
                aria-label={revisionRequestLabel}
                aria-pressed={revisionToggle.isActive}
                className="relative size-8 min-w-8 rounded-sm p-0"
              >
                <LuStickyNote className="size-4" />
                <span
                  aria-hidden
                  className="absolute -end-0.5 -top-0.5 size-1.5 rounded-full bg-primary-orange2"
                />
              </Button>
              <Tooltip>{revisionRequestLabel}</Tooltip>
            </TooltipTrigger>
          )}
          <div className="hidden sm:block">
            <LocaleChooser />
          </div>
          {/* Outside the sm-only cluster: Join stays visible on mobile (the
              avatar keeps its desktop-only treatment via userMenuClassName). */}
          <JoinOrUserMenu
            canJoin={canJoin}
            userMenuClassName="hidden sm:block"
          />
        </div>
      </div>

      <div className="relative min-h-0 overflow-y-auto">{children}</div>

      {/* Mounted outside the sm-only header cluster so a `?join=1` deep link
          still opens the modal on mobile. */}
      {canJoin ? <JoinAccountModal /> : null}
    </div>
  );
}
