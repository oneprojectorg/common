'use client';

import { Alert, AlertDescription, AlertTitle } from '@op/sense/Alert';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { StatusBadge } from '@op/sense/StatusBadge';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import {
  LuChevronDown,
  LuEllipsisVertical,
  LuInfo,
  LuUserPlus,
  LuUsers,
} from 'react-icons/lu';

import { EmptyStateBody } from './PhaseBuilderEmpty';
import { type InviteChip, PrototypeInviteModal } from './PrototypeInviteModal';
import {
  DONE_LABEL,
  INVITEE_LABEL,
  assignedDimensions,
  assignedGroupValues,
  type Invitee,
  type InviteeStatus,
  type PrototypePhase,
  type PrototypeProcess,
} from './store';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * The people invited to a phase. Rows carry where each person has got to —
 * invited, joined, or done with whatever this phase asks — so the admin can see
 * who still needs chasing without leaving the phase.
 *
 * Inviting is a dialog rather than a field on the page: the list is what this tab
 * is for, and adding to it is an errand. An empty phase gets an explanation and
 * the two ways in instead.
 */
/**
 * Four places say this — three buttons and the dialog that opens. Short because
 * it is an action, not the sentence explaining one: what gets copied is obvious
 * from the list it sits under.
 */
const COPY_FROM_PHASE = 'Copy from another phase';

export function PrototypePeopleTab({
  phase,
  process,
  patch,
}: {
  phase: PrototypePhase;
  process: PrototypeProcess;
  patch: (update: (current: PrototypePhase) => PrototypePhase) => void;
}) {
  const locale = useLocale();
  const [filter, setFilter] = useState<'all' | InviteeStatus>('all');
  const [isInviting, setIsInviting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const label = INVITEE_LABEL[phase.phaseType];
  const lower = label.toLowerCase();
  const doneLabel = DONE_LABEL[phase.phaseType];
  /* Nobody has been contacted from a draft, so the tab talks about building a
     list — adding people — rather than about inviting them to something. The
     invite language only becomes true once the process launches. */
  const isDraft = process.status === 'draft';
  const actionWord = isDraft ? 'Add' : 'Invite';
  const addedWord = isDraft ? 'Added' : 'Invited';
  /*
   * Empty unless the phase groups its pile along exactly one dimension, which
   * is what decides whether anyone here needs a group at all.
   *
   * TODO: reviewer-to-group matching when several groupings run in parallel —
   * a reviewer then covers a group in each, which is a surface of its own.
   */
  const dimensions = assignedDimensions(process, phase);
  const areas = assignedGroupValues(process, phase);
  const groupNounForPhase =
    dimensions.length === 1 ? (dimensions[0]?.name ?? 'group') : 'group';

  /** Other phases that already have people, for reusing the same group. */
  const sources = process.phases.filter(
    (item) => item.id !== phase.id && item.invitees.length > 0,
  );

  const invite = (people: InviteChip[], focusArea?: string) => {
    // Anyone already on the list is skipped.
    const known = new Set(phase.invitees.map((person) => person.email));
    const fresh = people.filter((person) => !known.has(person.email));

    patch((current) => ({
      ...current,
      invitees: [
        ...current.invitees,
        ...fresh.map((person, index) => ({
          id: `invitee-${current.invitees.length + index}-${person.email}`,
          email: person.email,
          /* Someone with an account is on Common already — there is nothing to
             accept, so they are on the list from the moment they are added. An
             address has to join first. */
          status: person.name ? ('joined' as const) : ('invited' as const),
          at: Date.now(),
          focusArea,
        })),
      ],
    }));
    toast.success(
      fresh.length === 1
        ? `${addedWord} 1 person`
        : `${addedWord} ${fresh.length} people`,
    );
  };

  const copyFrom = (sourceId: string) => {
    const source = process.phases.find((item) => item.id === sourceId);

    if (!source) {
      return;
    }

    // People come across as freshly invited: joining one phase isn't joining
    // another.
    const known = new Set(phase.invitees.map((person) => person.email));

    patch((current) => ({
      ...current,
      invitees: [
        ...current.invitees,
        ...source.invitees
          .filter((person) => !known.has(person.email))
          .map((person, index) => ({
            id: `invitee-copied-${current.invitees.length + index}-${person.email}`,
            email: person.email,
            status: 'invited' as const,
            at: Date.now(),
          })),
      ],
    }));
    setIsCopying(false);
    toast.success(`Added everyone from ${source.name}`);
  };

  /* Inviting from a draft doesn't notify anyone, and the list gives no hint of
     that — so the tab says it, wherever the tab is used. */
  const banner =
    /* Only once there is somebody it applies to — said over an empty list it is
       a warning about nothing. */
    process.status === 'draft' && phase.invitees.length > 0 ? (
      <Alert variant="info" className="max-w-2xl">
        <LuInfo aria-hidden />
        <AlertTitle>Invites will send when you launch</AlertTitle>
        <AlertDescription>
          This process is still in draft. No one is invited until it launches.
        </AlertDescription>
      </Alert>
    ) : null;

  const dialogs = (
    <>
      {isInviting ? (
        <PrototypeInviteModal
          isOpen
          onOpenChange={(open) => (open ? undefined : setIsInviting(false))}
          lower={lower}
          isDraft={isDraft}
          groups={areas}
          groupNoun={groupNounForPhase}
          existing={new Set(phase.invitees.map((person) => person.email))}
          onAdd={invite}
        />
      ) : null}
      {isCopying ? (
        <CopyFromPhaseDialog
          lower={lower}
          addedWord={addedWord.toLowerCase()}
          sources={sources.map((source) => ({
            id: source.id,
            name: source.name,
            label: INVITEE_LABEL[source.phaseType].toLowerCase(),
            count: source.invitees.length,
          }))}
          onPick={copyFrom}
          onClose={() => setIsCopying(false)}
        />
      ) : null}
    </>
  );

  if (phase.invitees.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {banner}
        <div className="max-w-2xl rounded-lg border bg-background p-10 text-center">
          <EmptyStateBody
            heading={`No ${lower} yet`}
            text={`Only the ${lower} you ${actionWord.toLowerCase()} can take part in this phase.`}
            shortcut={
              sources.length > 0 ? (
                <Button variant="link" onClick={() => setIsCopying(true)}>
                  <LuUsers className="size-4" aria-hidden />
                  {COPY_FROM_PHASE}
                </Button>
              ) : null
            }
          >
            <Button onClick={() => setIsInviting(true)}>
              <LuUserPlus className="size-4" aria-hidden />
              {actionWord} {lower}
            </Button>
          </EmptyStateBody>
        </div>
        {dialogs}
      </div>
    );
  }

  const filters: { value: 'all' | InviteeStatus; label: string }[] = [
    /* Where somebody is in joining, and nothing else. Whether they have
       submitted or reviewed is progress through the phase, not a property of
       the invitation, and it belongs to the work rather than to this list. */
    { value: 'all', label: 'All' },
    { value: 'invited', label: addedWord },
    { value: 'joined', label: 'Joined' },
  ];

  const shown =
    filter === 'all'
      ? phase.invitees
      : phase.invitees.filter((person) => person.status === filter);

  return (
    // The card around it owns the width now, and the heading it used to need.
    <div className="flex flex-col gap-3">
      {banner}

      {/* Joined and done are unreachable in a draft, so a row of zeroes would be
          worse than no row at all. */}
      <div
        className={cn('flex flex-wrap items-center gap-2', isDraft && 'hidden')}
      >
        {filters.map((option) => {
          const active = filter === option.value;
          const count =
            option.value === 'all'
              ? phase.invitees.length
              : phase.invitees.filter(
                  (person) => person.status === option.value,
                ).length;

          return (
            <Button
              key={option.value}
              variant={active ? 'default' : 'outline'}
              size="sm"
              aria-pressed={active}
              className="rounded-full"
              onClick={() => setFilter(option.value)}
            >
              {option.label}
              <span
                className={cn('ms-1.5', !active && 'text-muted-foreground')}
              >
                {count}
              </span>
            </Button>
          );
        })}
      </div>

      <div className="rounded-lg border bg-background">
        {shown.length === 0 ? (
          /* The way to fill it, in the box that is empty — the add button sits
             below, but reusing another phase's panel is the shortcut worth
             offering exactly where the gap is. */
          <div className="p-8 text-center" aria-live="polite">
            <EmptyStateBody
              heading="No one here yet"
              text={`None of the ${lower} on this phase match this filter.`}
              shortcut={
                sources.length > 0 ? (
                  <Button variant="link" onClick={() => setIsCopying(true)}>
                    <LuUsers className="size-4" aria-hidden />
                    {COPY_FROM_PHASE}
                  </Button>
                ) : null
              }
            />
          </div>
        ) : (
          <ul className="flex flex-col">
            {shown.map((person) => (
              <li
                key={person.id}
                className="flex items-center gap-3 px-4 py-3 not-last:border-b"
              >
                <ProfileAvatar
                  name={person.email}
                  alt={person.email}
                  size="sm"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base">{person.email}</span>
                  <span className="text-sm text-muted-foreground">
                    {statusLabel(person.status, doneLabel, addedWord)}{' '}
                    {relativeTime(person.at, locale)}
                  </span>
                </span>
                {areas.length > 0 ? (
                  <FocusAreaChip
                    areas={areas}
                    email={person.email}
                    noun={groupNounForPhase}
                    value={person.focusArea}
                    onChange={(focusArea) =>
                      patch((current) => ({
                        ...current,
                        invitees: current.invitees.map((item) =>
                          item.id === person.id ? { ...item, focusArea } : item,
                        ),
                      }))
                    }
                  />
                ) : null}
                <StatusBadge
                  variant={
                    person.status === 'done'
                      ? 'success'
                      : person.status === 'joined'
                        ? 'in-progress'
                        : 'inactive'
                  }
                  icon={false}
                >
                  {statusLabel(person.status, doneLabel, addedWord)}
                </StatusBadge>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for ${person.email}`}
                      />
                    }
                  >
                    <LuEllipsisVertical className="size-4" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* Nothing has gone out from a draft, so there is nothing
                        to send again — the banner above already says invites
                        wait for launch. */}
                    {isDraft ? null : (
                      <DropdownMenuItem
                        onClick={() =>
                          toast.info('Prototype: resending an invite is a stub')
                        }
                      >
                        Resend invite
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() =>
                        patch((current) => ({
                          ...current,
                          invitees: current.invitees.filter(
                            (item) => item.id !== person.id,
                          ),
                        }))
                      }
                    >
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Adding people is the thing to do on this tab, so it leads — outlined
          rather than filled, because `Save` on the page above it is the only
          primary here. Reusing another phase's panel is the shortcut behind it,
          and a shortcut reads as a link. */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => setIsInviting(true)}>
          <LuUserPlus className="size-4" aria-hidden />
          {actionWord} {lower}
        </Button>
        {sources.length > 0 && shown.length > 0 ? (
          <Button variant="link" onClick={() => setIsCopying(true)}>
            <LuUsers className="size-4" aria-hidden />
            {COPY_FROM_PHASE}
          </Button>
        ) : null}
      </div>

      {dialogs}
    </div>
  );
}

/**
 * One reviewer's slice of the pile. Unset reads as an invitation to set it —
 * dashed and quiet — rather than as an error, because a panel is normally
 * assembled before it is divided up.
 */
function FocusAreaChip({
  areas,
  email,
  noun,
  value,
  onChange,
}: {
  areas: string[];
  /** Names the control, since the chip's own text is the answer, not the ask. */
  email: string;
  /** What one group is called in this process's own words. */
  noun: string;
  value?: string;
  onChange: (next: string | undefined) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="bare"
            size="sm"
            aria-label={`Set the ${noun} for ${email}`}
            className={cn(
              'shrink-0 rounded-md px-2 py-0.5 text-sm font-normal',
              value
                ? 'bg-accent text-accent-foreground hover:bg-[color-mix(in_oklch,var(--accent),var(--foreground)_6%)]'
                : // Dashed and quiet: not yet set is the normal state of a
                  // panel that has only just been assembled.
                  'border border-dashed border-input text-muted-foreground hover:bg-muted',
            )}
          />
        }
      >
        {value ?? `Set ${noun}`}
        <LuChevronDown className="ms-1 size-3.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {areas.map((group) => (
          <DropdownMenuItem key={group} onClick={() => onChange(group)}>
            {group}
          </DropdownMenuItem>
        ))}
        {value ? (
          <DropdownMenuItem onClick={() => onChange(undefined)}>
            Clear
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Reuse a group already assembled elsewhere in the process — the common case
 * being the same panel reviewing and then voting.
 */
function CopyFromPhaseDialog({
  lower,
  addedWord,
  sources,
  onPick,
  onClose,
}: {
  lower: string;
  /** "invited" once the process is live, "added" while it is still a draft. */
  addedWord: string;
  sources: { id: string; name: string; label: string; count: number }[];
  onPick: (sourceId: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{COPY_FROM_PHASE}</DialogTitle>
          <DialogDescription>
            Everyone from the phase you pick is added here as {addedWord}{' '}
            {lower}. Anyone already on this list is skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-6">
          <ul className="flex flex-col gap-2">
            {sources.map((source) => (
              <li key={source.id}>
                <Button
                  variant="outline"
                  className="h-auto w-full justify-start gap-3 p-3.5 text-start"
                  onClick={() => onPick(source.id)}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    <LuUsers className="size-4" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-base font-strong">
                      {source.name}
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {source.count}{' '}
                      {source.count === 1
                        ? source.label.replace(/s$/, '')
                        : source.label}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function statusLabel(
  status: Invitee['status'],
  doneLabel: string | null,
  /** "Invited" once the process is live, "Added" while it is still a draft. */
  addedWord: string,
) {
  if (status === 'done') {
    return doneLabel ?? 'Joined';
  }

  return status === 'joined' ? 'Joined' : addedWord;
}

/** "4 minutes ago", from an epoch that survived JSON. */
function relativeTime(at: number, locale: string): string {
  const seconds = Math.round((at - Date.now()) / 1000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (Math.abs(seconds) < 60) {
    return format.format(seconds, 'second');
  }

  if (Math.abs(seconds) < 3600) {
    return format.format(Math.round(seconds / 60), 'minute');
  }

  if (Math.abs(seconds) < 86400) {
    return format.format(Math.round(seconds / 3600), 'hour');
  }

  return format.format(Math.round(seconds / 86400), 'day');
}
