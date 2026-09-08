'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@op/sense/Accordion';
import { BadgeNumber } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { Input } from '@op/sense/Input';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@op/sense/Sheet';
import { Tabs, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { Tag, TagGroup } from '@op/sense/TagGroup';
import { ToggleGroup, ToggleGroupItem } from '@op/sense/ToggleGroup';
import { cn } from '@op/sense/lib/utils';
import { useState } from 'react';
import {
  LuArrowUpDown,
  LuCheck,
  LuDownload,
  LuLayoutGrid,
  LuListFilter,
  LuMap,
  LuSearch,
  LuX,
} from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import {
  type DimensionKey,
  PROPOSAL_DIMENSIONS,
  dimensionValues,
} from './proposalFixtures';

/** What the list is ordered by. `newest` is the default and reads as none. */
export const SORTS = [
  { key: 'newest', label: 'Newest First' },
  { key: 'oldest', label: 'Oldest First' },
  { key: 'reactions', label: 'Most Reactions' },
  { key: 'comments', label: 'Most Comments' },
  { key: 'budget-desc', label: 'Budget: High to Low' },
  { key: 'budget-asc', label: 'Budget: Low to High' },
] as const;

export type SortKey = (typeof SORTS)[number]['key'];

/** Whose {items} the list shows. Orthogonal to the filters, hence its own flag. */
export type ProposalScope = 'all' | 'mine';

/** Every dimension's chosen values, plus the text typed into the panel. */
export interface ProposalFilters {
  selections: Record<DimensionKey, string[]>;
  query: string;
}

export const NO_FILTERS: ProposalFilters = {
  selections: { category: [], neighborhood: [] },
  query: '',
};

/**
 * One filter counts as one, whichever dimension it is in. The search term is
 * not among them: it has its own field in the bar, where it can be read and
 * cleared, and counting it here would put a number on a panel that no longer
 * contains the thing being counted.
 */
export function activeFilterCount(filters: ProposalFilters): number {
  return Object.values(filters.selections).flat().length;
}

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * The list's controls. Filtering is one button rather than a select per
 * dimension: the dimensions come from the submission form, so there could be
 * five of them, and a bar that grows a control per question is a bar that stops
 * fitting. Everything else is an icon, because the row has to survive that.
 */
export function PrototypeProposalsToolbar({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  view,
  onViewChange,
  onExport,
  matching,
  countFor,
  nouns,
  scope,
  onScopeChange,
}: {
  filters: ProposalFilters;
  onFiltersChange: (next: ProposalFilters) => void;
  sort: SortKey;
  onSortChange: (next: SortKey) => void;
  view: 'grid' | 'map';
  onViewChange: (next: 'grid' | 'map') => void;
  onExport: () => void;
  /** How many survive the filters as they stand. */
  matching: number;
  /** How many would survive if this one option were also on. */
  countFor: (key: DimensionKey, value: string) => number;
  nouns: { one: string; many: string };
  scope: ProposalScope;
  onScopeChange: (next: ProposalScope) => void;
}) {
  const t = useTranslations();
  const sortLabel = SORTS.find((option) => option.key === sort)?.label;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Whose {items} you are looking at, which is a different question from
          which of them — so it is a segmented control on the left rather than
          another row in the filter panel. Two answers, both always visible: a
          dropdown would hide whichever one you were not in.
          `Tabs` at its default variant is the design system's segmented
          control — a tinted track with the chosen segment lifted out of it. */}
      <Tabs
        value={scope}
        onValueChange={(next) =>
          onScopeChange(next === 'mine' ? 'mine' : 'all')
        }
      >
        <TabsList aria-label={t('Whose {items}', { items: nouns.many })}>
          <TabsTrigger value="all">
            {t('All {items}', { items: nouns.many })}
          </TabsTrigger>
          <TabsTrigger value="mine">
            {t('My {items}', { items: nouns.many })}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2">
        {/* Ahead of `Filter`, because it is the same job done a faster way: a
            word you already know, against a panel of choices you have to read.
            Collapsed it is an icon the width of a button; opened it is the
            field. */}
        <ToolbarSearch
          value={filters.query}
          onChange={(query) => onFiltersChange({ ...filters, query })}
          nouns={nouns}
        />

        <FilterSheet
          filters={filters}
          onFiltersChange={onFiltersChange}
          matching={matching}
          countFor={countFor}
          nouns={nouns}
        />

        {/* The default order is the absence of a choice, so the button says what
            it does rather than restating it. Any other order is a state you set,
            and the button carries it. */}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>
            <LuArrowUpDown className="size-4" aria-hidden />
            {sort === 'newest' ? t('Sort') : t(sortLabel ?? 'Sort')}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SORTS.map((option) => (
              <DropdownMenuItem
                key={option.key}
                onClick={() => onSortChange(option.key)}
              >
                <span className="flex-1">{t(option.label)}</span>
                {option.key === sort ? (
                  <LuCheck className="size-4" aria-hidden />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                aria-label={t('Export {items}', { items: nouns.many })}
              />
            }
          >
            <LuDownload className="size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="items-start" onClick={onExport}>
              <span className="flex flex-col gap-0.5">
                {t('Export as CSV')}
                {/* What you are about to get, not what exists: an export that
                    quietly ignores the filters on screen is the wrong file. */}
                <span className="text-sm text-muted-foreground">
                  {t('{count} {items}, current filters applied', {
                    count: matching,
                    items: nouns.many,
                  })}
                </span>
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Offered because the submission form collects a location — the same
            condition prod gates it on. */}
        <div className="hidden items-center sm:flex">
          <ToggleGroup
            value={[view]}
            onValueChange={(next) =>
              onViewChange(next.includes('map') ? 'map' : 'grid')
            }
            variant="outline"
            size="icon"
            spacing={0}
            aria-label={t('{Item} view', {
              Item: nouns.one.charAt(0).toUpperCase() + nouns.one.slice(1),
            })}
          >
            <ToggleGroupItem value="grid" aria-label={t('Grid view')}>
              <LuLayoutGrid className="size-4" aria-hidden />
            </ToggleGroupItem>
            <ToggleGroupItem value="map" aria-label={t('Map view')}>
              <LuMap className="size-4" aria-hidden />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
    </div>
  );
}

/**
 * Search as a filter, and the fastest one: type a word you remember instead of
 * reading a panel of choices. Collapsed it is an icon the width of a button, so
 * it costs the bar nothing; clicking it grows the same box into the field.
 *
 * It stays open while there is something in it — a term you cannot see is a list
 * narrowed for reasons that have gone invisible. Emptying it and leaving, or
 * pressing Escape, puts the icon back.
 */
function ToolbarSearch({
  value,
  onChange,
  nouns,
}: {
  value: string;
  onChange: (next: string) => void;
  nouns: { one: string; many: string };
}) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const label = t('Search {items}', { items: nouns.many });
  // Never collapsed under a live term, whether or not the field has focus.
  const isExpanded = isOpen || value.trim().length > 0;

  const collapse = () => {
    onChange('');
    setIsOpen(false);
  };

  return (
    /* The width is the animation: the box grows and the field grows with it, so
       nothing has to be clipped to hide it. */
    <div
      className={cn(
        'relative shrink-0 transition-[width] duration-200 ease-out motion-reduce:transition-none',
        isExpanded ? 'w-56' : 'w-11',
      )}
    >
      {isExpanded ? (
        <>
          <LuSearch
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            autoFocus
            value={value}
            aria-label={label}
            placeholder={label}
            className="w-full ps-9 pe-9"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                collapse();
              }
            }}
            /* Leaving an empty field puts the icon back; leaving a full one does
               not, because the term is still doing something to the list. */
            onBlur={() => {
              if (!value.trim()) {
                setIsOpen(false);
              }
            }}
          />
          {value ? (
            <Button
              variant="bare"
              size="icon-sm"
              aria-label={t('Clear the search')}
              className="absolute end-1 top-1/2 -translate-y-1/2"
              onClick={collapse}
            >
              <LuX className="size-4" aria-hidden />
            </Button>
          ) : null}
        </>
      ) : (
        <Button
          variant="outline"
          size="icon"
          aria-label={label}
          className="w-full"
          onClick={() => setIsOpen(true)}
        >
          <LuSearch className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}

/**
 * Every way of narrowing the list, in a panel beside it. A sheet rather than a
 * popover: the dimensions come from the form so the list of values grows with
 * it, and a floating panel that has to fit under its own button is the wrong
 * shape for that. No apply step — each change lands immediately, and the count
 * at the foot of the panel is the answer.
 *
 * Search is not in here. It is a field in the bar, where the term stays visible
 * while it is doing something to the list.
 */
function FilterSheet({
  filters,
  onFiltersChange,
  matching,
  countFor,
  nouns,
}: {
  filters: ProposalFilters;
  onFiltersChange: (next: ProposalFilters) => void;
  matching: number;
  countFor: (key: DimensionKey, value: string) => number;
  nouns: { one: string; many: string };
}) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  // Every dimension open from the start: the panel is a list of what you can
  // narrow by, and a closed group is that list withholding half of itself.
  const [open, setOpen] = useState<string[]>(
    PROPOSAL_DIMENSIONS.map((dimension) => dimension.key),
  );
  const count = activeFilterCount(filters);

  const toggle = (key: DimensionKey, value: string) => {
    const current = filters.selections[key];

    onFiltersChange({
      ...filters,
      selections: {
        ...filters.selections,
        [key]: current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value],
      },
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger render={<Button variant="outline" />}>
        <LuListFilter className="size-4" aria-hidden />
        {t('Filter')}
        {count > 0 ? <BadgeNumber className="ms-1">{count}</BadgeNumber> : null}
      </SheetTrigger>
      <SheetContent className="gap-0 p-0">
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>{t('Filter {items}', { items: nouns.many })}</SheetTitle>
        </SheetHeader>

        {/* Every section can be open at once. In a popover one at a time kept
            the panel short; in a sheet there is a column of room, and closing
            one group to read another means losing sight of what you already
            picked. */}
        <Accordion
          multiple
          value={open}
          onValueChange={(next) => setOpen(next.map(String))}
          className="min-h-0 flex-1 overflow-y-auto border-t"
        >
          {PROPOSAL_DIMENSIONS.map((dimension) => {
            const chosen = filters.selections[dimension.key];

            return (
              <AccordionItem key={dimension.key} value={dimension.key}>
                <AccordionTrigger className="items-center px-4 hover:no-underline">
                  <span className="flex flex-1 items-center gap-2 text-label">
                    {t(dimension.label)}
                    {/* On the header because a closed section still has to say
                        it is doing something to the list behind the panel. */}
                    {chosen.length > 0 ? (
                      <BadgeNumber>{chosen.length}</BadgeNumber>
                    ) : null}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3">
                  <div className="flex flex-col">
                    {dimensionValues(dimension.key).map((value) => (
                      <FilterOption
                        key={value}
                        dimension={dimension.key}
                        value={value}
                        checked={chosen.includes(value)}
                        count={countFor(dimension.key, value)}
                        onToggle={() => toggle(dimension.key, value)}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* The count as the button: the filters are already applied, so this
            confirms what they left and closes the panel over the answer. */}
        <SheetFooter className="shrink-0 flex-row items-center justify-between border-t">
          <Button
            variant="link"
            disabled={count === 0}
            onClick={() => onFiltersChange(NO_FILTERS)}
          >
            {t('Clear all')}
          </Button>
          <Button onClick={() => setIsOpen(false)}>
            {t('Show {count} {items}', {
              count: matching,
              // One of them is not "1 proposals".
              items: matching === 1 ? nouns.one : nouns.many,
            })}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** One checkbox, its label, and what picking it would leave you with. */
function FilterOption({
  dimension,
  value,
  checked,
  count,
  onToggle,
}: {
  dimension: DimensionKey;
  value: string;
  checked: boolean;
  count: number;
  onToggle: () => void;
}) {
  const id = `filter-${dimension}-${value.replace(/\W+/g, '-')}`;

  return (
    /* The whole row is the label, so the target is the row rather than a 16px
       box — and the count rides inside it, which is why it is a `<label>` with a
       gap rather than a `FieldLabel`. */
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-3 rounded-md py-2 ps-1 pe-1 hover:bg-muted"
    >
      <Checkbox id={id} checked={checked} onCheckedChange={onToggle} />
      <span className="flex-1 truncate">{value}</span>
      <span className={cn('text-sm', count === 0 && 'text-muted-foreground')}>
        {count}
      </span>
    </label>
  );
}

/**
 * What the list is currently showing and why, under the toolbar. Every active
 * filter is here as something you can take off — the popover is where you set
 * them, but you shouldn't have to open it to find out what is on.
 */
export function PrototypeFilterSummary({
  filters,
  onFiltersChange,
  shown,
  matching,
  nouns,
}: {
  filters: ProposalFilters;
  onFiltersChange: (next: ProposalFilters) => void;
  shown: number;
  matching: number;
  nouns: { one: string; many: string };
}) {
  const t = useTranslations();
  const count = activeFilterCount(filters);
  const query = filters.query.trim();

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-sm text-muted-foreground" aria-live="polite">
        <span className="font-strong text-foreground">{shown}</span>{' '}
        {t('of {total} {items}', { total: matching, items: nouns.many })}
      </span>

      {count > 0 ? (
        <TagGroup aria-label={t('Active filters')}>
          {query ? (
            <Tag
              onRemove={() => onFiltersChange({ ...filters, query: '' })}
              removeLabel={t('Clear the search')}
            >
              <span className="flex items-center gap-1.5">
                <LuSearch className="size-3" aria-hidden />
                {`“${query}”`}
              </span>
            </Tag>
          ) : null}
          {PROPOSAL_DIMENSIONS.flatMap((dimension) =>
            filters.selections[dimension.key].map((value) => (
              <Tag
                key={`${dimension.key}-${value}`}
                onRemove={() =>
                  onFiltersChange({
                    ...filters,
                    selections: {
                      ...filters.selections,
                      [dimension.key]: filters.selections[dimension.key].filter(
                        (item) => item !== value,
                      ),
                    },
                  })
                }
                removeLabel={t('Remove the {value} filter', { value })}
              >
                {value}
              </Tag>
            )),
          )}
        </TagGroup>
      ) : null}

      {count > 0 ? (
        <Button
          variant="link"
          size="sm"
          onClick={() => onFiltersChange(NO_FILTERS)}
        >
          {t('Clear all')}
        </Button>
      ) : null}
    </div>
  );
}
