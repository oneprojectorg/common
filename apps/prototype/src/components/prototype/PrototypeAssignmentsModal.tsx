'use client';

import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { OptionBox } from '@op/sense/OptionBox';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { Tooltip, TooltipContent, TooltipTrigger } from '@op/sense/Tooltip';
import { cn } from '@op/sense/lib/utils';
import { useEffect, useState } from 'react';
import { LuChevronRight, LuInfo } from 'react-icons/lu';

import { OneLineChips } from './OneLineChips';
import {
  assignmentMeta,
  type Assignment,
  type AssignmentMode,
  type GroupingDimension,
  groupingDimensions,
  phaseAssignment,
  vocabulary,
  type PrototypePhase,
  type PrototypeProcess,
} from './store';

/** The modes the chooser offers as radios — the two with nothing more to ask. */
const RADIO_MODES: AssignmentMode[] = ['open', 'evenly'];

/** The chip row's own gap, in px — needed to work out what fits on the line. */

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * How submissions reach reviewers, in two screens.
 *
 * The chooser commits on `Save` for the two blanket modes, and immediately for
 * manual assignment — that one is a decision to do the work by hand rather than
 * a setting, so there is nothing to confirm. `By submission category` is the one
 * option with depth, so it is the one option that navigates rather than
 * commits, and it commits on the second screen.
 *
 * Both screens are exactly the same size. A modal that resizes under you while
 * you are reading it reads as two different modals.
 */
export function PrototypeAssignmentsModal({
  isOpen,
  onOpenChange,
  process,
  phase,
  openAt = 'chooser',
  onApply,
  onAddQuestion,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  process: PrototypeProcess;
  phase: PrototypePhase;
  /** The card's `Set categories` link deep-links past the chooser. */
  openAt?: 'chooser' | 'grouping';
  onApply: (assignment: Assignment) => void;
  /** Leaves for the form the categories would come from. */
  onAddQuestion: () => void;
}) {
  const stored = phaseAssignment(phase);
  const dimensions = groupingDimensions(process, phase.id);
  const meta = assignmentMeta(process);
  const { many } = vocabulary(process, 'review');

  const [screen, setScreen] = useState<'chooser' | 'grouping'>(openAt);
  /* Both screens have a Save, so a pick is a draft until it is pressed. Manual
     assignment is the exception — it is an action, and commits on press.
     `null` is the chooser with nothing picked, which is where `Change review
     allocation` lands you: starting it over means starting it empty. */
  const [mode, setMode] = useState<AssignmentMode | null>(stored.mode);
  const [selected, setSelected] = useState<string | null>(null);
  /* Whether the chooser is behind us. Opened straight onto the categories — the
     card's own link for a phase already set to categorise — there is no back to
     go to, so the way out is out to the modes instead. */
  const [cameFromChooser, setCameFromChooser] = useState(openAt === 'chooser');

  /* Reopening restores what was chosen last time — the category screen is a
     decision you revise, not one you make again from nothing. */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setScreen(openAt);
    setMode(stored.mode);
    setSelected(stored.groupByFieldIds?.[0] ?? null);
    setCameFromChooser(openAt === 'chooser');
    // Only on open: mid-edit state is the point of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, openAt]);

  const commit = (assignment: Assignment) => {
    onApply(assignment);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {/* Sized, not content-sized: both screens are exactly this tall, so moving
          between them cannot resize the dialog under the cursor — not when a
          title wraps to a second line on one screen and not the other.
          520 rather than the frame's 507: our `text-title` leads at 28 where the
          frame's does at 22, and at 507 that difference put a scrollbar in the
          chooser, which then took 11px off every option's width. */}
      <DialogContent className="sm:h-133 sm:max-w-120">
        {/* The title alone. What the question is belongs with the answers, not
            in the chrome above them — so the header names the thing and the
            question is the first line of the content. */}
        <DialogHeader>
          <DialogTitle>
            {screen === 'chooser' ? 'Review allocation' : `Categorize ${many}`}
          </DialogTitle>
        </DialogHeader>

        {/* Takes whatever the header and footer leave, and scrolls: a form with
            a dozen closed-answer questions gets a scrollbar, not a taller
            dialog. */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pt-8 pb-10">
          {/* Body text, and still the dialog's described-by: it reads as the
              question the options answer rather than as a subtitle. */}
          <DialogDescription className="text-base text-foreground">
            {screen === 'chooser'
              ? `How should ${many} be assigned to review?`
              : `How should ${many} be categorized?`}
          </DialogDescription>

          {screen === 'chooser' ? (
            <ModeChooser
              meta={meta}
              selected={mode}
              onSelect={setMode}
              onOpenGrouping={() => {
                setCameFromChooser(true);
                setScreen('grouping');
              }}
              onManual={() => commit({ ...stored, mode: 'manual' })}
            />
          ) : (
            <CategoryPicker
              dimensions={dimensions}
              selected={selected}
              onSelect={setSelected}
              onAddQuestion={() => {
                onOpenChange(false);
                onAddQuestion();
              }}
            />
          )}
        </div>

        {screen === 'chooser' ? (
          <DialogFooter>
            <Button
              disabled={mode === null || mode === stored.mode}
              onClick={() => mode && commit({ ...stored, mode })}
            >
              Save
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter className="sm:justify-between">
            {/* `Back` only when there is somewhere to go back to. Arriving here
                straight from the card, the chooser is not behind you — it is a
                different decision, offered by name, and starting it means
                starting it with nothing picked. */}
            <Button
              variant="outline"
              onClick={() => {
                if (!cameFromChooser) {
                  setMode(null);
                }

                setScreen('chooser');
              }}
            >
              {cameFromChooser ? 'Back' : 'Change review allocation'}
            </Button>
            <Button
              disabled={!selected}
              onClick={() =>
                commit({ mode: 'group', groupByFieldIds: [selected ?? ''] })
              }
            >
              Save
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The chooser. Two blanket answers as `OptionBox` radio rows, then the one that
 * leads somewhere, then the one that is really a decision to do it by hand.
 *
 * Only the two radios go through `Save`: `By submission category` commits on the
 * next screen instead, and `I will manually assign` is an action rather than an
 * option. That is also why the row that navigates is not a radio — a radio that
 * takes you somewhere else the moment you press it is not a choice you made.
 */
function ModeChooser({
  meta,
  selected,
  onSelect,
  onOpenGrouping,
  onManual,
}: {
  meta: ReturnType<typeof assignmentMeta>;
  /** The draft pick, or nothing — which is a real state on this screen. */
  selected: AssignmentMode | null;
  onSelect: (mode: AssignmentMode) => void;
  onOpenGrouping: () => void;
  onManual: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <RadioGroup
        value={selected ?? ''}
        onValueChange={(next) => {
          const match = RADIO_MODES.find((option) => option === next);

          if (match) {
            onSelect(match);
          }
        }}
        className="gap-3"
      >
        {RADIO_MODES.map((mode) => (
          <OptionBox
            key={mode}
            htmlFor={`assignment-${mode}`}
            controlPlacement="end"
            control={<RadioGroupItem id={`assignment-${mode}`} value={mode} />}
            label={meta[mode].title}
            description={meta[mode].helper}
          />
        ))}
      </RadioGroup>

      {/* Sense's box shell on a button rather than a label: this row goes
          somewhere instead of selecting something, and the current-mode tint is
          applied by hand for the same reason — there is no checked control under
          it to drive it. */}
      <Button
        variant="bare"
        onClick={onOpenGrouping}
        /* Tinted off the draft, exactly as the radios above it are: it is one of
           the four answers to the same question, so picking another has to
           un-pick this one. */
        className={cn(
          'w-full cursor-pointer items-start gap-2 rounded-lg border border-input p-3 transition-colors',
          selected === 'group' &&
            'border-primary bg-accent text-accent-foreground',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5 text-start">
          <span className="text-base leading-4 font-strong">
            {meta.group.title}
          </span>
          <span className="text-sm leading-5 font-normal text-muted-foreground">
            {meta.group.helper}
          </span>
        </span>
        <LuChevronRight
          className="size-6 shrink-0 self-center text-muted-foreground rtl:-scale-x-100"
          aria-hidden
        />
      </Button>

      {/* Not an option among the others: choosing it is choosing to do the work
          yourself, so it commits and closes rather than waiting for Save. Left
          with the options it sits under, not centred away from them. */}
      <Button
        variant="ghost"
        size="sm"
        className="w-fit text-muted-foreground"
        onClick={onManual}
      >
        {meta.manual.title}
      </Button>
    </div>
  );
}

/**
 * Which of the form's closed-answer questions cuts the pile. One of them, not
 * several: a submission belongs to one category, and two categorisations at once
 * was a grid nobody could staff.
 *
 * Each option's face is the category set it would produce, because that is what
 * choosing it means. The question it came from is available behind the info
 * affordance rather than on the face — an admin is choosing between ways to cut
 * the pile, not between questions.
 */
function CategoryPicker({
  dimensions,
  selected,
  onSelect,
  onAddQuestion,
}: {
  dimensions: GroupingDimension[];
  selected: string | null;
  onSelect: (id: string) => void;
  /** Leaves for the form the categories come from. */
  onAddQuestion: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <RadioGroup
        value={selected ?? ''}
        onValueChange={(next) => onSelect(String(next))}
        className="gap-3"
      >
        {dimensions.map((dimension) => (
          <OptionBox
            key={dimension.id}
            htmlFor={`category-${dimension.id}`}
            /* The radio group is a grid, and a grid item's `min-width: auto`
               lets its min-content win — which is the chips laid end to end.
               Without this the box grows past the dialog instead of the chips
               giving way. */
            className="min-w-0"
            control={
              <RadioGroupItem
                id={`category-${dimension.id}`}
                value={dimension.id}
              />
            }
            label={
              <span className="flex items-center gap-1.5">
                <span>By {dimension.name}</span>
                {/* A `span` trigger, not a button: this sits inside the option's
                    own `<label>`, where another control would both be invalid
                    and steal the click that picks the option. Hover explains it,
                    and the text below says the same thing to anything that
                    can't hover — which also puts the source question into the
                    radio's own name, where it is worth having. */}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="flex shrink-0 items-center text-muted-foreground" />
                    }
                  >
                    <LuInfo className="size-3.5" aria-hidden />
                    <span className="sr-only">
                      From &ldquo;{dimension.label}&rdquo; in{' '}
                      {dimension.phaseName}.
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    From &ldquo;{dimension.label}&rdquo; in{' '}
                    {dimension.phaseName}.
                  </TooltipContent>
                </Tooltip>
              </span>
            }
            // The categories themselves, which is what choosing this means.
            description={
              <OneLineChips className="mt-1.5" labels={dimension.options} />
            }
          />
        ))}
      </RadioGroup>

      {/* Where a free-text grouping used to be. Asking for one in prose left the
          categories undefined until an LLM guessed at them; the form already has
          the right shape for this, so the answer is to go add the question. */}
      <div className="rounded-lg border border-dashed border-input p-3">
        <p className="text-sm text-muted-foreground">
          Want different categories? Add a multiple choice question to your
          submission form and its answers become the categories.{' '}
          <Button
            variant="link"
            size="inline"
            className="align-baseline text-sm"
            onClick={onAddQuestion}
          >
            Add a question
          </Button>
        </p>
      </div>
    </div>
  );
}
