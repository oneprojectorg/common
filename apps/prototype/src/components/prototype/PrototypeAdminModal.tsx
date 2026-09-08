'use client';

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
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { toast } from '@op/sense/Toast';
import { useState } from 'react';
import { LuEllipsisVertical, LuSend, LuTrash2 } from 'react-icons/lu';

import type { ProcessAdmin } from './store';

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
            onAdd={() => {
              onChange(addAdmin(admins, trimmed));
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

/**
 * Somebody new, by email. Split out because `Settings` shows the same row: one
 * field and one button, and the button is what commits — Enter in the field does
 * the same thing, because a lone input asks to be submitted.
 */
export function AdminInvite({
  email,
  onEmailChange,
  isValid,
  isDuplicate,
  onAdd,
}: {
  email: string;
  onEmailChange: (value: string) => void;
  isValid: boolean;
  isDuplicate: boolean;
  onAdd: () => void;
}) {
  return (
    <form
      className="flex items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault();

        if (isValid) {
          onAdd();
        }
      }}
    >
      <Field className="min-w-0 flex-1">
        <FieldLabel htmlFor="admin-email" className="sr-only">
          Email address
        </FieldLabel>
        <Input
          id="admin-email"
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="name@organisation.org"
          aria-invalid={isDuplicate || undefined}
          // The form's own submit doesn't fire from here — something between
          // this field and the dialog eats the key — and a lone field that
          // ignores Enter is broken however good the reason is.
          onKeyDown={(event) => {
            if (event.key === 'Enter' && isValid) {
              event.preventDefault();
              onAdd();
            }
          }}
        />
        {isDuplicate ? (
          <FieldError>They&rsquo;re already an admin.</FieldError>
        ) : null}
      </Field>
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

/** One more admin, invited. Named so the two dialogs add them the same way. */
export function addAdmin(
  admins: ProcessAdmin[],
  email: string,
): ProcessAdmin[] {
  return [
    ...admins,
    { id: `admin-${admins.length}-${email}`, name: '', email },
  ];
}
