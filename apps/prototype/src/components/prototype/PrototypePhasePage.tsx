'use client';

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@op/sense/Alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@op/sense/AlertDialog';
import { Button } from '@op/sense/Button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@op/sense/Card';
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import { Header1 } from '@op/sense/Header';
import { Input } from '@op/sense/Input';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { Separator } from '@op/sense/Separator';
import type { SortableItemControls } from '@op/sense/Sortable';
import { Spinner } from '@op/sense/Spinner';
import { StatusBadge } from '@op/sense/StatusBadge';
import { Switch } from '@op/sense/Switch';
import { Tabs, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { useLocale } from 'next-intl';
import { useParams } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import {
  LuArrowLeft,
  LuBanknote,
  LuCalendarClock,
  LuCircleCheck,
  LuCircleDot,
  LuCopyPlus,
  LuEye,
  LuGavel,
  LuHistory,
  LuLink,
  LuLock,
  LuMapPin,
  LuPaperclip,
  LuPlus,
  LuStar,
  LuTrash2,
  LuTriangleAlert,
  LuType,
  LuUpload,
} from 'react-icons/lu';

import { useRouter, useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';
import { PHASE_TYPE_LABEL } from '@/components/decisions/CreateProcessWizard/content';
import type { PhaseType } from '@/components/decisions/CreateProcessWizard/types';

import {
  type BuilderAction,
  PhaseBuilderAddButton,
  PhaseBuilderEmpty,
} from './PhaseBuilderEmpty';
import {
  AmountSettings,
  ChoiceSettings,
  LocationSettings,
  PhaseFieldEditor,
  PhaseFieldList,
  PhaseFieldListItem,
  RatingSettings,
} from './PhaseFieldEditor';
import { PrototypeAssignmentsModal } from './PrototypeAssignmentsModal';
import { PrototypeDateRangeField } from './PrototypeDateRangeField';
import { PrototypeFormPreviewModal } from './PrototypeFormPreviewModal';
import { PrototypePeopleTab } from './PrototypePeopleTab';
import { PrototypeTitleField } from './PrototypeTitleField';
import { formatShortDate } from './formatDate';
import {
  DEFAULT_CURRENCY,
  ANSWER_FORMATS,
  type AnswerFormat,
  DEFAULT_BOUNDS,
  DEFAULT_CHOICES,
  DEFAULT_RATING,
  type FormField,
  INVITEE_LABEL,
  isPhaseOverLimit,
  phaseToggles,
  phaseCopy,
  setRailEditing,
  RECOMMENDATION_HINT,
  RECOMMENDATION_LABEL,
  RECOMMENDATION_SCALE,
  RUBRIC_SCALES,
  type RubricCriterion,
  type RubricScale,
  VOTE_METHODS,
  voteMethodMeta,
  type VoteMethod,
  type Assignment,
  assignmentSummary,
  reviewsHaveStarted,
  type PrototypePhase,
  type PrototypeProcess,
  updatePhase,
  updateProcess,
  vocabulary,
  usePrototypeProcess,
} from './store';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * A phase's own full page. Every phase type uses the same shell — only the left
 * pane changes — because that is what makes five quite different setups read as
 * one system.
 *
 * Edits are buffered and `Save` is what commits them, marks the phase set up —
 * which is what advances the rail's CTA on the process page — and returns you to
 * the process. `Back` leaves without saving, after asking.
 */
export function PrototypePhasePage() {
  const t = useTranslations();
  const params = useParams<{ id: string; phaseId: string }>();
  const router = useRouter();
  const { process, isResolved, reload } = usePrototypeProcess(params.id);
  const stored = process?.phases.find((item) => item.id === params.phaseId);
  const [tab, setTab] = useState('setup');
  /*
   * Edits here are buffered, unlike the process page's. A phase is a set of
   * interdependent settings — a window, a form, an access rule — and a
   * half-configured one shouldn't be what participants meet. So the page works
   * on a copy and `Update` is what commits it.
   */
  const [draft, setDraft] = useState<PrototypePhase | null>(null);
  const [isConfirmingExit, setIsConfirmingExit] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const phase = draft ?? stored;
  const isDirty =
    draft !== null && stored !== undefined
      ? JSON.stringify(draft) !== JSON.stringify(stored)
      : false;
  /* The field editors let you type past a name or description limit rather than
     truncating what you paste, so this page is where that gets refused. Read
     from the working copy, not from what is stored — the point is to catch it
     before it is committed. */
  const isOverLimit = phase ? isPhaseOverLimit(phase) : false;

  if (!isResolved) {
    return (
      <div className="flex justify-center p-16" aria-live="polite">
        <Spinner />
      </div>
    );
  }

  if (!process || !phase || !stored) {
    return (
      <div className="flex flex-col items-start gap-4 p-8 sm:p-14">
        <Header1 className="text-headline">Phase not found</Header1>
        <ButtonLink href="/prototype/decisions">Back to decisions</ButtonLink>
      </div>
    );
  }

  /** Edits the working copy, seeded from what is stored the first time. */
  const patch = (update: (current: PrototypePhase) => PrototypePhase) =>
    setDraft((current) => update(current ?? stored));

  /** Where this phase was opened from. */
  const back = `/prototype/decisions/${process.id}`;

  /**
   * What saves, what marks the phase set up, and the way out: a phase is one
   * job, so finishing it should put you back where you chose to do it rather
   * than leaving you on a page with nothing left to change.
   */
  const commit = () => {
    /* Saving finishes the job the rail sent you in to do, so the rail is done
       too — `Back` leaves it open, this closes it. */
    setRailEditing(process.id, false);
    updatePhase(process.id, stored.id, () => ({ ...phase, configured: true }));
    reload();
    setDraft(null);
    toast.success(`${phase.name || 'Phase'} updated`);
    router.push(back);
  };

  const leave = () => {
    if (isDirty) {
      setIsConfirmingExit(true);

      return;
    }

    router.push(back);
  };

  const isInviteOnly = phase.audience === 'invite';
  // The tab only exists while the phase is invite-only; switching access off
  // hides it but keeps the list, so it isn't destructive.
  const showPeople = tab === 'people';

  const confirmExit = (
    <AlertDialog open={isConfirmingExit} onOpenChange={setIsConfirmingExit}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
          <AlertDialogDescription>
            This phase has edits you haven&rsquo;t saved. Leaving now throws
            them away.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {/* The destructive one first, the way out of it last: the button under
            the pointer when the dialog opens should be the one that keeps your
            work, and that is the one on the end. */}
        <AlertDialogFooter>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              setDraft(null);
              router.push(back);
            }}
          >
            Discard
          </AlertDialogAction>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  /* Deleting a phase takes its form, its people and its dates with it, and
     `Update` cannot undo it — so it is the one action on this page that asks
     first. The phase is named in the question rather than described, because
     the rail can hold several and the one being deleted is the fact worth
     confirming. */
  const confirmDelete = (
    <AlertDialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete &ldquo;{phase.name || 'this phase'}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The phase and everything in it will be permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {/* Destructive first, the way out last — same order as the exit
            dialog above, so the safe button is always in the same place. */}
        <AlertDialogFooter>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              setIsConfirmingDelete(false);
              updateProcess(process.id, (current) => ({
                ...current,
                phases: current.phases.filter((item) => item.id !== phase.id),
              }));
              router.push(back);
            }}
          >
            Delete phase
          </AlertDialogAction>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    // Muted ground with white panels on it: this page is a workbench, and the
    // panels are the things being worked on. The process page stays white
    // because it is the page participants read.
    <div className="flex h-dvh w-full flex-col overflow-y-auto bg-muted">
      {/* Same height as the process page's bar, so moving between them doesn't
          jump. White on the muted page: the bar is chrome, not one of the
          panels being worked on. */}
      <header className="sticky top-0 z-30 shrink-0 border-b bg-background">
        <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
          {/* Default size, not `inline`: every other bar's leading control is a
              full-height button, so its glyph sits 14px in from the gutter.
              Flush at the gutter this one read as a different margin. */}
          <Button variant="link" onClick={leave}>
            <LuArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
            {t('Back')}
          </Button>
          {/* Always there, so the way out of this page is always in the same
              place — disabled until there is something to commit, which is
              what says whether anything is pending. The note beside it only
              appears when there is, and is announced when it does. */}
          <div className="flex items-center gap-3">
            {/* Over a limit outranks "unsaved": both are true, but only one of
                them is the reason the button is dead, and that is the one worth
                the space. The field itself says which field and by how much. */}
            {isOverLimit ? (
              <span
                className="hidden text-sm text-destructive sm:block"
                aria-live="polite"
              >
                {t('Some fields are too long')}
              </span>
            ) : isDirty ? (
              <span
                className="hidden text-sm text-muted-foreground sm:block"
                aria-live="polite"
              >
                {t('Unsaved changes')}
              </span>
            ) : null}
            {/* A draft is being built, so its phases are saved; a live phase is
                being changed, so it is updated. */}
            <Button onClick={commit} disabled={!isDirty || isOverLimit}>
              {process.status === 'draft' ? t('Save') : t('Update')}
            </Button>
          </div>
        </div>
      </header>

      {/* Full bleed, above everything, and impossible to mistake for part of
          the design: a Develop phase is the one piece of this flow nobody has
          worked out yet, and the screen below is a stand-in built from the
          submissions form. Said here rather than in a handoff note, because the
          person who needs to know is whoever is looking at it. */}
      {phase.phaseType === 'develop' ? (
        <Alert
          variant="warning"
          className="shrink-0 rounded-none border-x-0 border-t-0"
        >
          <LuTriangleAlert className="size-4" aria-hidden />
          <AlertDescription>
            {t(
              'TBD — Need to better understand this need to design for it, everything below is placeholder for now',
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* The process page's own measure on the same gutters — a phase is a
          screen of that page, so the column can't move when you step into one.
          One vertical interval throughout: 40 under the bar, 40 through the
          hero, 40 from the hero to the work. */}
      <div className="mx-auto flex w-full max-w-[68rem] shrink-0 flex-col gap-10 px-4 pt-10 pb-10 md:px-6">
        {/* What kind of phase, then its name, then what the page is for. The
              badge carries the type so the tabs don't have to, and where the
              phase sits in the order is the rail's job on the process page. */}
        <div className="flex flex-col items-start gap-2">
          {/* `icon={false}`: the badge names the kind of phase, and its default
              status glyph said something about state that this isn't. */}
          <StatusBadge variant="inactive" icon={false}>
            {t('{type} phase', {
              type: t(PHASE_TYPE_LABEL[phase.phaseType]),
            })}
          </StatusBadge>
          <PrototypeTitleField
            value={phase.name}
            onChange={(name) => patch((current) => ({ ...current, name }))}
            ariaLabel={t('Phase name')}
            className="font-serif text-display font-light"
          />
        </div>

        {/* The tabs belong to the work below them, not to the hero above: 24
            down to what they switch, against the page's 40 from the hero. */}
        <div className="flex flex-col gap-6">
          {/* Always both tabs. Who can take part is a question every phase has
              an answer to, and hiding the tab when the answer is "anyone" meant
              the only way to find the setting was to already know it was in the
              options rail. Open, the tab explains itself and offers the switch. */}
          <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
            <TabsList variant="line">
              {/* Not the phase type — the badge above says that. This tab is
                  the form you are building. */}
              <TabsTrigger value="setup">
                {phaseCopy(process, phase.phaseType).setupTab}
              </TabsTrigger>
              <TabsTrigger value="people">
                {INVITEE_LABEL[phase.phaseType]}
                {/* Only a list that exists has a length worth counting. 0 in a
                    warning tone, because an invite-only phase with nobody in it
                    can't run. Tight against the label — it counts that word, it
                    isn't a second thing in the tab. */}
                {isInviteOnly ? (
                  <span
                    className={
                      phase.invitees.length === 0
                        ? 'ms-1 rounded-full bg-destructive-muted px-1.5 text-sm text-destructive'
                        : 'ms-1 rounded-full bg-muted px-1.5 text-sm'
                    }
                  >
                    {phase.invitees.length}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Body: left is the thing this phase is for, right is what governs
            it. Two panes at the frame's own widths — the rail is the fixed one
            at 292, which leaves the work 644 inside a 1024 page, on a 40px gap.
            The tabs swap the left pane only: when the phase runs and who may
            take part are true of the phase whichever list you are looking at,
            so the settings do not come and go with the tab. */}
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
            {showPeople ? (
              /* The same card as the form beside it — a header, one line about
                 what it holds, then the list. The tab swapped a card for a bare
                 list, which read as a different page rather than the other half
                 of this one. */
              <Card className="min-w-0 flex-1 shadow-none [--card-spacing:--spacing(6)]">
                <CardHeader>
                  <CardTitle>
                    {phaseCopy(process, phase.phaseType).peopleTitle}
                  </CardTitle>
                  <CardDescription>
                    {phaseCopy(process, phase.phaseType).peopleHelper}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isInviteOnly ? (
                    <PrototypePeopleTab
                      phase={phase}
                      process={process}
                      patch={patch}
                    />
                  ) : (
                    /* There is no list to show, so the card says why and offers
                       the one thing that would make one. The switch is here as
                       well as in the options rail because this is where somebody
                       looking for the list has ended up. */
                    <Alert variant="info">
                      <LuLink aria-hidden />
                      {/* Title and description rather than one sentence with a
                          bold opening: the state on its own line, then the way
                          out of it. The room for the action is reserved on these
                          two rather than on the alert, because its own `pe-20`
                          for an action is written with a `:has()` selector,
                          which outranks anything passed through `className`. */}
                      <AlertTitle className="md:pe-32">
                        {t('Open to anyone with the link')}
                      </AlertTitle>
                      <AlertDescription className="md:pe-32">
                        {t('Prefer a closed group? Switch to invite only.')}
                      </AlertDescription>
                      <AlertAction>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() =>
                            patch((current) => ({
                              ...current,
                              audience: 'invite',
                            }))
                          }
                        >
                          {t('Make invite only')}
                        </Button>
                      </AlertAction>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* 24 of padding and 24 between everything inside it, which is
                what the frame gives this card — sense's own default is 16. */
              <Card className="min-w-0 flex-1 shadow-none [--card-spacing:--spacing(6)]">
                <CardHeader>
                  <CardTitle>
                    {phaseCopy(process, phase.phaseType).bodyTitle}
                  </CardTitle>
                  <CardDescription>
                    {phaseCopy(process, phase.phaseType).bodyHelper}
                  </CardDescription>
                  {/* A list of questions never shows what it is like to answer
                      them, which is the one thing worth checking before it goes
                      out. Only where there is a form to look at. */}
                  {HAS_FORM.includes(phase.phaseType) ? (
                    <CardAction>
                      <Button
                        variant="link"
                        size="inline"
                        className="text-label"
                        onClick={() => setIsPreviewing(true)}
                      >
                        <LuEye className="size-3.5" aria-hidden />
                        Preview
                      </Button>
                    </CardAction>
                  ) : null}
                </CardHeader>
                <CardContent>
                  <PhaseBody phase={phase} process={process} patch={patch} />
                </CardContent>
              </Card>
            )}

            {/* Tighter than the gap to the body pane beside it: these are one
                stack of settings, and a wider gap read as separate regions of
                the page. Fixed width, so the work beside it takes the slack. */}
            <div className="flex min-w-0 flex-col gap-4 md:w-73 md:shrink-0">
              <PhaseSettings
                phase={phase}
                process={process}
                /* Categories are read off a closed-answer question on the
                   submission form, so that is where "add a question" goes. */
                onAddQuestion={() => {
                  const source = process.phases.find(
                    (item) => item.phaseType === 'submissions',
                  );

                  if (source) {
                    router.push(
                      `/prototype/decisions/${process.id}/phases/${source.id}`,
                    );
                  }
                }}
                previousPhase={
                  process.phases[
                    process.phases.findIndex((item) => item.id === phase.id) - 1
                  ]
                }
                patch={patch}
              />
            </div>
          </div>
        </div>

        {/* Away from the settings it would undo, and gone when it's the last.
            Its own tighter pair: a rule and the button under it are one thing,
            not two more steps of the page. */}
        {process.phases.length > 1 ? (
          <div className="flex flex-col gap-6">
            <Separator />
            <Button
              variant="ghost"
              className="w-fit text-destructive"
              onClick={() => setIsConfirmingDelete(true)}
            >
              <LuTrash2 className="size-4" aria-hidden />
              Delete this phase
            </Button>
          </div>
        ) : null}
      </div>

      {confirmExit}
      {confirmDelete}

      {isPreviewing ? (
        <PrototypeFormPreviewModal
          isOpen
          onOpenChange={setIsPreviewing}
          process={process}
          phase={phase}
        />
      ) : null}
    </div>
  );
}

/**
 * What each answer type collects, as a glyph. Picking a type is picking what the
 * row will ask for, and the icon says that faster than the name does when four
 * of them are stacked in a menu.
 */
const FORMAT_ICON: Record<AnswerFormat, ReactNode> = {
  Text: <LuType className="size-4" aria-hidden />,
  Amount: <LuBanknote className="size-4" aria-hidden />,
  'Multiple choice': <LuCircleDot className="size-4" aria-hidden />,
  Location: <LuMapPin className="size-4" aria-hidden />,
  File: <LuPaperclip className="size-4" aria-hidden />,
};

/** The same, for the scales a review criterion can be scored on. */
const SCALE_ICON: Record<(typeof RUBRIC_SCALES)[number], ReactNode> = {
  'Rating scale': <LuStar className="size-4" aria-hidden />,
  'Yes / No': <LuCircleCheck className="size-4" aria-hidden />,
  Text: <LuType className="size-4" aria-hidden />,
};

/** Phase types whose left pane is a form somebody will fill in. */
const HAS_FORM: PhaseType[] = ['submissions', 'develop', 'review'];

/** The left pane — one per phase type. */
function PhaseBody({
  phase,
  process,
  patch,
}: {
  phase: PrototypePhase;
  process: PrototypeProcess;
  patch: (update: (current: PrototypePhase) => PrototypePhase) => void;
}) {
  const newId = () => `field-${Math.random().toString(36).slice(2, 9)}`;
  // A freshly added row opens itself: it has no wording yet, so collapsed it
  // would be an unnamed line the admin has to go find and click.
  const [open, setOpen] = useState<string[]>([]);

  if (phase.phaseType === 'review') {
    const addCriterion = (scale: RubricScale, isRecommendation = false) => {
      const id = newId();

      patch((current) => ({
        ...current,
        criteria: [
          ...current.criteria,
          {
            id,
            // The recommendation arrives named: it is the same question every
            // time, so there is nothing for the admin to word.
            label: isRecommendation ? RECOMMENDATION_LABEL : '',
            scale,
            optional: false,
            ...(isRecommendation ? { isRecommendation } : {}),
            ...(scale === 'Rating scale' ? { rating: DEFAULT_RATING } : {}),
          },
        ],
      }));
      setOpen([id]);
    };
    const hasRecommendation = phase.criteria.some(
      (criterion) => criterion.isRecommendation,
    );
    const scaleMenu = [
      ...RUBRIC_SCALES.map((scale) => ({
        key: scale,
        label: scale,
        icon: SCALE_ICON[scale],
        onSelect: () => addCriterion(scale),
      })),
      // Ruled off below the answer types, and gone once it exists: there is one
      // overall call per review, not one per thing being scored.
      ...(hasRecommendation
        ? []
        : [
            {
              key: 'recommendation',
              label: 'Recommendation',
              icon: <LuGavel className="size-4" aria-hidden />,
              separated: true,
              onSelect: () => addCriterion(RECOMMENDATION_SCALE, true),
            },
          ]),
    ];

    if (phase.criteria.length === 0) {
      return (
        <PhaseBuilderEmpty
          heading="No fields yet"
          text="Reviewers have nothing to answer until you add one."
          actions={[
            {
              key: 'new',
              label: 'Add a field',
              icon: <LuPlus className="size-4" aria-hidden />,
              onClick: () => undefined,
              tier: 'primary',
              menu: scaleMenu,
            },
            {
              key: 'reuse',
              label: 'Rubric from a previous process',
              icon: <LuHistory className="size-4" aria-hidden />,
              onClick: reuseStub,
              tier: 'tertiary',
            },
          ]}
        />
      );
    }

    /* The recommendation is held out of the drag rather than merely drawn last:
       its place in the rubric is fixed, so it can't be one of the items the
       Sortable is free to move. */
    const scored = phase.criteria.filter(
      (criterion) => !criterion.isRecommendation,
    );
    const recommendation = phase.criteria.find(
      (criterion) => criterion.isRecommendation,
    );
    const renderCriterion = (
      criterion: RubricCriterion,
      dragHandleProps?: SortableItemControls['dragHandleProps'],
    ) => {
      const editCriterion = (
        update: (item: RubricCriterion) => RubricCriterion,
      ) =>
        patch((current) => ({
          ...current,
          criteria: current.criteria.map((item) =>
            item.id === criterion.id ? update(item) : item,
          ),
        }));

      return (
        <PhaseFieldListItem
          key={criterion.id}
          id={criterion.id}
          title={criterion.label}
          fallback="Untitled field"
          isRequired={!criterion.optional}
          isLocked={criterion.isRecommendation}
          dragHandleProps={dragHandleProps}
        >
          <PhaseFieldEditor
            label={criterion.label}
            description={criterion.description}
            optional={criterion.optional}
            nameLabel="Field name"
            /* No picker on the recommendation: the three answers are the whole
               point of it, so there is nothing to choose — the sentence below
               states them instead. */
            {...(criterion.isRecommendation
              ? {}
              : {
                  format: criterion.scale,
                  formatLabel: 'Scored by',
                  formats: RUBRIC_SCALES,
                  onFormatChange: (scale: RubricScale) =>
                    editCriterion((item) => ({
                      ...item,
                      scale,
                      rating:
                        scale === 'Rating scale'
                          ? (item.rating ?? DEFAULT_RATING)
                          : item.rating,
                    })),
                })}
            settings={
              criterion.isRecommendation ? (
                <p className="text-muted-foreground">{RECOMMENDATION_HINT}</p>
              ) : criterion.scale === 'Rating scale' ? (
                <RatingSettings
                  rating={criterion.rating ?? DEFAULT_RATING}
                  onChange={(rating) =>
                    editCriterion((item) => ({ ...item, rating }))
                  }
                />
              ) : null
            }
            onLabelChange={(label) =>
              editCriterion((item) => ({ ...item, label }))
            }
            onDescriptionChange={(description) =>
              editCriterion((item) => ({ ...item, description }))
            }
            onOptionalChange={(optional) =>
              editCriterion((item) => ({ ...item, optional }))
            }
            onDelete={() =>
              patch((current) => ({
                ...current,
                criteria: current.criteria.filter(
                  (item) => item.id !== criterion.id,
                ),
              }))
            }
          />
        </PhaseFieldListItem>
      );
    };

    return (
      <div className="flex flex-col gap-6">
        <PhaseFieldList
          items={scored}
          onReorder={(next) =>
            patch((current) => ({
              ...current,
              criteria: [
                ...next,
                ...current.criteria.filter((item) => item.isRecommendation),
              ],
            }))
          }
          open={open}
          onOpenChange={setOpen}
          getItemLabel={(criterion) => criterion.label || 'Untitled field'}
          pinned={recommendation ? renderCriterion(recommendation) : null}
        >
          {(criterion, { dragHandleProps }) =>
            renderCriterion(criterion, dragHandleProps)
          }
        </PhaseFieldList>
        <PhaseBuilderAddButton label="Add a field" items={scaleMenu} />
      </div>
    );
  }

  if (phase.phaseType === 'voting') {
    return <VotingBody phase={phase} process={process} patch={patch} />;
  }

  if (phase.phaseType === 'results') {
    return <ResultsBody phase={phase} patch={patch} />;
  }

  // Submissions and Develop share the form builder. A Develop phase can carry
  // the earlier submission form's questions over, locked.
  const carriedOver = phase.fields.filter((field) => field.locked);
  const own = phase.fields.filter((field) => !field.locked);
  const previous = process.phases.find(
    (item) => item.phaseType === 'submissions' && item.fields.length > 0,
  );
  const canCarryOver = phase.phaseType === 'develop' && !!previous;
  const addField = (format: AnswerFormat) => {
    const id = newId();

    patch((current) => ({
      ...current,
      fields: [
        ...current.fields,
        { id, label: '', format, optional: false, ...defaultsFor(format) },
      ],
    }));
    setOpen([id]);
  };
  const formatMenu = ANSWER_FORMATS.map((format) => ({
    key: format,
    label: format,
    icon: FORMAT_ICON[format],
    onSelect: () => addField(format),
  }));

  const carryOver = () =>
    patch((current) => ({
      ...current,
      fields: [
        ...(previous?.fields ?? []).map((field) => ({
          ...field,
          id: `${field.id}-carried`,
          locked: true,
        })),
        ...current.fields,
      ],
    }));

  if (phase.fields.length === 0) {
    /* A phase building on an earlier one has exactly two answers — start from
       what was already asked, or start fresh — and nothing else belongs in
       front of that choice. Starting fresh means one open question, not a menu
       of answer types: the first thing anybody writes is a question, and its
       type is a field in the editor that opens with it. */
    if (canCarryOver) {
      return (
        <PhaseBuilderEmpty
          heading="No fields yet"
          text="People have nothing to fill in until you add one."
          actions={[
            {
              key: 'new',
              label: 'New form',
              icon: <LuPlus className="size-4" aria-hidden />,
              onClick: () => addField('Text'),
              tier: 'primary',
            },
            {
              key: 'previous',
              label: 'Add to previous form',
              icon: <LuCopyPlus className="size-4" aria-hidden />,
              onClick: carryOver,
              tier: 'secondary',
            },
          ]}
        />
      );
    }

    const fresh: BuilderAction = {
      key: 'new',
      label: 'Add a field',
      icon: <LuPlus className="size-4" aria-hidden />,
      onClick: () => undefined,
      tier: 'primary',
      menu: formatMenu,
    };
    const actions: BuilderAction[] = [
      fresh,
      {
        key: 'upload',
        label: 'Upload questions',
        icon: <LuUpload className="size-4" aria-hidden />,
        onClick: () => toast.info('Prototype: uploading questions is a stub'),
        tier: 'secondary',
      },
      {
        key: 'reuse',
        label: 'Questions from a previous process',
        icon: <LuHistory className="size-4" aria-hidden />,
        onClick: reuseStub,
        tier: 'tertiary',
      },
    ];

    return (
      <PhaseBuilderEmpty
        heading="No fields yet"
        text="People have nothing to fill in until you add one."
        actions={actions}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {carriedOver.length > 0 && previous ? (
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <LuLock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            The first {carriedOver.length}{' '}
            {carriedOver.length === 1 ? 'question' : 'questions'} come from{' '}
            <strong className="font-strong text-foreground">
              {previous.name}
            </strong>{' '}
            and stay as people answered them. Anything you add goes below.
          </span>
        </p>
      ) : null}

      {/* Carried questions are fixed here, so they read as a line rather than an
          editor: this phase adds to them rather than rewriting them. */}
      {carriedOver.map((field) => (
        <div
          key={field.id}
          className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3"
        >
          <LuLock
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate text-base text-muted-foreground">
            {field.label}
          </span>
          <span className="shrink-0 text-sm text-muted-foreground">
            {field.format}
            {field.optional ? '' : ' · Required'}
          </span>
        </div>
      ))}

      <PhaseFieldList
        items={own}
        /* Only this phase's own questions move; the carried-over ones are
           already answered, so they keep the head of the form. */
        onReorder={(next) =>
          patch((current) => ({
            ...current,
            fields: [...current.fields.filter((item) => item.locked), ...next],
          }))
        }
        open={open}
        onOpenChange={setOpen}
        getItemLabel={(field) => field.label || 'Untitled field'}
      >
        {(field, { dragHandleProps }) => (
          <PhaseFieldListItem
            key={field.id}
            id={field.id}
            title={field.label}
            fallback="Untitled field"
            isRequired={!field.optional}
            isConfidential={field.isConfidential}
            dragHandleProps={dragHandleProps}
          >
            <PhaseFieldEditor
              label={field.label}
              description={field.description}
              format={field.format}
              optional={field.optional}
              nameLabel="Field name"
              formatLabel="Type"
              formats={ANSWER_FORMATS}
              settings={
                field.format === 'Multiple choice' ? (
                  <ChoiceSettings
                    options={field.options ?? DEFAULT_CHOICES}
                    onChange={(options) =>
                      patch((current) => ({
                        ...current,
                        fields: current.fields.map((item) =>
                          item.id === field.id ? { ...item, options } : item,
                        ),
                      }))
                    }
                  />
                ) : field.format === 'Amount' ? (
                  <AmountSettings
                    currency={field.currency ?? DEFAULT_CURRENCY}
                    maxAmount={field.maxAmount}
                    onCurrencyChange={(currency) =>
                      patch((current) => ({
                        ...current,
                        fields: current.fields.map((item) =>
                          item.id === field.id ? { ...item, currency } : item,
                        ),
                      }))
                    }
                    onMaxAmountChange={(maxAmount) =>
                      patch((current) => ({
                        ...current,
                        fields: current.fields.map((item) =>
                          item.id === field.id ? { ...item, maxAmount } : item,
                        ),
                      }))
                    }
                  />
                ) : field.format === 'Location' ? (
                  <LocationSettings
                    bounds={field.bounds ?? DEFAULT_BOUNDS}
                    onChange={(bounds) =>
                      patch((current) => ({
                        ...current,
                        fields: current.fields.map((item) =>
                          item.id === field.id ? { ...item, bounds } : item,
                        ),
                      }))
                    }
                  />
                ) : null
              }
              onLabelChange={(label) =>
                patch((current) => ({
                  ...current,
                  fields: current.fields.map((item) =>
                    item.id === field.id ? { ...item, label } : item,
                  ),
                }))
              }
              onDescriptionChange={(description) =>
                patch((current) => ({
                  ...current,
                  fields: current.fields.map((item) =>
                    item.id === field.id ? { ...item, description } : item,
                  ),
                }))
              }
              onFormatChange={(format) =>
                patch((current) => ({
                  ...current,
                  fields: current.fields.map((item) =>
                    item.id === field.id
                      ? { ...item, format, ...defaultsFor(format, item) }
                      : item,
                  ),
                }))
              }
              isConfidential={field.isConfidential}
              allowsMultiple={field.allowsMultiple}
              onOptionalChange={(optional) =>
                patch((current) => ({
                  ...current,
                  fields: current.fields.map((item) =>
                    item.id === field.id ? { ...item, optional } : item,
                  ),
                }))
              }
              onConfidentialChange={(isConfidential) =>
                patch((current) => ({
                  ...current,
                  fields: current.fields.map((item) =>
                    item.id === field.id ? { ...item, isConfidential } : item,
                  ),
                }))
              }
              /* Only a choice question can take more than one answer, so the
                 toggle is offered by handing over a handler at all. */
              onMultipleChange={
                field.format === 'Multiple choice'
                  ? (allowsMultiple) =>
                      patch((current) => ({
                        ...current,
                        fields: current.fields.map((item) =>
                          item.id === field.id
                            ? { ...item, allowsMultiple }
                            : item,
                        ),
                      }))
                  : undefined
              }
              onDelete={() =>
                patch((current) => ({
                  ...current,
                  fields: current.fields.filter((item) => item.id !== field.id),
                }))
              }
            />
          </PhaseFieldListItem>
        )}
      </PhaseFieldList>

      <div className="flex flex-wrap items-center gap-4">
        <PhaseBuilderAddButton label="Add a field" items={formatMenu} />
        {canCarryOver && carriedOver.length === 0 ? (
          <Button variant="link" size="inline" onClick={carryOver}>
            + Add to previous form
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * What a type needs to be usable the moment it is chosen. A choice question with
 * no answers, or a location with no rule, is a half-made control the admin has
 * to notice is missing — so it arrives filled in.
 */
function defaultsFor(
  format: AnswerFormat,
  existing?: FormField,
): Partial<FormField> {
  if (format === 'Multiple choice') {
    return { options: existing?.options ?? [...DEFAULT_CHOICES] };
  }

  if (format === 'Location') {
    return { bounds: existing?.bounds ?? DEFAULT_BOUNDS };
  }

  /* A currency, because an amount with none is a number nobody can read. No
     maximum, because most amounts don't have one and a default ceiling would be
     a rule the admin never set. */
  if (format === 'Amount') {
    return { currency: existing?.currency ?? DEFAULT_CURRENCY };
  }

  return {};
}

const reuseStub = () =>
  toast.info(
    'Prototype: reuse reads the org\u2019s own history in the real thing.',
  );

/**
 * The right pane, always in this order: when it runs, options, access. Access is
 * last on purpose — dates are what every admin looks for first. Each group is its
 * own card with a quiet label, which is what makes every phase read as one
 * system whatever its body looks like.
 */
function PhaseSettings({
  phase,
  process,
  previousPhase,
  onAddQuestion,
  patch,
}: {
  phase: PrototypePhase;
  process: PrototypeProcess;
  /** The phase before this one — what this window has to follow. */
  previousPhase?: PrototypePhase;
  /** Where the submission form is, for the categories that come from it. */
  onAddQuestion: () => void;
  patch: (update: (current: PrototypePhase) => PrototypePhase) => void;
}) {
  const [assignmentsScreen, setAssignmentsScreen] = useState<
    'chooser' | 'grouping' | null
  >(null);
  /* A change that would land on work already done waits here until it is
     confirmed — see `reviewsHaveStarted`. */
  const [pendingAssignment, setPendingAssignment] = useState<Assignment | null>(
    null,
  );
  const locale = useLocale();

  const hint = previousPhase
    ? previousPhase.endDate
      ? `\u201C${previousPhase.name}\u201D ends ${formatShortDate(previousPhase.endDate, locale)}.`
      : `\u201C${previousPhase.name}\u201D has no dates yet.`
    : undefined;
  return (
    <>
      {/* No label above the control: the card is titled with the window it
          sets, so one repeated the other. What does belong here is what this
          window has to follow, right where it is being picked. */}
      <SettingsCard label={phaseCopy(process, phase.phaseType).window}>
        <PrototypeDateRangeField
          label={phaseCopy(process, phase.phaseType).window}
          /* The windows the phases before this one already occupy. A phase
             cannot start inside one of them: the schedule runs in order, and a
             date that is already spoken for is not an available answer. */
          taken={takenWindows(process, phase)}
          /* One date, not a window: a results phase doesn't run for a while, it
             happens on a day. */
          single={phase.phaseType === 'results'}
          start={parseDay(phase.startDate)}
          end={parseDay(phase.endDate)}
          onChange={(range) =>
            patch((current) => ({
              ...current,
              startDate: toDay(range.start),
              endDate: toDay(range.end),
            }))
          }
        />
        {hint ? (
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <LuCalendarClock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{hint}</span>
          </p>
        ) : null}
      </SettingsCard>

      {/* Review only, and under the dates: when the panel works is asked before
          how the pile reaches them. */}
      {phase.phaseType === 'review' ? (
        <AssignmentsCard
          process={process}
          phase={phase}
          screen={assignmentsScreen}
          onOpen={setAssignmentsScreen}
          onAddQuestion={onAddQuestion}
          onApply={(assignment) => {
            /* Re-cutting the pile under a reviewer who has already finished is
               the consequential edit: it invalidates work somebody did. Every
               other change applies as it is made. */
            if (reviewsHaveStarted(phase)) {
              setPendingAssignment(assignment);

              return;
            }

            patch((current) => ({ ...current, assignment }));
          }}
          pending={pendingAssignment}
          onResolvePending={(confirmed) => {
            if (confirmed && pendingAssignment) {
              const assignment = pendingAssignment;

              patch((current) => ({ ...current, assignment }));
            }

            setPendingAssignment(null);
          }}
        />
      ) : null}

      {/* Always here, even for a phase whose only settings are the ballot: who
          may take part is a question every phase has an answer to, and it leads
          because the rest only describe what happens inside that answer. */}
      <SettingsCard label="Options" contentClassName="gap-6">
        <ToggleRow
          id="phase-invite-only"
          title="Invite only"
          // Switching it off hides the tab but keeps the list, so it isn't
          // destructive.
          helper={`Limited to ${INVITEE_LABEL[
            phase.phaseType
          ].toLowerCase()} you invite.`}
          checked={phase.audience === 'invite'}
          onCheckedChange={(checked) =>
            patch((current) => ({
              ...current,
              audience: checked ? 'invite' : 'anyone',
            }))
          }
        />

        {phaseToggles(process, phase.phaseType).map((toggle) => (
          <ToggleRow
            key={toggle.key}
            id={`toggle-${toggle.key}`}
            title={toggle.title}
            helper={toggle.helper}
            checked={phase.toggles[toggle.key] ?? false}
            onCheckedChange={(checked) =>
              patch((current) => ({
                ...current,
                toggles: { ...current.toggles, [toggle.key]: checked },
              }))
            }
          />
        ))}
      </SettingsCard>
    </>
  );
}

/** One switch and what it does. Every row of the Options card is one of these. */
function ToggleRow({
  id,
  title,
  helper,
  checked,
  onCheckedChange,
}: {
  id: string;
  title: string;
  helper: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Field orientation="horizontal" className="items-start gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <FieldLabel htmlFor={id}>{title}</FieldLabel>
        <FieldDescription>{helper}</FieldDescription>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </Field>
  );
}

/**
 * The store keeps plain `YYYY-MM-DD` days; `DatePicker` speaks `Date`. Both hops
 * go through noon rather than midnight: a midnight UTC date read back in a
 * behind-UTC timezone lands on the previous day, which is the bug that made
 * every seeded date render a day early once already.
 */
/**
 * The windows belonging to the phases that come before this one. Later phases
 * are left out on purpose: this phase runs before them, so their dates are the
 * ones that should move, not this one's.
 */
function takenWindows(
  process: PrototypeProcess,
  phase: PrototypePhase,
): { from: Date; to: Date }[] {
  const index = process.phases.findIndex((item) => item.id === phase.id);

  if (index <= 0) {
    return [];
  }

  return process.phases
    .slice(0, index)
    .map((earlier) => ({
      from: parseDay(earlier.startDate),
      to: parseDay(earlier.endDate),
    }))
    .filter(
      (window): window is { from: Date; to: Date } =>
        Boolean(window.from) && Boolean(window.to),
    );
}

function parseDay(day?: string): Date | undefined {
  if (!day) {
    return undefined;
  }

  const [year, month, date] = day.split('-').map(Number);

  return year && month && date
    ? new Date(year, month - 1, date, 12)
    : undefined;
}

function toDay(date?: Date): string | undefined {
  if (!date) {
    return undefined;
  }

  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * How proposals reach reviewers, stated rather than configured. The card only
 * ever says what is true and offers one link — the modal is where anything
 * changes, so the mode is legible at a glance without opening it, and the
 * sentence changing is how an instant-commit choice confirms itself.
 */
function AssignmentsCard({
  process,
  phase,
  screen,
  onOpen,
  onApply,
  pending,
  onResolvePending,
  onAddQuestion,
}: {
  process: PrototypeProcess;
  phase: PrototypePhase;
  screen: 'chooser' | 'grouping' | null;
  onOpen: (screen: 'chooser' | 'grouping' | null) => void;
  onApply: (assignment: Assignment) => void;
  pending: Assignment | null;
  onResolvePending: (confirmed: boolean) => void;
  /** Where the submission form is — the categories are read off it. */
  onAddQuestion: () => void;
}) {
  const nouns = vocabulary(process, 'review');
  const summary = assignmentSummary(process, phase);

  return (
    <SettingsCard label="Review allocation">
      {/* The fact, then what it means, then the way to change it — stacked, so
          the sentence gets the full width of the card and the link reads as a
          consequence of it rather than as a control on the same line. */}
      <div className="flex flex-col gap-0.5">
        <p className="text-base font-strong" aria-live="polite">
          {summary.title}
        </p>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {summary.helper}
        </p>
      </div>
      {/* `Set grouping` goes straight to the grouping screen; everything else
          starts at the chooser. */}
      <Button
        variant="link"
        size="inline"
        // A control's height, flush with the sentence above it: the frame draws
        // this as a 44px button with no side padding.
        className="h-11 w-fit"
        onClick={() => onOpen(summary.toGrouping ? 'grouping' : 'chooser')}
      >
        {summary.action}
      </Button>

      {screen ? (
        <PrototypeAssignmentsModal
          isOpen
          onOpenChange={(open) => (open ? undefined : onOpen(null))}
          process={process}
          phase={phase}
          openAt={screen}
          onApply={onApply}
          onAddQuestion={onAddQuestion}
        />
      ) : null}

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => (open ? undefined : onResolvePending(false))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reviews have already started</AlertDialogTitle>
            <AlertDialogDescription>
              Someone has finished reviewing the {nouns.many} they were given.
              Changing how {nouns.many} reach reviewers now re-cuts the pile
              underneath them, and that work may no longer count.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              variant="destructive"
              onClick={() => onResolvePending(true)}
            >
              Change it anyway
            </AlertDialogAction>
            <AlertDialogCancel>Keep it as it is</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsCard>
  );
}

/**
 * A settings group. `text-label` is the bottom step of the serif heading scale —
 * the token's own note calls it the small-card title style, and explicitly not a
 * sans control label — so this is `CardTitle` one size down, nothing else.
 */
function SettingsCard({
  label,
  contentClassName,
  children,
}: {
  label: string;
  /** The frame gives each card its own inner rhythm — 8 by default, 24 for a
   *  stack of switches, each of which carries a description of its own. */
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    // 24 of padding, and 24 from the label to what it labels: the card's own
    // gap does the second, which is why the spacing is set once here.
    <Card className="shadow-none [--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-label">{label}</CardTitle>
      </CardHeader>
      <CardContent className={cn('flex flex-col gap-2', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * How the phase votes. One method, so it is a radio group and not a set of
 * switches — a phase that both spread a budget and ranked was a combination
 * nobody had to reason about, and each of these three is a different ballot.
 *
 * The settings that belong to a method sit inside its own option, which is why
 * the options are boxes: picking the method and saying how much of it you get
 * is one decision, not two.
 */
function VotingBody({
  phase,
  process,
  patch,
}: {
  phase: PrototypePhase;
  process: PrototypeProcess;
  patch: (update: (current: PrototypePhase) => PrototypePhase) => void;
}) {
  const method = phase.voteMethod;

  return (
    <RadioGroup
      value={method}
      onValueChange={(next) => {
        const match = VOTE_METHODS.find((option) => option === next);

        if (match) {
          patch((current) => ({ ...current, voteMethod: match }));
        }
      }}
      className="gap-3"
    >
      {VOTE_METHODS.map((option) => (
        <VoteMethodBox key={option} method={option} process={process}>
          {option === method ? (
            <VoteMethodSettings phase={phase} patch={patch} />
          ) : null}
        </VoteMethodBox>
      ))}
    </RadioGroup>
  );
}

/** One method: the radio, its copy, and its own settings when it is the one. */
function VoteMethodBox({
  method,
  process,
  children,
}: {
  method: VoteMethod;
  process: PrototypeProcess;
  children?: ReactNode;
}) {
  const meta = voteMethodMeta(process)[method];

  return (
    <FieldLabel
      htmlFor={`vote-${method}`}
      variant="box"
      className="bg-background"
    >
      <Field orientation="horizontal" className="items-start">
        <RadioGroupItem id={`vote-${method}`} value={method} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-base font-strong">{meta.label}</span>
          <span className="text-sm text-muted-foreground">{meta.helper}</span>
          {children}
        </div>
      </Field>
    </FieldLabel>
  );
}

/**
 * What the chosen method needs to know. Simple voting and stack rank both ask
 * how many votes a person gets — one is how many you may support, the other how
 * many you place in order — and knapsack asks what the bundle has to fit in,
 * plus whether the order inside it counts for anything.
 */
function VoteMethodSettings({
  phase,
  patch,
}: {
  phase: PrototypePhase;
  patch: (update: (current: PrototypePhase) => PrototypePhase) => void;
}) {
  const votes = (
    <Field>
      <FieldLabel htmlFor="vote-count">Votes per person</FieldLabel>
      <Input
        id="vote-count"
        inputMode="numeric"
        className="max-w-32"
        value={phase.pickCount}
        placeholder="e.g. 5"
        onChange={(event) =>
          patch((current) => ({ ...current, pickCount: event.target.value }))
        }
      />
    </Field>
  );

  if (phase.voteMethod === 'knapsack') {
    return (
      <div className="mt-1 flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="vote-budget">Budget to spend</FieldLabel>
          <Input
            id="vote-budget"
            inputMode="numeric"
            className="max-w-48"
            value={phase.budget}
            placeholder="e.g. 250000"
            onChange={(event) =>
              patch((current) => ({ ...current, budget: event.target.value }))
            }
          />
        </Field>

        {/* Not a fourth method: the bundle is still the vote, and this asks
            whether its order is also worth counting when not all of it fits. */}
        <Field orientation="horizontal" className="w-fit">
          <FieldLabel htmlFor="vote-rank-bundle">Rank their picks</FieldLabel>
          <Switch
            id="vote-rank-bundle"
            checked={phase.rankBundle === true}
            onCheckedChange={(checked) =>
              patch((current) => ({ ...current, rankBundle: checked }))
            }
          />
        </Field>
      </div>
    );
  }

  return <div className="mt-1 flex flex-col gap-4">{votes}</div>;
}

function ResultsBody({
  phase,
  patch,
}: {
  phase: PrototypePhase;
  patch: (update: (current: PrototypePhase) => PrototypePhase) => void;
}) {
  return (
    <RadioGroup
      value={phase.resultsDisplay}
      onValueChange={(next) =>
        patch((current) => ({
          ...current,
          resultsDisplay: next === 'titles' ? 'titles' : 'full',
        }))
      }
      className="gap-2.5"
    >
      {[
        {
          value: 'titles',
          label: 'Just the titles of what won',
          description: 'A short list of the outcome.',
        },
        {
          value: 'full',
          label: 'The full entries as submitted',
          description: 'Everything people wrote, as they wrote it.',
        },
      ].map((option) => (
        <FieldLabel
          key={option.value}
          htmlFor={`results-${option.value}`}
          variant="box"
          className="bg-background"
        >
          <Field orientation="horizontal" className="items-start">
            <RadioGroupItem
              id={`results-${option.value}`}
              value={option.value}
            />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-base font-strong">{option.label}</span>
              <span className="text-sm text-muted-foreground">
                {option.description}
              </span>
            </div>
          </Field>
        </FieldLabel>
      ))}
    </RadioGroup>
  );
}
