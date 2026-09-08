'use client';

import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { Header1 } from '@op/sense/Header';
import { StatusBadge } from '@op/sense/StatusBadge';
import { Tabs, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import { LuCalendar, LuEllipsis, LuRotateCcw, LuTrash2 } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';

import { DecisionCardHeader } from '@/components/decisions/DecisionCardHeader';

import { formatLongDate } from './formatDate';
import {
  deleteProcess,
  isMockProcess,
  type PrototypeProcess,
  resetSeededProcess,
  usePrototypeProcesses,
  vocabulary,
} from './store';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * The decisions index: the seeded running process plus anything created through
 * the wizard in this browser. Mirrors the real page — Active / Completed /
 * Drafts tabs over full-width rows — and reuses the product's own
 * `DecisionCardHeader` so a row reads exactly as it does in the app. The stat
 * and closing-date bits are private to `DecisionListItem`, so they are copied.
 */
export function PrototypeDecisionsList() {
  const t = useTranslations();
  const { processes, reload } = usePrototypeProcesses();
  const [tab, setTab] = useState('active');

  const drafts = processes.filter(
    (process) => process.currentPhaseIndex < 0 && !process.archivedAt,
  );
  /* Archived lands under Completed: the prototype has no shelf of its own, and
     a process taken off the active list has finished as far as anyone reading
     the page is concerned. */
  const archived = processes.filter((process) => Boolean(process.archivedAt));
  const active = processes.filter(
    (process) => process.currentPhaseIndex >= 0 && !process.archivedAt,
  );
  const shown =
    tab === 'drafts' ? drafts : tab === 'completed' ? archived : active;

  return (
    <div className="flex flex-col gap-6 px-4 pt-8 sm:gap-10 sm:px-6 sm:py-14">
      <div className="flex flex-col gap-2">
        <Header1 className="text-headline">
          {t('Decision-making processes')}
        </Header1>
        <p>{t('Discover new ways to collectively decide together.')}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
          <TabsList variant="line">
            <TabsTrigger value="active">{t('Active')}</TabsTrigger>
            <TabsTrigger value="completed">{t('Completed')}</TabsTrigger>
            <TabsTrigger value="drafts">
              {t('Drafts')}
              {drafts.length > 0 ? ` (${drafts.length})` : ''}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {shown.length === 0 ? (
          <p className="py-10 text-muted-foreground" aria-live="polite">
            {tab === 'completed'
              ? 'Prototype: nothing has completed yet.'
              : 'Prototype: create a process from the Create menu.'}
          </p>
        ) : (
          <ul className="flex flex-col divide-y sm:divide-y">
            {shown.map((process) => (
              <li key={process.id}>
                <ProcessRow process={process} onChanged={reload} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Prototype: processes you create are kept in this browser&rsquo;s local
        storage.
      </p>
    </div>
  );
}

function ProcessRow({
  process,
  onChanged,
}: {
  process: PrototypeProcess;
  onChanged: () => void;
}) {
  const t = useTranslations();
  const isDraft = process.currentPhaseIndex < 0;
  const currentPhase = process.phases[process.currentPhaseIndex];

  return (
    <div className="flex items-start rounded-lg border hover:bg-muted sm:items-center sm:rounded-none sm:border-0">
      <Link
        href={`/prototype/decisions/${process.id}`}
        className="flex flex-1 flex-col gap-4 p-4 hover:no-underline sm:flex-row sm:items-center sm:justify-between"
      >
        <DecisionCardHeader
          name={process.name}
          currentState={currentPhase?.name}
          stewardName="East Side Collective"
        >
          {currentPhase?.endDate ? (
            <ClosingDate closingDate={currentPhase.endDate} />
          ) : null}
        </DecisionCardHeader>

        {isDraft ? (
          <StatusBadge variant="inactive" icon={false}>
            {t('Draft')}
          </StatusBadge>
        ) : (
          <div className="flex items-end gap-4 sm:items-center sm:gap-10">
            <Stat number={process.participantCount ?? 0} label="Participants" />
            <Stat
              number={process.proposalCount ?? 0}
              label={vocabulary(process).Many}
            />
          </div>
        )}
      </Link>

      <div className="flex items-center pe-4 pt-4 sm:ps-8 sm:pt-0">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={t('Decision options')}
                variant="ghost"
                size="icon"
              />
            }
          >
            <LuEllipsis className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end">
            <DropdownMenuItem
              onClick={() =>
                toast.info('Prototype: opens the process page in edit mode.')
              }
            >
              {t('Edit process')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                toast.info('Prototype: duplicating is out of scope')
              }
            >
              {t('Duplicate')}
            </DropdownMenuItem>

            {/* Putting a seeded process back the way it ships. A walkthrough
                edits these, and without this the only way back is clearing the
                browser. */}
            {isMockProcess(process.id) ? (
              <DropdownMenuItem
                onClick={() => {
                  resetSeededProcess(process.id);
                  onChanged();
                  toast.success(`${process.name} reset (FPP)`);
                }}
              >
                <LuRotateCcw aria-hidden />
                {t('Reset (FPP)')}
              </DropdownMenuItem>
            ) : null}

            {/* A draft can be deleted because nothing has happened in it. A
                live process can't, and there is nothing to offer instead yet —
                what becomes of a process people have taken part in is a
                decision this prototype hasn't made. */}
            {isDraft ? (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  deleteProcess(process.id);
                  onChanged();
                  toast.success(`${process.name} deleted`);
                }}
              >
                <LuTrash2 aria-hidden />
                {t('Delete process')}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/** Copies of `DecisionListItem`'s private row bits. */
const Stat = ({ number, label }: { number: number; label: TranslationKey }) => {
  const t = useTranslations();

  return (
    <div className="flex items-center gap-1 sm:flex-col">
      <span className="font-serif text-title">{number}</span>
      <span className="text-sm text-muted-foreground">{t(label)}</span>
    </div>
  );
};

const ClosingDate = ({ closingDate }: { closingDate: string }) => {
  const t = useTranslations();
  const locale = useLocale();
  const date = formatLongDate(closingDate, locale);

  return (
    <div
      className={cn('flex items-center gap-2 text-sm text-muted-foreground')}
    >
      <LuCalendar className="size-4" aria-hidden />
      {t('Closes on {date}', { date })}
    </div>
  );
};
