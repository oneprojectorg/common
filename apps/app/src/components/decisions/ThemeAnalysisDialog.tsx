'use client';

import { formatDate } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import type {
  ThemeAnalysisOutlier,
  ThemeAnalysisResult,
} from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { logger } from '@op/logging/client';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { Header3 } from '@op/sense/Header';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from '@op/sense/Item';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { useLocale } from 'next-intl';
import { type ReactNode, useCallback, useState } from 'react';
import { LuArrowRightLeft, LuMerge, LuPencilLine } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { MergeProposalDialog } from './MergeProposalDialog';
import { type ProposalRoute, proposalHref } from './proposalHrefs';

/** One proposal as the analysis names it. */
type AnalyzedProposal =
  ThemeAnalysisResult['themes'][number]['proposals'][number];

/**
 * Where the analysed proposals live, for linking each reference to its page.
 * The proposal's own profile id comes from the analysis; this is the rest of
 * the route.
 */
export type ThemeAnalysisRoute = Omit<ProposalRoute, 'profileId'>;

export interface ThemeAnalysisDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  result: ThemeAnalysisResult;
  /** Proposals the analysis read. */
  analyzedCount: number;
  /** Proposals the phase held when it ran. */
  total: number;
  /**
   * When the analysis finished, as an ISO string. Shown when given, so a reader
   * of a stored analysis can tell how old it is; a run that just finished in
   * front of them has no need of it.
   */
  completedAt?: string;
  /**
   * Controls rendered in the footer — the "Analyze again" action the button
   * owns. A slot rather than a callback, because the run's state (its label,
   * whether it can be pressed) lives with the button, not here.
   */
  actions?: ReactNode;
  /** See {@link ThemeAnalysisRoute}. */
  route: ThemeAnalysisRoute;
  /**
   * Whether the reader may merge proposals from here. The same gate as the
   * card menu's Merge item — the flag and the admin role — decided by the
   * caller, which already knows both.
   */
  canMerge: boolean;
}

/**
 * React component for a finished theme analysis: what the proposals are about,
 * where they already agree, who sits outside that agreement, and what to do
 * about it.
 *
 * Four sections, in that order, because that is the order a facilitator can act
 * on. Themes name the field. Common ground says what is already settled.
 * Outliers say who is not in it. Suggestions are the only part that asks anyone
 * to do anything, so they come last, once the reader can judge them.
 *
 * Every proposal the analysis names is a link to that proposal, and each
 * proposal in a merge suggestion carries the same Merge action the card menu
 * offers — so a facilitator who agrees with a suggestion can act on it from
 * here rather than go and find the card. The prose around the links is still
 * the model's, and is rendered as text: the affordances are the proposals
 * themselves, which are real, not the claims about them.
 *
 * The merge dialog is rendered inside this one rather than through the list's
 * provider. Base UI supports a dialog nested in another's tree — focus and
 * dismissal stack correctly — where two unrelated modals open at once do not,
 * and the reason the provider exists (a masonry grid remounting the card that
 * owned the dialog) does not apply to a dialog owned by a button in the filter
 * bar.
 *
 * Purely controlled. The run lives in {@link ThemeAnalysisButton}, so closing
 * this drops nothing the server holds.
 */
export const ThemeAnalysisDialog = ({
  isOpen,
  onOpenChange,
  result,
  analyzedCount,
  total,
  completedAt,
  actions,
  route,
  canMerge,
}: ThemeAnalysisDialogProps) => {
  const t = useTranslations();
  const locale = useLocale();

  return (
    // Closing retires the run, and the client drops the id it would need to
    // reopen it. The row survives, but nothing on screen can address it. A click
    // that lands beside the card is not a decision to put a two-model analysis
    // away, so it does not close this one. Escape still does, which is
    // deliberate and what a keyboard user expects.
    <Dialog open={isOpen} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('Themes and common ground')}</DialogTitle>
          {/* Stated on every analysis, not only short ones. A synthesis that
              covered part of the field still reads as a statement about the
              whole process unless it says otherwise. ICU `number` because these
              are locale-formatted. `DialogDescription` rather than a `p`, so it
              becomes the dialog's `aria-describedby`. */}
          <DialogDescription className="text-label text-muted-foreground">
            {t(
              'Based on {analyzedCount, number} of {total, number} proposals',
              {
                analyzedCount,
                total,
              },
            )}
            {completedAt && (
              <>
                {' · '}
                {t('Updated {date}', {
                  date: formatDate(completedAt, locale, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  }),
                })}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 px-6 pb-6">
          {/* Every section hides itself when empty, so a run that found nothing
              would otherwise render as a dialog with only a header — which reads
              as a loading bug rather than as an answer. */}
          {isEmpty(result) ? (
            <p className="text-label text-muted-foreground">
              {t(
                'The analysis finished but found nothing to report across these proposals.',
              )}
            </p>
          ) : (
            <>
              <ThemesSection themes={result.themes} route={route} />
              <CommonGroundSection
                commonGround={result.commonGround}
                route={route}
              />
              <OutliersSection outliers={result.outliers} route={route} />
              <SuggestionsSection
                suggestions={result.suggestions}
                route={route}
                canMerge={canMerge}
              />
            </>
          )}
        </div>

        {actions && <DialogFooter>{actions}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
};

/**
 * Did the run produce anything at all?
 *
 * A valid outcome, not a defect: a corpus of unrelated proposals genuinely has
 * no themes and no common ground, and the model is told to report the little
 * that is shared rather than manufacture agreement.
 */
const isEmpty = (result: ThemeAnalysisResult): boolean =>
  result.themes.length === 0 &&
  result.commonGround.length === 0 &&
  result.outliers.length === 0 &&
  result.suggestions.length === 0;

/**
 * A section heading with its body, or nothing when the section is empty.
 *
 * An empty section is dropped rather than rendered with a placeholder. "No
 * common ground found" and "we did not look" read the same to a facilitator, and
 * only one of them is true here — every section was asked for.
 */
const Section = ({
  title,
  isEmpty,
  children,
}: {
  title: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) => {
  if (isEmpty) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <Header3>{title}</Header3>
      {children}
    </section>
  );
};

/**
 * A proposal's title, linked to its page when it has one.
 *
 * The link is the card's link: the same `proposalHref` the grid, map and
 * results list build, so a route change reaches here with them. A proposal
 * with no profile — possible, the column is nullable — has no page to link to
 * and is named as text instead, rather than as a link that goes nowhere.
 *
 * `dir="auto"` because the title is the participant's own text, in whatever
 * script they wrote it, inside a dialog laid out for the facilitator's locale.
 */
const ProposalLink = ({
  proposal,
  route,
  className,
}: {
  proposal: AnalyzedProposal;
  route: ThemeAnalysisRoute;
  className?: string;
}) => {
  const t = useTranslations();
  const title = proposal.title || t('Untitled Proposal');

  if (!proposal.profileId) {
    return (
      <span dir="auto" className={className}>
        {title}
      </span>
    );
  }

  return (
    <Button
      variant="link"
      size="inline"
      dir="auto"
      // `text-start` so a multi-line title wraps like the text around it rather
      // than centring the way a button's label does; `whitespace-normal` for
      // the same reason — a title can run to a sentence.
      className={cn('text-start whitespace-normal', className)}
      render={
        <Link
          href={proposalHref({ ...route, profileId: proposal.profileId })}
        />
      }
    >
      {title}
    </Button>
  );
};

/**
 * The proposals a finding rests on, as linked titles.
 *
 * Rendered under every finding so a facilitator can check it against the text
 * rather than take it on the model's word — and now can, in one click. A finding
 * whose proposals all failed the grounding check renders nothing, which is the
 * honest outcome: the claim survived and its evidence did not.
 */
const ProposalRefs = ({
  proposals,
  route,
}: {
  proposals: AnalyzedProposal[];
  route: ThemeAnalysisRoute;
}) => {
  if (proposals.length === 0) {
    return null;
  }

  // A bulleted list rather than badges: proposal titles run to a full sentence,
  // and the badge is a fixed-height, non-wrapping element that would clip most
  // of them. `ps-` rather than `pl-` so the markers sit inside the text in RTL.
  return (
    <ul className="flex list-disc flex-col gap-0.5 ps-5">
      {proposals.map((proposal) => (
        <li key={proposal.id} className="text-label text-muted-foreground">
          <ProposalLink proposal={proposal} route={route} />
        </li>
      ))}
    </ul>
  );
};

const ThemesSection = ({
  themes,
  route,
}: {
  themes: ThemeAnalysisResult['themes'];
  route: ThemeAnalysisRoute;
}) => {
  const t = useTranslations();

  return (
    <Section title={t('Themes')} isEmpty={themes.length === 0}>
      <ul className="flex flex-col gap-4">
        {/* Keyed by position. Nothing here reorders or filters after render,
            and the model can return two themes under one title — which would
            collide on any content-derived key. */}
        {themes.map(({ title, summary, proposals }, position) => (
          <li key={position} className="flex flex-col gap-2">
            <p dir="auto" className="text-label font-strong">
              {title}
            </p>
            <p dir="auto" className="text-label text-muted-foreground">
              {summary}
            </p>
            <ProposalRefs proposals={proposals} route={route} />
          </li>
        ))}
      </ul>
    </Section>
  );
};

const CommonGroundSection = ({
  commonGround,
  route,
}: {
  commonGround: ThemeAnalysisResult['commonGround'];
  route: ThemeAnalysisRoute;
}) => {
  const t = useTranslations();

  return (
    <Section title={t('Common ground')} isEmpty={commonGround.length === 0}>
      <ul className="flex flex-col gap-4">
        {commonGround.map(({ statement, proposals }, position) => (
          <li key={position} className="flex flex-col gap-2">
            <p dir="auto" className="text-label">
              {statement}
            </p>
            <ProposalRefs proposals={proposals} route={route} />
          </li>
        ))}
      </ul>
    </Section>
  );
};

/**
 * The impact badge on an outlier.
 *
 * Its own component so the label and the variant are decided together. They are
 * the whole point of the outlier section: one list mixing "proposes something
 * nobody else does" with "differs in a detail" tells a facilitator nothing about
 * which one to read first.
 */
const OutlierImpactBadge = ({
  impact,
}: {
  impact: ThemeAnalysisOutlier['impact'];
}) => {
  const t = useTranslations();

  return impact === 'high-impact' ? (
    <Badge variant="default">{t('High impact')}</Badge>
  ) : (
    <Badge variant="outline">{t('Low impact')}</Badge>
  );
};

const OutliersSection = ({
  outliers,
  route,
}: {
  outliers: ThemeAnalysisResult['outliers'];
  route: ThemeAnalysisRoute;
}) => {
  const t = useTranslations();

  // High impact first, order preserved within each group. The section exists to
  // separate the outlier worth a conversation from the one worth a line in the
  // notes, and burying the first below six of the second undoes that.
  const sorted = [
    ...outliers.filter(({ impact }) => impact === 'high-impact'),
    ...outliers.filter(({ impact }) => impact !== 'high-impact'),
  ];

  return (
    <Section title={t('Outliers')} isEmpty={sorted.length === 0}>
      <ul className="flex flex-col gap-4">
        {/* Also keyed by position: the model can list one proposal twice, and
            two entries sharing a proposal id would collide. */}
        {sorted.map(({ proposal, impact, reason }, position) => (
          <li key={position} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <ProposalLink
                proposal={proposal}
                route={route}
                className="text-label font-strong"
              />
              <OutlierImpactBadge impact={impact} />
            </div>
            <p dir="auto" className="text-label text-muted-foreground">
              {reason}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
};

const SuggestionsSection = ({
  suggestions,
  route,
  canMerge,
}: {
  suggestions: ThemeAnalysisResult['suggestions'];
  route: ThemeAnalysisRoute;
  canMerge: boolean;
}) => {
  const t = useTranslations();

  return (
    <Section title={t('Suggestions')} isEmpty={suggestions.length === 0}>
      <ul className="flex flex-col gap-4">
        {suggestions.map(({ kind, rationale, proposals }, position) => (
          <li key={position} className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-label font-strong">
              {kind === 'merge' ? (
                <LuArrowRightLeft aria-hidden />
              ) : (
                <LuPencilLine aria-hidden />
              )}
              {kind === 'merge'
                ? t('Consider merging')
                : t('Consider revising')}
            </p>
            <p dir="auto" className="text-label text-muted-foreground">
              {rationale}
            </p>
            {/* Only a merge suggestion gets the action, and only for a reader
                who could merge from the card menu. A revise suggestion has no
                one-click action — the change is the author's to make. */}
            {kind === 'merge' && canMerge ? (
              <MergeableProposals proposals={proposals} route={route} />
            ) : (
              <ProposalRefs proposals={proposals} route={route} />
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
};

/**
 * The proposals a merge suggestion names, each with the card menu's Merge
 * action beside it.
 *
 * Merge is directional — one proposal is merged away into another — and the
 * suggestion names two or more without saying which survives. So the action
 * sits on each proposal: pressing it opens the same merge dialog the card
 * menu opens, with that proposal as the one being merged away, and the
 * facilitator picks the target there exactly as they would from the card.
 *
 * The analysis carries only what it needs to render; the merge dialog needs the
 * proposal itself. It is fetched on press, by profile id, through the same
 * `getProposal` the proposal page reads — rather than loaded up front for every
 * proposal in every suggestion, most of which will never be pressed.
 */
const MergeableProposals = ({
  proposals,
  route,
}: {
  proposals: AnalyzedProposal[];
  route: ThemeAnalysisRoute;
}) => {
  const t = useTranslations();
  const utils = trpc.useUtils();

  // The proposal being merged away, held past the close so the dialog animates
  // out rather than disappearing — the same shape as the list's provider.
  const [mergeSource, setMergeSource] = useState<Proposal | null>(null);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [loadingProfileId, setLoadingProfileId] = useState<string | null>(null);

  const handleMerge = useCallback(
    async (profileId: string) => {
      setLoadingProfileId(profileId);

      try {
        const proposal = await utils.decision.getProposal.fetch({ profileId });
        setMergeSource(proposal);
        setIsMergeOpen(true);
      } catch (error) {
        // The suggestion is still on screen and the card menu still works, so
        // the toast says where to go rather than what went wrong.
        logger.error('Could not load a proposal to merge from the analysis', {
          error,
          profileId,
        });
        toast.error(
          t("Couldn't open this proposal to merge. Try again from its card."),
        );
      } finally {
        setLoadingProfileId(null);
      }
    },
    [utils, t],
  );

  if (proposals.length === 0) {
    return null;
  }

  return (
    <>
      <ItemGroup>
        {proposals.map((proposal) => {
          const title = proposal.title || t('Untitled Proposal');
          // Its own binding so the narrowing below survives into the click
          // handler, which a property access would not.
          const { profileId } = proposal;

          return (
            <Item key={proposal.id} variant="outline" size="xs">
              <ItemContent>
                <ItemTitle>
                  <ProposalLink
                    proposal={proposal}
                    route={route}
                    className="text-label"
                  />
                </ItemTitle>
              </ItemContent>
              {/* A proposal with no profile cannot be loaded by the endpoint
                  the dialog needs, so it gets no action rather than one that
                  fails on press. */}
              {profileId && (
                <ItemActions>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={loadingProfileId === profileId}
                    // One load at a time. Two dialogs cannot be open, and a
                    // second press while the first is loading would race to
                    // decide which proposal the dialog shows.
                    disabled={loadingProfileId !== null}
                    aria-label={t('Merge {title} with another proposal', {
                      title,
                    })}
                    onClick={() => handleMerge(profileId)}
                  >
                    <LuMerge aria-hidden />
                    {t('Merge')}
                  </Button>
                </ItemActions>
              )}
            </Item>
          );
        })}
      </ItemGroup>

      {mergeSource ? (
        <MergeProposalDialog
          proposal={mergeSource}
          open={isMergeOpen}
          onOpenChange={setIsMergeOpen}
        />
      ) : null}
    </>
  );
};
