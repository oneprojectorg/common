'use client';

import { formatDate } from '@/utils/formatting';
import type { ThemeAnalysisResult } from '@op/api/encoders';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { useLocale } from 'next-intl';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import type { ThemeAnalysisRoute } from './ThemeAnalysisSections';
import { ThemeAnalysisSections } from './ThemeAnalysisSections';

// Re-exported because this is where callers already look for it, and the dialog
// is still the type's most common call site.
export type { ThemeAnalysisRoute } from './ThemeAnalysisSections';

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
          <ThemeAnalysisSections
            result={result}
            route={route}
            canMerge={canMerge}
          />
        </div>

        {actions && <DialogFooter>{actions}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
};
