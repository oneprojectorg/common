'use client';

import { Avatar, AvatarFallback } from '@op/sense/Avatar';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import { Popover, PopoverContent } from '@op/sense/Popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Tag } from '@op/sense/TagGroup';
import { cn } from '@op/sense/lib/utils';
import { useId, useRef, useState } from 'react';
import { LuMail } from 'react-icons/lu';

import { COMMON_DIRECTORY } from './store';

/** One person on the way to being added — an account, or an address to email. */
export interface InviteChip {
  email: string;
  /** Present when they already have a Common account. */
  name?: string;
}

/** The option `Assign to group` adds beyond the configured groups. */
const LATER = '__later__';

/** The most rows the list ever shows — past that, keep typing. */
const RESULTS = 5;

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * Adding people, as one field.
 *
 * The old modal made the admin choose first — search the org, or paste
 * addresses — which is a question about our data model, not about who they want.
 * Here there is one box: type a name and it finds the account, type an address
 * it doesn't know and it offers to email it. What the field resolves to is the
 * difference between someone who can take part now and someone who has to join
 * first, and that difference is carried by the chip rather than by a mode.
 */
export function PrototypeInviteModal({
  isOpen,
  onOpenChange,
  lower,
  isDraft,
  groups,
  groupNoun,
  existing,
  onAdd,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** What these people are called, lowercase plural — "reviewers". */
  lower: string;
  /** Nothing is sent from a draft, so the wording is about adding, not sending. */
  isDraft: boolean;
  /** The groups to assign this batch to, empty unless the phase categorises. */
  groups: string[];
  /** What one group is called in this process's own words. */
  groupNoun: string;
  /** Addresses already on the list — never offered, never added twice. */
  existing: Set<string>;
  onAdd: (people: InviteChip[], group?: string) => void;
}) {
  const [chips, setChips] = useState<InviteChip[]>([]);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [group, setGroup] = useState<string>(LATER);
  const input = useRef<HTMLInputElement>(null);
  /** The list hangs off the whole field, not off the caret inside it. */
  const fieldRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const taken = new Set([...existing, ...chips.map((chip) => chip.email)]);
  const trimmed = query.trim();
  /* Nothing until something is typed. A directory laid out on open answers a
     question nobody asked, and it makes the modal a page rather than a field. */
  const matches =
    trimmed === ''
      ? []
      : COMMON_DIRECTORY.filter(
          (person) =>
            !taken.has(person.email) &&
            (person.name.toLowerCase().includes(trimmed.toLowerCase()) ||
              person.email.toLowerCase().includes(trimmed.toLowerCase())),
        ).slice(0, RESULTS);

  /* An address we don't know is an invitation, not a failure — offered as its
     own row so the field never asks the admin which kind of thing they meant. */
  const offersInvite =
    isEmail(trimmed) &&
    !taken.has(trimmed) &&
    !COMMON_DIRECTORY.some((person) => person.email === trimmed);
  const rows: (InviteChip | 'invite')[] = offersInvite
    ? [...matches, 'invite']
    : matches;

  const add = (chip: InviteChip) => {
    setChips((current) => [...current, chip]);
    setQuery('');
    setHighlight(0);
    input.current?.focus();
  };

  const accounts = chips.filter((chip) => chip.name);
  const invites = chips.filter((chip) => !chip.name);

  const reset = () => {
    setChips([]);
    setQuery('');
    setHighlight(0);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          reset();
        }

        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <>
          <DialogHeader>
            <DialogTitle>
              {isDraft ? 'Add' : 'Invite'} {lower}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pt-6 pb-8">
            <DialogDescription className="sr-only">
              Search people on Common, or type an email address to{' '}
              {isDraft ? 'add' : 'invite'} someone who isn&rsquo;t.
            </DialogDescription>

            {/* One box holding the chips and the caret: what you have picked
                  and what you are typing are the same field, because they are
                  the same list. */}
            <div
              ref={fieldRef}
              className="rounded-lg border border-input p-2 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
              onClick={() => input.current?.focus()}
            >
              {/* One wrapping line, chips and caret together: stacking the
                    chips above the input made the field jump a whole row the
                    moment a first name was picked. `Tag` is an `li`, so the row
                    is the list and the caret rides in the last item. */}
              <ul
                aria-label={`${lower} to add`}
                className="flex flex-wrap items-center gap-2"
              >
                {chips.map((chip) => (
                  <Tag
                    key={chip.email}
                    size="lg"
                    /* Dashed for an address that is not an account yet — the
                         same vocabulary the draft scaffolding uses. */
                    variant={chip.name ? 'outline' : 'pending'}
                    removeLabel={`Remove ${chip.name ?? chip.email}`}
                    onRemove={() =>
                      setChips((current) =>
                        current.filter((item) => item !== chip),
                      )
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      {chip.name ? (
                        <Avatar className="size-4">
                          <AvatarFallback name={chip.name} />
                        </Avatar>
                      ) : (
                        <LuMail className="size-3.5" aria-hidden />
                      )}
                      {chip.name ?? chip.email}
                    </span>
                  </Tag>
                ))}
                {/* Narrow enough to stay on the chips' line: the caret only
                    needs room for what is being typed, and the placeholder that
                    needed the width is gone once there is a chip. */}
                <li className="flex min-w-20 flex-1 list-none">
                  <input
                    ref={input}
                    className="w-full bg-transparent px-1 py-1 text-base outline-none placeholder:text-muted-foreground"
                    placeholder={
                      chips.length > 0 ? '' : 'Type a name or email address'
                    }
                    aria-label="Type a name or email address"
                    aria-controls={listId}
                    autoFocus
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setHighlight(0);
                    }}
                    onPaste={(event) => {
                      const text = event.clipboardData.getData('text');

                      // A pasted list is the common case for this field, and
                      // splitting it by hand is work the field can do.
                      if (!/[\s,;]/.test(text)) {
                        return;
                      }

                      event.preventDefault();

                      const fresh: InviteChip[] = [];
                      const seen = new Set(taken);

                      for (const piece of text.split(/[\s,;]+/)) {
                        const value = piece.trim();

                        if (!isEmail(value) || seen.has(value)) {
                          continue;
                        }

                        seen.add(value);

                        const account = COMMON_DIRECTORY.find(
                          (person) => person.email === value,
                        );

                        fresh.push(account ? { ...account } : { email: value });
                      }

                      setChips((current) => [...current, ...fresh]);
                      setQuery('');
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowDown' && rows.length > 0) {
                        event.preventDefault();
                        setHighlight((current) => (current + 1) % rows.length);
                      } else if (event.key === 'ArrowUp' && rows.length > 0) {
                        event.preventDefault();
                        setHighlight(
                          (current) =>
                            (current - 1 + rows.length) % rows.length,
                        );
                      } else if (event.key === 'Enter') {
                        const row = rows[highlight];

                        if (row) {
                          event.preventDefault();
                          add(row === 'invite' ? { email: trimmed } : row);
                        }
                      } else if (
                        event.key === 'Backspace' &&
                        query === '' &&
                        chips.length > 0
                      ) {
                        setChips((current) => current.slice(0, -1));
                      }
                    }}
                  />
                </li>
              </ul>
            </div>

            {/* Floating, and only while there is something to show: the list
                  must not push the footer around or leave a hole when it is
                  closed. Portaled, so the dialog's own scroll box can't clip
                  it, and anchored to the field rather than to the caret. */}
            <Popover open={rows.length > 0}>
              <PopoverContent
                anchor={fieldRef}
                align="start"
                sideOffset={4}
                id={listId}
                className="w-(--anchor-width) gap-1 p-1"
                /* The caret stays in the field — this is a list of what you
                     are typing, not somewhere to go. */
                initialFocus={input}
                finalFocus={input}
              >
                {rows.map((row, index) => (
                  <Button
                    key={row === 'invite' ? 'invite' : row.email}
                    variant="bare"
                    className={cn(
                      'h-auto w-full justify-start gap-3 rounded-md p-2 text-start',
                      index === highlight && 'bg-muted',
                    )}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() =>
                      add(row === 'invite' ? { email: trimmed } : row)
                    }
                  >
                    {row === 'invite' ? (
                      <>
                        {/* Dashed here too: this person is not on Common yet,
                              and the row says so before the chip does. */}
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-input text-muted-foreground"
                          aria-hidden
                        >
                          <LuMail className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-normal">
                          Invite {trimmed}
                        </span>
                        <span className="shrink-0 text-sm font-normal text-muted-foreground">
                          {isDraft
                            ? 'Emailed when you launch'
                            : 'Sends an email to join'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Avatar className="size-8 shrink-0">
                          <AvatarFallback name={row.name ?? row.email} />
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate font-normal">
                          {row.name}
                        </span>
                        <span className="min-w-0 shrink truncate text-sm font-normal text-muted-foreground">
                          {row.email}
                        </span>
                      </>
                    )}
                  </Button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Said under the field rather than in the list: with nothing to
                  show there is no list, and this is the one line that explains
                  what the field does. */}
            {/* Its row is always there, empty or not: appearing and vanishing
                moved everything under it every time a chip landed. */}
            <p className="min-h-5 text-sm text-muted-foreground">
              {rows.length > 0 || chips.length > 0
                ? null
                : trimmed === ''
                  ? isDraft
                    ? 'Type or paste email addresses — each person is invited when you launch.'
                    : 'Type or paste email addresses — each person gets an invitation to join.'
                  : 'No one on Common matches — finish typing an email to add them.'}
            </p>

            {/* Review only, and only when the pile is cut into groups: it
                  applies to the whole batch, which is why it is one field here
                  rather than a control on every row. */}
            {groups.length > 0 ? (
              <Field>
                <FieldLabel htmlFor="invite-group">
                  Assign to {groupNoun}
                </FieldLabel>
                <Select
                  value={group}
                  onValueChange={(v) => setGroup(String(v))}
                >
                  <SelectTrigger id="invite-group" className="w-full">
                    <SelectValue>
                      {group === LATER ? 'Decide later' : group}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                    <SelectItem value={LATER}>Decide later</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Applies to everyone added now. You can change any of them
                  later.
                </FieldDescription>
              </Field>
            ) : null}
          </div>

          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={chips.length === 0}
              onClick={() => {
                /* Straight onto the list — it is right there behind this
                     modal, and a screen that says what just happened is a
                     screen between you and looking at it. */
                onAdd(chips, group === LATER ? undefined : group);
                reset();
                onOpenChange(false);
              }}
            >
              {action(accounts.length, invites.length, lower, isDraft)}
            </Button>
          </DialogFooter>
        </>
      </DialogContent>
    </Dialog>
  );
}

/** The button says what pressing it does, which depends on what is in the box. */
function action(
  accounts: number,
  invites: number,
  lower: string,
  isDraft: boolean,
): string {
  // Nothing picked yet: the button says what it is for, not that it will do it
  // to nobody.
  if (accounts === 0 && invites === 0) {
    return `Add ${lower}`;
  }

  // Nothing leaves a draft, so nothing there is "sent".
  if (accounts === 0 && invites > 0 && !isDraft) {
    return `Send ${invites} ${invites === 1 ? 'invitation' : 'invitations'}`;
  }

  const total = accounts + invites;

  return `Add ${total} ${total === 1 ? lower.replace(/s$/, '') : lower}`;
}
