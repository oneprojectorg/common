'use client';

import type {
  ThemeAnalysisOutlier,
  ThemeAnalysisResult,
} from '@op/api/encoders';
import { Badge } from '@op/sense/Badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { Header3 } from '@op/sense/Header';
import { LuArrowRightLeft, LuPencilLine } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

export interface ThemeAnalysisDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  result: ThemeAnalysisResult;
  /** Proposals the analysis read. */
  analyzedCount: number;
  /** Proposals the phase held when it ran. */
  total: number;
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
 * Nothing here is a link. Every proposal named by the analysis is rendered as
 * its title, as text — the model wrote the prose around it, and prose from a
 * model that read public submissions is not something to hand a reader as an
 * affordance. Reading the proposal itself is one search away in the list behind
 * this dialog.
 *
 * Purely presentational and purely controlled. The run lives in
 * {@link ThemeAnalysisButton}, so closing this drops nothing.
 */
export const ThemeAnalysisDialog = ({
  isOpen,
  onOpenChange,
  result,
  analyzedCount,
  total,
}: ThemeAnalysisDialogProps) => {
  const t = useTranslations();

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
              <ThemesSection themes={result.themes} />
              <CommonGroundSection commonGround={result.commonGround} />
              <OutliersSection outliers={result.outliers} />
              <SuggestionsSection suggestions={result.suggestions} />
            </>
          )}
        </div>
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
 * The proposals a finding rests on, as plain titles.
 *
 * Rendered under every finding so a facilitator can check it against the text
 * rather than take it on the model's word. A finding whose proposals all failed
 * the grounding check renders nothing, which is the honest outcome: the claim
 * survived and its evidence did not.
 */
const ProposalRefs = ({
  proposals,
}: {
  proposals: Array<{ id: string; title: string }>;
}) => {
  const t = useTranslations();

  if (proposals.length === 0) {
    return null;
  }

  // A bulleted list rather than badges: proposal titles run to a full sentence,
  // and the badge is a fixed-height, non-wrapping element that would clip most
  // of them. `ps-` rather than `pl-` so the markers sit inside the text in RTL.
  return (
    <ul className="flex list-disc flex-col gap-0.5 ps-5">
      {proposals.map(({ id, title }) => (
        <li key={id} dir="auto" className="text-label text-muted-foreground">
          {title || t('Untitled Proposal')}
        </li>
      ))}
    </ul>
  );
};

const ThemesSection = ({
  themes,
}: {
  themes: ThemeAnalysisResult['themes'];
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
            <ProposalRefs proposals={proposals} />
          </li>
        ))}
      </ul>
    </Section>
  );
};

const CommonGroundSection = ({
  commonGround,
}: {
  commonGround: ThemeAnalysisResult['commonGround'];
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
            <ProposalRefs proposals={proposals} />
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
}: {
  outliers: ThemeAnalysisResult['outliers'];
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
              <span dir="auto" className="text-label font-strong">
                {proposal.title || t('Untitled Proposal')}
              </span>
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
}: {
  suggestions: ThemeAnalysisResult['suggestions'];
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
            <ProposalRefs proposals={proposals} />
          </li>
        ))}
      </ul>
    </Section>
  );
};
