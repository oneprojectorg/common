'use client';

import { Avatar, AvatarFallback } from '@op/sense/Avatar';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { Field, FieldError, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { Popover, PopoverContent } from '@op/sense/Popover';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { useId, useRef, useState } from 'react';
import { LuEllipsisVertical, LuSend, LuTrash2 } from 'react-icons/lu';

import { COMMON_DIRECTORY, type ProcessAdmin } from './store';

/**
 * Said in both places admins are managed — this dialog and the `Settings` card —
 * so the two can't describe the same thing differently. Short because it is the
 * one fact that matters: there are no lesser admins.
 */
export const ADMIN_BLURB = 'Everyone here has full, equal access.';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * Adding another admin — its own small modal rather than a detour through a
 * settings screen, since it's the one thing an admin does mid-setup when they
 * realise they shouldn't be doing this alone. Live, the same list is folded into
 * `Settings`; this dialog is the draft's way in.
 */
export function PrototypeAdminModal({
  isOpen,
  onOpenChange,
  admins,
  onChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  admins: ProcessAdmin[];
  onChange: (next: ProcessAdmin[]) => void;
}) {
  const [email, setEmail] = useState('');

  const trimmed = email.trim();
  const isDuplicate = admins.some(
    (admin) => admin.email.toLowerCase() === trimmed.toLowerCase(),
  );
  const isValid = /.+@.+\..+/.test(trimmed) && !isDuplicate;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {/* The dialog says what the button that opened it said: once there is
              somebody else here, this is where you manage them, not only where
              you add one. */}
          <DialogTitle>
            {admins.length > 1 ? 'Manage admins' : 'Add an admin'}
          </DialogTitle>
          <DialogDescription>{ADMIN_BLURB}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-6">
          <AdminInvite
            email={email}
            onEmailChange={setEmail}
            isValid={isValid}
            isDuplicate={isDuplicate}
            admins={admins}
            onAdd={(person) => {
              onChange(addAdmin(admins, person));
              setEmail('');
            }}
          />

          <AdminList admins={admins} onChange={onChange} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** How many directory matches the list shows, as in the invite modal. */
const RESULTS = 5;

/**
 * Somebody new — searched for by name, or typed in as an address. Split out
 * because `Settings` shows the same row: one field and one button, and the
 * button is what commits — Enter in the field does the same thing, because a
 * lone input asks to be submitted.
 *
 * It searches Common's people for the same reason the participants field does:
 * the likeliest co-admin already has an account, and making someone type the
 * address of a colleague they could have picked from a list is the kind of
 * friction that only shows up once the directory is real. Picking an account
 * carries the name over, so the list below reads "Marisol Ortega" rather than an
 * address with "Invited just now" under it — a person already on Common is not
 * waiting on an invitation.
 */
export function AdminInvite({
  email,
  onEmailChange,
  isValid,
  isDuplicate,
  admins,
  onAdd,
}: {
  email: string;
  onEmailChange: (value: string) => void;
  isValid: boolean;
  isDuplicate: boolean;
  /** Read only to keep people who are already admins out of the suggestions. */
  admins: ProcessAdmin[];
  onAdd: (person: { email: string; name?: string }) => void;
}) {
  /* Anchored to the whole field, not to the caret inside it. */
  const fieldRef = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [highlight, setHighlight] = useState(0);

  const trimmed = email.trim();
  const taken = new Set(admins.map((admin) => admin.email.toLowerCase()));
  const needle = trimmed.toLowerCase();
  /* Nothing until something is typed — a directory laid out on open answers a
     question nobody asked. Same rule as the participants field. */
  const matches =
    trimmed === ''
      ? []
      : COMMON_DIRECTORY.filter(
          (person) =>
            !taken.has(person.email.toLowerCase()) &&
            (person.name.toLowerCase().includes(needle) ||
              person.email.toLowerCase().includes(needle)),
        ).slice(0, RESULTS);

  const pick = (person: { email: string; name?: string }) => {
    onAdd(person);
    setHighlight(0);
    input.current?.focus();
  };

  return (
    <form
      className="flex items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault();

        if (isValid) {
          onAdd({ email: trimmed });
        }
      }}
    >
      <Field ref={fieldRef} className="min-w-0 flex-1">
        <FieldLabel htmlFor="admin-email" className="sr-only">
          Search people on Common, or type an email address
        </FieldLabel>
        <Input
          ref={input}
          id="admin-email"
          /* `text`, not `email`: this field takes a name now too, and the
             browser's own email validation would reject "Marisol". */
          type="text"
          value={email}
          onChange={(event) => {
            onEmailChange(event.target.value);
            setHighlight(0);
          }}
          placeholder="Search a name, or type an email address"
          aria-invalid={isDuplicate || undefined}
          aria-controls={listId}
          // The form's own submit doesn't fire from here — something between
          // this field and the dialog eats the key — and a lone field that
          // ignores Enter is broken however good the reason is.
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && matches.length > 0) {
              event.preventDefault();
              setHighlight((current) => (current + 1) % matches.length);

              return;
            }

            if (event.key === 'ArrowUp' && matches.length > 0) {
              event.preventDefault();
              setHighlight(
                (current) => (current - 1 + matches.length) % matches.length,
              );

              return;
            }

            if (event.key !== 'Enter') {
              return;
            }

            /* A highlighted account wins over the raw text: if the list is
               open, Enter means "that one" — the same as clicking it. */
            const match = matches[highlight];

            if (match) {
              event.preventDefault();
              pick(match);

              return;
            }

            if (isValid) {
              event.preventDefault();
              onAdd({ email: trimmed });
            }
          }}
        />
        {isDuplicate ? (
          <FieldError>They&rsquo;re already an admin.</FieldError>
        ) : null}
      </Field>

      {/* Floating and only while there is something in it, so it neither
          pushes the dialog's footer around nor leaves a hole when closed.
          Anchored to the field so it lines up with the box rather than the
          caret, and focus stays in the input — this is a list of what you are
          typing, not somewhere to go. */}
      <Popover open={matches.length > 0}>
        <PopoverContent
          anchor={fieldRef}
          align="start"
          sideOffset={4}
          id={listId}
          className="w-(--anchor-width) gap-1 p-1"
          initialFocus={input}
          finalFocus={input}
        >
          {matches.map((person, index) => (
            <Button
              key={person.email}
              type="button"
              variant="bare"
              className={cn(
                'h-auto w-full justify-start gap-3 rounded-md p-2 text-start',
                index === highlight && 'bg-muted',
              )}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => pick(person)}
            >
              <Avatar className="size-8 shrink-0">
                <AvatarFallback name={person.name} />
              </Avatar>
              <span className="min-w-0 flex-1 truncate font-normal">
                {person.name}
              </span>
              <span className="min-w-0 shrink truncate text-sm font-normal text-muted-foreground">
                {person.email}
              </span>
            </Button>
          ))}
        </PopoverContent>
      </Popover>

      <Button type="submit" disabled={!isValid}>
        Add
      </Button>
    </form>
  );
}

/** Everyone on the process, and what can be done to each of them. */
export function AdminList({
  admins,
  onChange,
}: {
  admins: ProcessAdmin[];
  onChange: (next: ProcessAdmin[]) => void;
}) {
  return (
    <ul className="flex flex-col border-t">
      {admins.map((admin) => (
        <li
          key={admin.id}
          className="group/admin flex items-center gap-3 py-3 not-last:border-b"
        >
          <ProfileAvatar
            name={admin.name || admin.email}
            alt={admin.name || admin.email}
            size="sm"
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-base">
              {admin.name || admin.email}
            </span>
            <span className="truncate text-sm text-muted-foreground">
              {admin.name ? admin.email : 'Invited just now'}
            </span>
          </span>
          {admin.isYou ? (
            <Badge variant="secondary" className="shrink-0">
              You
            </Badge>
          ) : (
            /* Two things you can do to somebody you invited, and one of
                     them is destructive — so they go behind a menu rather than
                     sitting on the row where a mis-click removes an admin. */
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Manage ${admin.email}`}
                    className="shrink-0"
                  />
                }
              >
                <LuEllipsisVertical className="size-4" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    toast.success(`Invitation resent to ${admin.email}`)
                  }
                >
                  <LuSend className="size-4" aria-hidden />
                  Resend invitation
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() =>
                    onChange(admins.filter((item) => item.id !== admin.id))
                  }
                >
                  <LuTrash2 className="size-4" aria-hidden />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * One more admin. Named so the two dialogs add them the same way.
 *
 * The name is what separates the two cases downstream: an account picked from
 * the directory has one and is simply on the process, while a typed address has
 * none and `AdminList` reads that as an outstanding invitation.
 */
export function addAdmin(
  admins: ProcessAdmin[],
  { email, name = '' }: { email: string; name?: string },
): ProcessAdmin[] {
  return [...admins, { id: `admin-${admins.length}-${email}`, name, email }];
}
