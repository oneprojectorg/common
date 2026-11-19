'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@op/sense/Accordion';
import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import { Input } from '@op/sense/Input';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@op/sense/Sheet';
import { useFormatter } from 'next-intl';
import { useState } from 'react';
import { LuListFilter, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { FieldFilters } from './fieldFilterParams';
import { countFieldFilters } from './fieldFilterParams';
import type { ChoiceCriterionView } from './rubricChoiceCriteria';

/**
 * `criterionKey -> optionId -> count`, built by `indexFacetCounts`. A missing
 * entry renders no count rather than a zero — "not counted yet" and "none
 * left" are different things, and only one of them should read as a dead end.
 */
export type FacetCountIndex = Map<string, Map<string, number>>;

interface ReviewQueueFilterSheetProps {
  /** One accordion section per rubric choice criterion, in rubric order. */
  criteria: ChoiceCriterionView[];
  filters: FieldFilters;
  counts: FacetCountIndex;
  /** Assignments matching the current filters — the footer's N. */
  total: number;
  /** A refetch is in flight; the numbers on screen are for an earlier set. */
  isPending: boolean;
  onToggle: (key: string, optionId: string) => void;
  onClearAll: () => void;
}

/**
 * The review queue's "Filter" control: a toolbar button and the right-side
 * sheet it opens, listing every rubric choice criterion as an accordion
 * section of checkboxes with per-option counts.
 *
 * Checking an option applies immediately — the queue behind the sheet
 * refetches and the counts come back narrowed, which is the whole point of
 * faceting. The footer's primary button therefore only dismisses the sheet;
 * it reads "Show N proposals" because N is what dismissing reveals.
 */
export function ReviewQueueFilterSheet({
  criteria,
  filters,
  counts,
  total,
  isPending,
  onToggle,
  onClearAll,
}: ReviewQueueFilterSheetProps) {
  const t = useTranslations();
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const activeCount = countFieldFilters(filters);

  return (
    <>
      {/* `font-normal` + `shadow-none` so it reads as a sibling of the selects
          beside it rather than an action; `h-11` matches their height. */}
      <Button
        variant="outline"
        className="shrink-0 gap-2 font-normal shadow-none"
        onClick={() => setOpen(true)}
      >
        <LuListFilter aria-hidden />
        {t('Filter')}
        {activeCount > 0 ? (
          <span aria-hidden className="text-muted-foreground tabular-nums">
            {format.number(activeCount)}
          </span>
        ) : null}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="gap-0 p-0"
          // Sense's built-in close carries an untranslated accessible name.
          showCloseButton={false}
        >
          <SheetHeader className="shrink-0 border-b">
            <SheetTitle>{t('Filter proposals')}</SheetTitle>
          </SheetHeader>

          <div className="shrink-0 p-4">
            <SearchWithinProposals />
          </div>

          <Accordion
            multiple
            // Every section open by default: the reader came to scan the
            // options, not to hunt for them.
            defaultValue={criteria.map((criterion) => criterion.key)}
            className="min-h-0 flex-1 overflow-y-auto border-t"
          >
            {criteria.map((criterion) => (
              <AccordionItem key={criterion.key} value={criterion.key}>
                <AccordionTrigger className="items-center px-4 hover:no-underline">
                  {/* The rubric's own prompt — admin-authored content. */}
                  <span className="flex flex-1 items-center gap-2 text-label">
                    {criterion.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3">
                  <div className="flex flex-col">
                    {criterion.options.map((option) => (
                      <OptionRow
                        key={option.id}
                        criterionKey={criterion.key}
                        optionId={option.id}
                        label={option.label}
                        count={counts.get(criterion.key)?.get(option.id)}
                        checked={
                          filters[criterion.key]?.includes(option.id) ?? false
                        }
                        onToggle={onToggle}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <SheetFooter className="shrink-0 flex-row items-center justify-between gap-2 border-t">
            <Button
              variant="link"
              disabled={activeCount === 0}
              onClick={onClearAll}
            >
              {t('Clear all')}
            </Button>
            {/* The count changes without a navigation, so the button's own
                label is the live region. */}
            <SheetClose render={<Button />} aria-live="polite">
              {isPending
                ? t('Counting proposals...')
                : t(
                    'Show {count, plural, one {# proposal} other {# proposals}}',
                    { count: total },
                  )}
            </SheetClose>
          </SheetFooter>

          <SheetClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute end-4 top-4 opacity-70 hover:bg-transparent hover:opacity-100"
              />
            }
          >
            <LuX />
            <span className="sr-only">{t('Close')}</span>
          </SheetClose>
        </SheetContent>
      </Sheet>
    </>
  );
}

function OptionRow({
  criterionKey,
  optionId,
  label,
  count,
  checked,
  onToggle,
}: {
  criterionKey: string;
  optionId: string;
  label: string;
  count: number | undefined;
  checked: boolean;
  onToggle: (key: string, optionId: string) => void;
}) {
  const format = useFormatter();
  const inputId = `review-queue-filter-${criterionKey}-${optionId}`;

  return (
    // The whole row is the label, so the option text and the count are both
    // part of the checkbox's accessible name and both are click targets.
    <label
      htmlFor={inputId}
      id={`${inputId}-label`}
      className="flex cursor-pointer items-center gap-3 rounded-md py-2 ps-1 pe-1 hover:bg-muted"
    >
      <Checkbox
        id={inputId}
        className="size-4"
        aria-labelledby={`${inputId}-label`}
        checked={checked}
        onCheckedChange={() => onToggle(criterionKey, optionId)}
      />
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined ? (
        <span className="text-label tabular-nums">{format.number(count)}</span>
      ) : null}
    </label>
  );
}

/**
 * The design's search box. `listReviewAssignments` has no text-search
 * parameter, so the field is present but inert — an enabled field filtering
 * only the loaded page would break both the count and pagination.
 *
 * `disabled` makes that visible, and the reason is carried in an `sr-only`
 * note: the design has no room for a visible hint, but a dead control with no
 * explanation is only obvious to someone who can see it greyed out.
 */
function SearchWithinProposals() {
  const t = useTranslations();

  return (
    <>
      <Input
        type="search"
        disabled
        placeholder={t('Search within proposals')}
        aria-label={t('Search within proposals')}
        aria-describedby="review-queue-filter-search-hint"
      />
      <span id="review-queue-filter-search-hint" className="sr-only">
        {t('Search is not available in the review queue yet.')}
      </span>
    </>
  );
}
