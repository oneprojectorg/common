'use client';

import { Avatar, AvatarFallback } from '@op/sense/Avatar';
import { Button } from '@op/sense/Button';
import { GrowingFacePile } from '@op/sense/FacePile';
import { GradientHeader, Header1 } from '@op/sense/Header';
import { ProposalCard } from '@op/sense/ProposalCard';
import { StatusBadge } from '@op/sense/StatusBadge';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import type { PhaseType } from '@/components/decisions/CreateProcessWizard/types';

import {
  NO_FILTERS,
  type ProposalFilters,
  type ProposalScope,
  PrototypeFilterSummary,
  PrototypeProposalsToolbar,
  type SortKey,
} from './PrototypeProposalsToolbar';
import { PROTOTYPE_USER } from './fakeUser';
import {
  formatBudget,
  type DimensionKey,
  PROPOSAL_DIMENSIONS,
  PROPOSALS,
  type PrototypeProposal,
} from './proposalFixtures';
import { type PrototypeProcess, vocabulary } from './store';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * The Current Phase tab, as a picture. Prod routes this tab through
 * `DecisionStateRouter` to one of six pages — review, voting, results, two
 * selection views and the standard browse view. This is the standard one
 * (`StandardDecisionPage`), which is what a phase that is collecting or showing
 * proposals renders, assembled from the same parts: `DecisionHeroBanner` around
 * `DecisionHero`, the participation face pile, the action bar, then
 * `ProposalsList`'s filter bar over the card grid.
 *
 * Nothing here is wired. It exists so a reviewer can see the setup flow's
 * output next to what participants meet, so the proposals are fixtures and the
 * filters are set to their defaults with no handlers behind them. What *is*
 * real is the phase it reads from: the name, the window and the headline come
 * from whatever the process was actually set up with.
 */
export function PrototypeCurrentPhasePage({
  process,
}: {
  process: PrototypeProcess;
}) {
  const t = useTranslations();
  const phase = process.phases[process.currentPhaseIndex];
  const nouns = vocabulary(process, phase?.phaseType);
  /* The phase's own name, which is what the rail beside it says and what the
     admin wrote. A generic headline per type made the two disagree about which
     phase you were looking at. */
  const headline =
    phase?.name || (phase ? PHASE_HEADLINE[phase.phaseType] : '');

  return (
    // Muted ground under the banner, white under the list: prod's own split,
    // and what makes the grid read as the page's content rather than as more
    // of the header.
    <div className="min-h-full bg-muted">
      <section
        className={cn(
          'relative w-full overflow-hidden',
          // The same ground the process page's hero takes, for the same reason:
          // a scrim over a photograph needs something dark behind it wherever
          // the image doesn't reach.
          process.banner ? 'bg-foreground' : 'bg-muted',
        )}
      >
        {/* The process's banner, on the process's other page. It is the header
            of the thing, not of one screen of it — carrying it here is what
            makes the two read as the same process rather than two pages that
            happen to share a name. */}
        {process.banner ? (
          <>
            <img
              src={process.banner}
              alt=""
              className="absolute inset-0 size-full scale-110 object-cover blur-[6px]"
            />
            <div aria-hidden className="absolute inset-0 bg-black/45" />
          </>
        ) : null}

        <div className="relative z-10 mx-auto flex max-w-3xl flex-col justify-center gap-8 px-4 pt-16 pb-8 md:pb-16">
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col gap-2 text-center">
              {/* A gradient clipped to text loses all its contrast over a
                  photograph, so over one the headline goes plain white. */}
              {process.banner ? (
                <Header1 className="text-white">
                  <bdi>{headline}</bdi>
                </Header1>
              ) : (
                <GradientHeader>
                  <Header1>
                    <bdi>{headline}</bdi>
                  </Header1>
                </GradientHeader>
              )}
            </div>

            {/* `MemberParticipationFacePile`: who has taken part, ahead of the
                controls to take part yourself. */}
            <div className="flex items-center justify-center gap-2">
              <GrowingFacePile
                maxItems={20}
                totalCount={process.participantCount ?? SUBMITTERS.length}
                items={SUBMITTERS.map((name) => (
                  <Avatar key={name}>
                    <AvatarFallback name={name} />
                  </Avatar>
                ))}
              >
                <span
                  className={cn(
                    'w-fit text-sm',
                    process.banner ? 'text-white' : 'text-foreground',
                  )}
                >
                  {t('{count} members have taken part', {
                    count: process.participantCount ?? SUBMITTERS.length,
                  })}
                </span>
              </GrowingFacePile>
            </div>
          </div>

          {/* `DecisionActionBar`, down to the one thing there is to do here.
              Narrow, and centred under the hero rather than filling it. */}
          <div className="flex w-full justify-center">
            <div className="flex w-full max-w-48 flex-col items-center justify-center gap-4 sm:flex-row">
              <Button className="w-full">
                {t('Start {an} {item}', {
                  an: /^[aeiou]/i.test(nouns.one) ? 'an' : 'a',
                  item: nouns.one,
                })}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="flex w-full flex-col items-center bg-background">
        <div className="flex w-full flex-col gap-6 p-4 sm:p-8">
          <div className="relative flex flex-col gap-6 pb-12">
            <ProposalsBrowser nouns={nouns} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The list and everything that narrows it. One component because the count, the
 * chips, the options' own counts and the export all read the same derived list —
 * split across the bar and the grid, each of them would have to derive it again
 * and they would disagree the first time one of them was changed.
 */
function ProposalsBrowser({ nouns }: { nouns: ReturnType<typeof vocabulary> }) {
  const t = useTranslations();
  const [filters, setFilters] = useState<ProposalFilters>(NO_FILTERS);
  const [sort, setSort] = useState<SortKey>('newest');
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const [scope, setScope] = useState<ProposalScope>('all');

  /* Scope first, then the filters — and the option counts are measured inside
     the same scope, so `My proposals` doesn't offer a category with nothing of
     yours in it. */
  const pool =
    scope === 'mine'
      ? PROPOSALS.filter((proposal) => proposal.author === PROTOTYPE_USER.name)
      : PROPOSALS;
  const matching = sortProposals(applyFilters(pool, filters), sort);
  /* What each option would leave you with, measured against the *other*
     dimensions only — counted against its own, every unchecked box in a
     narrowed group would read zero and the group would look broken. */
  const countFor = (key: DimensionKey, value: string) =>
    applyFilters(pool, {
      ...filters,
      selections: { ...filters.selections, [key]: [value] },
    }).length;

  return (
    <>
      {/* Sticky, so narrowing a long list doesn't mean scrolling back up to see
          what you narrowed it to. */}
      <div className="sticky top-0 z-20 flex flex-col gap-3 bg-background py-3">
        <PrototypeProposalsToolbar
          filters={filters}
          onFiltersChange={setFilters}
          sort={sort}
          onSortChange={setSort}
          view={view}
          onViewChange={setView}
          onExport={() => void exportProposals(matching, nouns.many)}
          matching={matching.length}
          countFor={countFor}
          nouns={nouns}
          scope={scope}
          onScopeChange={setScope}
        />
        <PrototypeFilterSummary
          filters={filters}
          onFiltersChange={setFilters}
          shown={matching.length}
          matching={pool.length}
          nouns={nouns}
        />
      </div>

      {view === 'map' ? (
        <div className="flex h-96 items-center justify-center rounded-lg border border-dashed border-input">
          <p className="text-muted-foreground">
            {t('A map of the {items} would be here.', { items: nouns.many })}
          </p>
        </div>
      ) : matching.length === 0 ? (
        <div className="rounded-lg border border-dashed border-input px-6 py-10 text-center">
          <p className="text-base font-strong">
            {t('No {items} match', { items: nouns.many })}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-muted-foreground">
            {t('Nothing here fits every filter you have on at once.')}
          </p>
          <div className="mt-4 flex justify-center">
            <Button onClick={() => setFilters(NO_FILTERS)}>
              {t('Clear all')}
            </Button>
          </div>
        </div>
      ) : (
        <ProposalsGrid proposals={matching} />
      )}
    </>
  );
}

/** Everything that survives the popover, in the order the popover set. */
function applyFilters(
  proposals: PrototypeProposal[],
  filters: ProposalFilters,
): PrototypeProposal[] {
  const needle = filters.query.trim().toLowerCase();

  return proposals.filter((proposal) => {
    // An empty dimension means all of it, not none — the whole point of leaving
    // a group untouched.
    const passesDimensions = PROPOSAL_DIMENSIONS.every((dimension) => {
      const chosen = filters.selections[dimension.key];

      return chosen.length === 0 || chosen.includes(proposal[dimension.key]);
    });

    if (!passesDimensions) {
      return false;
    }

    return (
      !needle ||
      [proposal.title, proposal.description, proposal.author]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  });
}

function sortProposals(
  proposals: PrototypeProposal[],
  sort: SortKey,
): PrototypeProposal[] {
  const ordered = [...proposals];

  switch (sort) {
    case 'oldest':
      return ordered.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    case 'reactions':
      return ordered.sort((a, b) => b.likes - a.likes);
    case 'comments':
      return ordered.sort((a, b) => b.comments - a.comments);
    case 'budget-desc':
      return ordered.sort((a, b) => b.budget - a.budget);
    case 'budget-asc':
      return ordered.sort((a, b) => a.budget - b.budget);
    case 'newest':
      return ordered.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }
}

/**
 * The list on screen, as a file. Built from the filtered *and sorted* array, so
 * the rows come out in the order they were read — an export that silently
 * reorders is a different document from the one you were looking at.
 *
 * Two ways out, because there are two places this runs. In a browser an anchor
 * saves the file; inside the published artifact the viewer's sandbox makes that
 * inert, so the page asks the host to hand the file over instead. Neither is a
 * fallback for the other failing — they are the same offer to two hosts.
 */
async function exportProposals(proposals: PrototypeProposal[], many: string) {
  const rows = [
    ['Title', 'Category', 'Neighborhood', 'Budget', 'Author', 'Submitted'],
    ...proposals.map((proposal) => [
      proposal.title,
      proposal.category,
      proposal.neighborhood,
      String(proposal.budget),
      proposal.author,
      proposal.submittedAt,
    ]),
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const filename = `${many.replace(/\W+/g, '-')}.csv`;
  const downloads = await claudeDownloads();

  if (downloads) {
    try {
      await downloads.save({ filename, data: csv });
      toast.success(`Exported ${proposals.length} ${many}`);
    } catch (error) {
      // The viewer declining is an answer, not a failure — say nothing about
      // a file they chose not to take.
      if ((error as { code?: string })?.code !== 'declined') {
        toast.error('That export could not be saved here.');
      }
    }

    return;
  }

  const url = URL.createObjectURL(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${proposals.length} ${many}`);
}

/** The artifact host's save surface, or `null` anywhere that isn't one. */
async function claudeDownloads(): Promise<{
  save: (request: { filename: string; data: string }) => Promise<unknown>;
} | null> {
  const host = (
    window as unknown as {
      claude?: { use?: (name: string) => Promise<unknown> };
    }
  ).claude;

  if (!host?.use) {
    return null;
  }

  return (await host.use('downloads')) as Awaited<
    ReturnType<typeof claudeDownloads>
  >;
}

/**
 * `ProposalMasonry`: cards between 340 and 420px wide, packed rather than
 * gridded so a short card doesn't leave a hole under a tall one. Prod measures
 * the container with a `ResizeObserver` and hands a column count to
 * `react-masonry-css`; a column *width* of prod's own target gets the same
 * answer from the container it is in, without the dependency or the observer —
 * and the packing order within a column is all this needs to preserve.
 */
function ProposalsGrid({ proposals }: { proposals: PrototypeProposal[] }) {
  return (
    <div className="columns-[380px] gap-4 [&>*]:mb-4">
      {proposals.map((proposal) => (
        <div key={proposal.id} className="break-inside-avoid">
          <ProposalCard
            title={proposal.title}
            href="#"
            budget={formatBudget(proposal.budget)}
            tags={[proposal.neighborhood]}
            authors={[{ name: proposal.author }]}
            description={proposal.description}
            headerBadge={
              proposal.badge ? (
                <StatusBadge variant={proposal.badge.variant}>
                  {proposal.badge.label}
                </StatusBadge>
              ) : undefined
            }
            metrics={{
              likes: proposal.likes,
              bookmarks: proposal.follows,
              comments: proposal.comments,
            }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * The hero's call to action. Prod reads this from the phase's own `headline`,
 * which the prototype's phase model doesn't carry — so it comes from the phase
 * type, which is what the headline is about anyway.
 */
const PHASE_HEADLINE: Record<PhaseType, string> = {
  submissions: 'Share what you would do.',
  review: 'See what has come in.',
  develop: 'Turn the strongest of them into full plans.',
  voting: 'Decide what gets built.',
  results: 'Here is what won.',
};

const SUBMITTERS = [
  'Marisol Ortega',
  'Daniel Kim',
  'Aisha Bello',
  'Tomás Rivera',
  'Grace Lin',
  'Omar Haddad',
];
