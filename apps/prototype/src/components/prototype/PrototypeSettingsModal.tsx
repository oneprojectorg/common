'use client';

import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from '@op/sense/Field';
import { OptionBox } from '@op/sense/OptionBox';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { toast } from '@op/sense/Toast';
import { useEffect, useState } from 'react';
import { LuCopy, LuLink } from 'react-icons/lu';

import { CountedInput } from './CountedInput';
import {
  ADMIN_BLURB,
  AdminInvite,
  AdminList,
  addAdmin,
} from './PrototypeAdminModal';
import { PROTOTYPE_STEWARDS } from './fakeUser';
import {
  NAME_LIMIT,
  type PrototypeProcess,
  VISIBILITY_OPTIONS,
  processAdmins,
} from './store';

/** The panes, in the order the rail lists them. */
const SECTIONS = [
  { key: 'details', label: 'Process details' },
  { key: 'admins', label: 'Admins' },
  { key: 'visibility', label: 'Visibility' },
] as const;

type Section = (typeof SECTIONS)[number]['key'];

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * Everything about a running process that isn't its content: what it is called,
 * who fronts it, who can run it, and who can find it. One dialog rather than a
 * header button per question — none of these is worth its own way in, and a
 * header carrying three of them read as a toolbar.
 *
 * Three cards rather than a column of fields: the questions are about different
 * things, and a flat list made the admin list look like another field of the
 * name. The banner is deliberately not here (`PrototypeBannerModal` has it): it
 * is the one setting judged by looking at the page rather than reading a field.
 */
export function PrototypeSettingsModal({
  isOpen,
  onOpenChange,
  process,
  onChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  process: PrototypeProcess;
  onChange: (patch: (current: PrototypeProcess) => PrototypeProcess) => void;
}) {
  /* The only thing held locally: an email half-typed is not a change to the
     process, and it has to survive the re-render each real change causes. */
  const [email, setEmail] = useState('');
  const [section, setSection] = useState<Section>('details');

  const admins = processAdmins(process);
  const visibility = process.visibility ?? 'listed';

  // Cleared between visits, so a dialog reopened isn't holding an abandoned
  // address in a field that reads as empty.
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      // Reopening starts at the top of the rail, not wherever you last were.
      setSection('details');
    }
  }, [isOpen]);

  /* Where the page would live. `common.org` rather than the prototype's own
     host: what this row is for is showing the shape of the address people get. */
  const link = `common.org/decisions/${process.id}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://${link}`);
      toast.success('Link copied');
    } catch {
      // Blocked by the browser or unavailable over plain http — worth saying,
      // because a Copy button that silently does nothing reads as broken.
      toast.error('Copying is blocked here — select the link instead.');
    }
  };

  const trimmed = email.trim();
  const isDuplicate = admins.some(
    (admin) => admin.email.toLowerCase() === trimmed.toLowerCase(),
  );
  const isValid = /.+@.+\..+/.test(trimmed) && !isDuplicate;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {/* One frame, three panes. Stacked they were a scroll you had to get to
          the bottom of to know what was down there; side by side the rail says
          what the dialog contains before you open any of it, and the frame
          holds still as you move between them. */}
      <DialogContent className="gap-0 p-0 sm:h-130 sm:w-160 sm:max-w-160">
        <DialogHeader className="shrink-0 border-b">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          <nav
            aria-label="Settings sections"
            className="flex w-48 shrink-0 flex-col gap-1 border-e bg-muted/40 p-2"
          >
            {SECTIONS.map((item) => (
              <Button
                key={item.key}
                variant={item.key === section ? 'secondary' : 'ghost'}
                className="justify-start"
                aria-current={item.key === section ? 'page' : undefined}
                onClick={() => setSection(item.key)}
              >
                {item.label}
              </Button>
            ))}
          </nav>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
            {section === 'details' ? (
              <>
                <Field>
                  <FieldLabel htmlFor="settings-name">Process name</FieldLabel>
                  <CountedInput
                    id="settings-name"
                    autoFocus
                    value={process.name}
                    limit={NAME_LIMIT}
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="settings-steward">
                    Stewarded by
                  </FieldLabel>
                  <Select
                    value={process.steward}
                    onValueChange={(value) =>
                      onChange((current) => ({
                        ...current,
                        steward:
                          typeof value === 'string' ? value : current.steward,
                      }))
                    }
                    items={Object.fromEntries(
                      PROTOTYPE_STEWARDS.map((option) => [
                        option.name,
                        option.name,
                      ]),
                    )}
                  >
                    <SelectTrigger id="settings-steward" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {PROTOTYPE_STEWARDS.map((option) => (
                          <SelectItem key={option.id} value={option.name}>
                            <span className="flex min-w-0 items-center gap-2">
                              <ProfileAvatar
                                name={option.name}
                                alt={option.name}
                                size="sm"
                              />
                              <span className="truncate">{option.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                {/* Read-only, and said out loud rather than left to be found: the
                  link is the thing an admin hands to people, so the place they
                  come to check the process's own details is where it belongs.
                  `FieldTitle`, not `FieldLabel` — there is no control here to
                  label, and a label pointing at nothing is worse than none. */}
                <Field>
                  <FieldTitle>Process link</FieldTitle>
                  <div className="flex h-11 items-center gap-2 rounded-lg border border-input bg-muted/50 ps-3 pe-1">
                    <LuLink
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate" dir="ltr">
                      {link}
                    </span>
                    <Button variant="ghost" size="sm" onClick={copyLink}>
                      <LuCopy className="size-4" aria-hidden />
                      Copy
                    </Button>
                  </div>
                </Field>
              </>
            ) : null}

            {/* Inline rather than behind its own dialog: a dialog opened from a
                dialog to type one email is a detour. */}
            {section === 'admins' ? (
              <>
                <FieldDescription>{ADMIN_BLURB}</FieldDescription>
                <AdminInvite
                  email={email}
                  onEmailChange={setEmail}
                  isValid={isValid}
                  isDuplicate={isDuplicate}
                  onAdd={() => {
                    onChange((current) => ({
                      ...current,
                      admins: addAdmin(processAdmins(current), trimmed),
                    }));
                    setEmail('');
                  }}
                />
                <AdminList
                  admins={admins}
                  onChange={(next) =>
                    onChange((current) => ({ ...current, admins: next }))
                  }
                />
              </>
            ) : null}

            {/* Who can *find* the page, which is a different question from who
                can take part in it — the description says so out loud, because
                conflating the two is the mistake this pane exists to prevent. */}
            {section === 'visibility' ? (
              <>
                <FieldDescription>
                  Who can find and see this process page — separate from who can
                  take part.
                </FieldDescription>
                <RadioGroup
                  value={visibility}
                  onValueChange={(next) =>
                    onChange((current) => ({
                      ...current,
                      visibility: next === 'unlisted' ? 'unlisted' : 'listed',
                    }))
                  }
                  className="gap-3"
                >
                  {VISIBILITY_OPTIONS.map((option) => (
                    <OptionBox
                      key={option.value}
                      htmlFor={`visibility-${option.value}`}
                      controlPlacement="end"
                      control={
                        <RadioGroupItem
                          id={`visibility-${option.value}`}
                          value={option.value}
                        />
                      }
                      label={
                        <span className="flex items-center gap-2">
                          <option.icon
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          {option.label}
                        </span>
                      }
                      description={option.description}
                    />
                  ))}
                </RadioGroup>
              </>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
