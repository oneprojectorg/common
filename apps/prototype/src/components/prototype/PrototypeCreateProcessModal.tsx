'use client';

import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { cn } from '@op/sense/lib/utils';
import { useEffect, useState } from 'react';
import { LuCopy, LuWandSparkles } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CountedInput } from './CountedInput';
import { OneLineChips } from './OneLineChips';
import { PROTOTYPE_STEWARDS, PROTOTYPE_USER } from './fakeUser';
import { NAME_LIMIT, type PrototypeProcess } from './store';

type Screen = 'choose' | 'duplicate';

/** How many past processes the picker offers before it becomes a list to scan. */
const DUPLICATE_SOURCES = 3;

/**
 * What a process with no banner shows instead: `bg-gradient`, the design
 * system's own green-to-teal radial. A flat grey square reads as a missing
 * image; this reads as the house style, which is what it is.
 */
const FALLBACK_GRADIENT = 'bg-gradient';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * What `New process` opens once you have run one. Duplicating is the common
 * case for anyone doing this a second time — most processes are last year's
 * with the dates moved — so it leads, and the wizard is beside it rather than
 * in front of it.
 *
 * One shell across both screens at a fixed size: the two screens are steps in
 * one decision, and a dialog that resizes under the pointer between them reads
 * as two different dialogs.
 */
export function PrototypeCreateProcessModal({
  isOpen,
  onOpenChange,
  processes,
  onGuided,
  onBlank,
  onDuplicate,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Every process, stock included — they are fine to copy. */
  processes: PrototypeProcess[];
  onGuided: () => void;
  onBlank: () => void;
  onDuplicate: (
    source: PrototypeProcess,
    name: string,
    steward: string,
  ) => void;
}) {
  const t = useTranslations();
  const [screen, setScreen] = useState<Screen>('choose');
  const [sourceId, setSourceId] = useState<string | null>(null);
  /* Expanded while picking, condensed once picked — and expandable again from
     `Change`, which is why it is its own flag rather than `sourceId === null`. */
  const [isPicking, setIsPicking] = useState(true);
  const [name, setName] = useState('');
  /* Whether the name is the admin's or ours. A prefill may be replaced when the
     source changes; something typed may not. */
  const [isNameOwned, setIsNameOwned] = useState(false);
  const [steward, setSteward] = useState(PROTOTYPE_USER.name);

  // Closing resets everything: reopening is starting over, not resuming.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setScreen('choose');
    setSourceId(null);
    setIsPicking(true);
    setName('');
    setIsNameOwned(false);
    setSteward(PROTOTYPE_USER.name);
  }, [isOpen]);

  const source = processes.find((process) => process.id === sourceId) ?? null;
  const canSubmit = Boolean(source) && name.trim().length > 0;

  const pick = (process: PrototypeProcess) => {
    setSourceId(process.id);
    setIsPicking(false);

    if (!isNameOwned) {
      setName(t('Duplicate of {name}', { name: process.name }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {/* Fixed height only where something changes inside it: the duplicate
          screen swaps a list of sources for a pair of fields, and a frame that
          resized between those two would read as two dialogs. The choose screen
          never changes, so it takes the height of what it holds. */}
      <DialogContent
        className={cn(
          'gap-0 p-0 sm:max-h-[calc(100dvh-40px)] sm:w-140 sm:max-w-140',
          screen === 'duplicate' && 'sm:h-140',
        )}
      >
        <DialogHeader className="shrink-0 border-b">
          <DialogTitle>
            {screen === 'choose'
              ? t('Create a new process')
              : t('Duplicate a process')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
          {screen === 'choose' ? (
            <ChooseScreen
              onDuplicate={() => setScreen('duplicate')}
              onGuided={onGuided}
              onBlank={onBlank}
            />
          ) : (
            <DuplicateScreen
              processes={processes}
              source={source}
              isPicking={isPicking}
              onPick={pick}
              onChange={() => setIsPicking(true)}
              name={name}
              onNameChange={(next) => {
                setName(next);
                setIsNameOwned(true);
              }}
              steward={steward}
              onStewardChange={setSteward}
            />
          )}
        </div>

        {/* Only where there is something to put in it. An empty bar is a band
            of chrome saying nothing, and on the choose screen every way out is
            already in the body. */}
        {screen === 'duplicate' ? (
          <DialogFooter className="shrink-0 justify-between">
            <Button variant="outline" onClick={() => setScreen('choose')}>
              {t('Back')}
            </Button>
            <Button
              disabled={!canSubmit}
              onClick={() => {
                if (source) {
                  onDuplicate(source, name.trim(), steward);
                }
              }}
            >
              {t('Duplicate process')}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** The two ways in, and the quiet third. */
function ChooseScreen({
  onDuplicate,
  onGuided,
  onBlank,
}: {
  onDuplicate: () => void;
  onGuided: () => void;
  onBlank: () => void;
}) {
  const t = useTranslations();

  return (
    <>
      {/* Side by side, which is what they are: two ways of doing the same thing,
          weighed against each other rather than read in order. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <OptionCard
          icon={<LuCopy className="size-5" aria-hidden />}
          title={t('Duplicate process')}
          description={t('Start from one you have already run.')}
          onClick={onDuplicate}
        />
        <OptionCard
          icon={<LuWandSparkles className="size-5" aria-hidden />}
          title={t('Guided setup')}
          description={t("Answer a few questions and we'll set it up.")}
          onClick={onGuided}
        />
      </div>

      {/* In the body rather than the footer: it is a third way to start, not an
          action on the two above it. */}
      <div className="flex justify-center pt-1">
        <Button variant="link" size="sm" onClick={onBlank}>
          {t('Start with a blank process')}
        </Button>
      </div>
    </>
  );
}

function OptionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    // Stacked rather than a row: side by side there is no width for an icon, a
    // title and a sentence all on one line.
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer flex-col items-start gap-2 rounded-lg border p-4 text-start transition-colors outline-none hover:border-primary hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex flex-col gap-1">
        <span className="font-serif text-label">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

/** One screen, two states: what you are copying, then what to call the copy. */
function DuplicateScreen({
  processes,
  source,
  isPicking,
  onPick,
  onChange,
  name,
  onNameChange,
  steward,
  onStewardChange,
}: {
  processes: PrototypeProcess[];
  source: PrototypeProcess | null;
  isPicking: boolean;
  onPick: (process: PrototypeProcess) => void;
  onChange: () => void;
  name: string;
  onNameChange: (next: string) => void;
  steward: string;
  onStewardChange: (next: string) => void;
}) {
  const t = useTranslations();

  if (isPicking) {
    return (
      <>
        {/* The three most recent, not everything: you are looking for the one
            you just ran, and a longer list is mostly things you won't pick. */}
        <p className="text-muted-foreground">
          {t('Choose which process to start from.')}
        </p>
        <div className="flex flex-col gap-3">
          {processes.slice(0, DUPLICATE_SOURCES).map((process) => (
            <SourceCard
              key={process.id}
              process={process}
              /* The current pick stays marked while you reconsider it, so
                 `Change` opens on where you were rather than on nothing. */
              isSelected={process.id === source?.id}
              onSelect={() => onPick(process)}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <p className="text-muted-foreground">{t('Duplicating from')}</p>

      {source ? (
        <div className="flex items-stretch overflow-hidden rounded-lg border">
          <span
            aria-hidden
            className={cn(
              'w-24 shrink-0 self-stretch bg-cover bg-center',
              !source.banner && FALLBACK_GRADIENT,
            )}
            style={
              source.banner
                ? { backgroundImage: `url(${source.banner})` }
                : undefined
            }
          />
          <span className="flex min-w-0 flex-1 items-center gap-3 p-4">
            <span className="min-w-0 flex-1 truncate font-serif text-label">
              {source.name}
            </span>
            <Button variant="link" size="sm" onClick={onChange}>
              {t('Change')}
            </Button>
          </span>
        </div>
      ) : null}

      <div className="flex flex-col gap-5 pt-1">
        <Field>
          <FieldLabel htmlFor="duplicate-name">
            {t('Process Name')}
            <RequiredAsterisk />
          </FieldLabel>
          <CountedInput
            id="duplicate-name"
            autoFocus
            value={name}
            limit={NAME_LIMIT}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="duplicate-steward">
            {t('Who is stewarding this process?')}
            <RequiredAsterisk />
          </FieldLabel>
          <Select
            value={steward}
            onValueChange={(value) =>
              onStewardChange(typeof value === 'string' ? value : steward)
            }
            items={Object.fromEntries(
              PROTOTYPE_STEWARDS.map((option) => [option.name, option.name]),
            )}
          >
            <SelectTrigger id="duplicate-steward" className="w-full">
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

        {/* Said once, plainly, instead of a list of checkboxes: none of it is a
            choice, and offering it as one would imply the structure is optional
            and the results might not be. */}
        <FieldDescription>
          {t(
            'Phases, forms, rubrics and settings carry over. Participants, submissions and results do not. The copy starts as a draft — nothing goes live until you launch it.',
          )}
        </FieldDescription>
      </div>
    </>
  );
}

/** One process you could copy, with enough on it to tell it from the others. */
function SourceCard({
  process,
  isSelected,
  onSelect,
}: {
  process: PrototypeProcess;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        /* No padding on the card and `overflow-hidden` on it: the image runs to
           three of its edges, so the padding belongs to the text beside it
           rather than to the row. `items-stretch` is what gives the image the
           row's height instead of its own. */
        'flex w-full cursor-pointer items-stretch overflow-hidden rounded-lg border text-start transition-colors outline-none hover:border-primary hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        isSelected && 'border-primary bg-accent',
      )}
    >
      {/* Its own banner, or the house gradient — a wall of identical text rows
          is hard to pick from, and the picture is the thing people recognise a
          process by. Fixed width, full height: cropping the picture is fine,
          leaving a gap beside it is not. */}
      <span
        aria-hidden
        className={cn(
          'w-24 shrink-0 self-stretch bg-cover bg-center',
          !process.banner && FALLBACK_GRADIENT,
        )}
        style={
          process.banner
            ? { backgroundImage: `url(${process.banner})` }
            : undefined
        }
      />

      {/* The name and what is in it. Where the original got to says nothing
          about whether its shape is the one to start from — and the shape is
          what gets copied. */}
      <span className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <span className="truncate font-serif text-label">{process.name}</span>
        {process.phases.length > 0 ? (
          <OneLineChips
            variant="secondary"
            labels={process.phases.map((phase) => phase.name)}
          />
        ) : null}
      </span>
    </button>
  );
}
