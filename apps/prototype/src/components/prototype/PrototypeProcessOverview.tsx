'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@op/sense/AlertDialog';
import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { GradientHeader, Header1, Header2, Header3 } from '@op/sense/Header';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { RichTextViewer } from '@op/sense/RichTextEditor';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@op/sense/Sidebar';
import { StatusBadge } from '@op/sense/StatusBadge';
import { toast } from '@op/sense/Toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@op/sense/Tooltip';
import { MegaphoneIcon } from '@op/sense/icons';
import { cn } from '@op/sense/lib/utils';
import { useLocale } from 'next-intl';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  LuAlignJustify,
  LuArrowLeft,
  LuChevronDown,
  LuFileText,
  LuLink,
  LuImage,
  LuPencil,
  LuPlay,
  LuPlus,
  LuSettings,
  LuTrash2,
  LuUserPlus,
} from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CommonLogo } from '@/components/CommonLogo';
import { LocaleChooser } from '@/components/LocaleChooser';

import { HoverEdit } from './HoverEdit';
import { PrototypeDashedEmptyState } from './PhaseBuilderEmpty';
import { PrototypeAdminModal } from './PrototypeAdminModal';
import { PrototypeBannerModal } from './PrototypeBannerModal';
import { PrototypeCurrentPhasePage } from './PrototypeCurrentPhasePage';
import { PrototypeLaunchModal } from './PrototypeLaunchModal';
import { PrototypePhaseRail } from './PrototypePhaseRail';
import { PrototypeResourcePanel } from './PrototypeResourcePanel';
import { PrototypeRichTextField } from './PrototypeRichTextToolbar';
import { PrototypeSettingsModal } from './PrototypeSettingsModal';
import { PrototypeSidebarNav } from './PrototypeSidebarNav';
import { PrototypeTitleField } from './PrototypeTitleField';
import { PROTOTYPE_STEWARDS, PROTOTYPE_USER } from './fakeUser';
import { formatShortDate } from './formatDate';
import {
  LAUNCH,
  LAUNCH_CSS_VARS,
  LAUNCH_SEQUENCE_MS,
} from './launchChoreography';
import {
  isRailEditing as isRailEditingStored,
  type PrototypePhase,
  type PrototypeProcess,
  canPublish,
  processAdmins,
  returnsToCurrentPhase,
  setRailEditing,
  setReturnsToCurrentPhase,
  vocabulary,
} from './store';

/** The live page's two tabs. A draft only ever shows the overview. */
type OverviewTab = 'overview' | 'current';

/** The product's own copy for an empty overview body. */
const ABOUT_PLACEHOLDER =
  'Write what participants need to know about this process — its goals, timeline, who’s running it, how to participate.';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * The process page. A live process has no edit mode: it is the page participants
 * read, and everything on it is editable where it sits — the affordance appears
 * on the thing itself when reached for (`HoverEdit`). A phase is the exception,
 * because its editor is a page of its own.
 *
 * A draft keeps its own chrome and its setup rows: there is no participant view
 * to preserve yet, and the rail's single CTA is what carries the setup through.
 *
 * Layout follows the real overview page: hero, then the 12-column grid with the
 * phase rail at `col-span-4` and the participant-facing column at `col-span-7
 * col-start-6`.
 */
export function PrototypeProcessOverview({
  process: record,
  isEditing,
  onStopEditing,
  onChange,
  onOpenPhase,
}: {
  process: PrototypeProcess;
  /** A draft is being set up. A live process is simply itself, and editable. */
  isEditing: boolean;
  onStopEditing: () => void;
  onChange: (patch: (process: PrototypeProcess) => PrototypeProcess) => void;
  onOpenPhase: (phaseId: string) => void;
}) {
  /* `held` is the window between committing the launch and closing the dialog.
     `playing` is the sequence itself. */
  const [launchStage, setLaunchStage] = useState<'none' | 'held' | 'playing'>(
    'none',
  );
  /* What the process was immediately before the launch wrote to it. Holding the
     draft *chrome* was not enough: the launch sets `status` and
     `currentPhaseIndex`, and everything else on the page is derived from those —
     so the phase chip opened, the hero grew its buttons and `Add a phase` went,
     all behind a dialog nobody could see past. Rendering the held window from
     the snapshot keeps the whole page in its draft state at once, and there is
     nothing to gate case by case. Writes are unaffected: they go through
     `onChange` to the real record. */
  const draftBeforeLaunch = useRef<PrototypeProcess | null>(null);
  /* The rail's height across the swap. Every card in it changes treatment at
     once and the add-a-phase row goes, so the column's height moves by more than
     the individual beats account for — it stepped 38px in one frame. This holds
     the height it had and settles into the height it now measures, which covers
     whatever changed inside rather than needing a beat per piece. Measured the
     way the dialog's own morph is: the natural height first, then paint the old
     one, then release it. */
  const railBox = useRef<HTMLDivElement>(null);
  const railFrom = useRef<number | null>(null);
  const [railMorph, setRailMorph] = useState<{
    height: number;
    settling: boolean;
  } | null>(null);
  const process =
    launchStage === 'held' && draftBeforeLaunch.current
      ? draftBeforeLaunch.current
      : record;
  const nouns = vocabulary(process);
  const t = useTranslations();
  const locale = useLocale();
  /* Both live from the page rather than from the bars that open them: the
     settings dialog is reached from the top bar and the banner one from the hero,
     and neither bar has the process's `onChange`. */
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBannerOpen, setIsBannerOpen] = useState(false);
  const [isLaunchOpen, setIsLaunchOpen] = useState(false);
  /* A live process's rail is read-only until asked. A draft has no such state —
     it is always being set up — so this only ever matters once it has launched.
     Seeded from the flag a phase page leaves behind, so going in to set one up
     and coming back with `Back` returns you to the rail you left. */
  const [isRailEditing, setIsRailEditing] = useState(() =>
    isRailEditingStored(process.id),
  );
  /* What the phases looked like when editing started, so leaving without
     finishing can put them back. Reordering and adding write straight through —
     the rail is a workspace, not a form — so `Discard` restores this. */
  const before = useRef<PrototypePhase[] | null>(null);
  const rail = useRef<HTMLDivElement>(null);
  const [isConfirmingRail, setIsConfirmingRail] = useState(false);

  const openRail = () => {
    before.current = process.phases;
    setRailEditing(process.id, true);
    setIsRailEditing(true);
  };
  const closeRail = () => {
    before.current = null;
    setRailEditing(process.id, false);
    setIsRailEditing(false);
  };
  const railIsDirty =
    before.current !== null &&
    JSON.stringify(before.current) !== JSON.stringify(process.phases);

  /* Coming back from a phase page, the rail is open but nothing has been
     touched yet — the baseline is whatever it is now. */
  useEffect(() => {
    if (isRailEditing && before.current === null) {
      before.current = process.phases;
    }
    // Only when the mode changes: `process.phases` is the thing being watched
    // for change, and folding it in here would reset the baseline on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRailEditing]);

  /*
   * Clicking away from the rail ends the edit, exactly as it does in the About
   * body beside it — `Done` and "click somewhere else" mean the same thing.
   * Watched on `pointerdown`, and blind to anything in a portal: the drag
   * handles and the add-a-phase menu render outside the rail's own node, and
   * using one of those is not leaving.
   */
  useEffect(() => {
    if (!isRailEditing || isConfirmingRail) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const node = rail.current;

      if (!node || !(event.target instanceof Element)) {
        return;
      }

      if (
        node.contains(event.target) ||
        event.target.closest(
          '[role=menu],[role=dialog],[role=alertdialog],[data-slot=popover-content]',
        )
      ) {
        return;
      }

      if (!railIsDirty) {
        closeRail();

        return;
      }

      // With the order changed or a phase added, this press is a question
      // rather than a command.
      event.preventDefault();
      setIsConfirmingRail(true);
    };

    document.addEventListener('pointerdown', onPointerDown, true);

    return () =>
      document.removeEventListener('pointerdown', onPointerDown, true);
  }, [isRailEditing, isConfirmingRail, railIsDirty]);
  /* Which of the live page's two tabs is showing. Local rather than in the URL
     because the tab is a view of the same process, not a place. A draft has no
     tabs at all — there is no current phase until it launches. */
  /* Seeded from the flag `Edit phase` leaves behind, so `Back` out of a phase
     editor returns to the tab you opened it from. Read once — after that the
     tab is whatever you last pressed. */
  const [tab, setTab] = useState<OverviewTab>(() =>
    returnsToCurrentPhase(process.id) ? 'current' : 'overview',
  );

  // Spent on arrival: it answers one navigation, not every later one.
  useEffect(() => {
    setReturnsToCurrentPhase(process.id, false);
  }, [process.id]);
  const isLaunchingNow = launchStage === 'playing';
  useLayoutEffect(() => {
    const el = railBox.current;

    if (!isLaunchingNow || !el || railFrom.current === null) {
      setRailMorph(null);
      return;
    }

    /* Measured before the height is pinned, so this is what the live rail wants
       to be. Then the old height is painted without a transition — with one it
       would animate up to the height it just left — and released on the next
       frame, which is the only paint the transition has to work from. */
    const to = el.offsetHeight;

    setRailMorph({ height: railFrom.current, settling: false });
    const frame = requestAnimationFrame(() =>
      setRailMorph({ height: to, settling: true }),
    );

    return () => cancelAnimationFrame(frame);
  }, [isLaunchingNow]);
  const hasStarted = process.currentPhaseIndex >= 0;
  const publishable = canPublish(process);
  /* Draft chrome outlasts the draft record by exactly as long as the dialog is
     up, so the page turns over in front of somebody rather than behind them. */
  const showDraft = isEditing || launchStage === 'held';
  const isLaunching = launchStage === 'playing';

  return (
    /* The bar carries the app's menu, so the page needs a provider for it to
       open into — and the nav sits in a row beside the content, which is what
       makes it push the page across rather than cover it, the way the app frame
       does everywhere else. The bar is above that row: it spans the window, and
       the nav hangs below it. */
    <SidebarProvider
      defaultOpen={false}
      /* `data-launching` is what every beat of the sequence hangs off, so the
         choreography lives in one stylesheet block rather than as animation
         classes scattered through this tree. */
      data-launching={isLaunching}
      className="flex h-dvh w-full flex-col overflow-hidden bg-background"
      style={
        {
          '--header-height': '3.5rem',
          ...LAUNCH_CSS_VARS,
        } as React.CSSProperties
      }
    >
      {/* The draft bar is the one in flow, and the live bar arrives over it.
          That order matters: with the live bar holding the layout you saw it
          first and then watched the draft controls be taken away, which reads
          as the page correcting itself. This way the bar you were looking at
          stays put and the new one comes in on top of it.

          The wrapper carries the live bar's own background, because there is a
          frame between the two where both are nearly transparent — without a
          ground under them the page shows through the chrome. */}
      {isLaunching ? (
        <div className="relative shrink-0 border-b bg-background">
          <div data-launch="header-draft" className="pointer-events-none">
            <DraftTopBar
              process={process}
              publishable={publishable}
              onExit={onStopEditing}
              onChange={onChange}
              onRequestLaunch={() => undefined}
            />
          </div>
          <div data-launch="header-live" className="absolute inset-0">
            <LiveTopBar
              process={process}
              tab={tab}
              onBackToOverview={() => setTab('overview')}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onEditPhase={() => undefined}
            />
          </div>
        </div>
      ) : showDraft ? (
        <DraftTopBar
          process={process}
          publishable={publishable}
          onExit={onStopEditing}
          onChange={onChange}
          onRequestLaunch={() => setIsLaunchOpen(true)}
        />
      ) : (
        <LiveTopBar
          process={process}
          tab={tab}
          onBackToOverview={() => setTab('overview')}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onEditPhase={() => {
            const current = process.phases[process.currentPhaseIndex];

            if (current) {
              setReturnsToCurrentPhase(process.id, true);
              onOpenPhase(current.id);
            }
          }}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <PrototypeSidebarNav />
        {/* `SidebarInset`, the same column the app frame uses, and `w-full`
            rather than a flex child that gives way: opening the nav shifts the
            page across and lets it run off the end, which is what it does
            everywhere else. Squeezing it reflowed the whole layout instead. */}
        {/* `scrollbar-gutter: stable` because the page's height moves through the
            launch sequence: without it the scrollbar appears and disappears
            mid-animation and shifts the whole layout sideways. */}
        <SidebarInset className="min-h-0 w-full shrink-0 overflow-y-auto [scrollbar-gutter:stable]">
          {/* The live page has two tabs and they are different pages: the
          overview is the process, the current phase is what is running in
          it. Prod routes them separately (`/decisions/[slug]/current`); the
          prototype swaps the body under the same bar. */}
          {tab === 'current' ? (
            <PrototypeCurrentPhasePage process={process} />
          ) : (
            <>
              <section
                className={cn(
                  'group/header relative grid w-full shrink-0 grid-cols-1 justify-center overflow-hidden border-b md:grid-cols-12',
                  process.banner ? 'bg-foreground' : 'bg-muted',
                )}
              >
                {/* A banner sits behind the hero with a scrim over it, and the title goes
                white — the product's own treatment, because a gradient clipped to
                text loses all its contrast over a photograph. */}
                {process.banner ? (
                  <>
                    {/* Blurred, and scaled past the edges so the blur has pixels
                    to pull from instead of fading out at the frame. The hero is
                    a name over a picture, not the picture — a photograph in
                    focus behind type competes with it. */}
                    <img
                      src={process.banner}
                      alt=""
                      className="absolute inset-0 size-full scale-110 object-cover blur-[6px]"
                    />
                    <div aria-hidden className="absolute inset-0 bg-black/45" />
                  </>
                ) : null}

                {/* The one thing edited from the hero is the hero's own image —
                everything else about the process is a field, and fields live in
                `Settings` up in the bar. Small, because it acts on the picture
                behind it rather than on the page. The label says which of the two
                things pressing it does: with nothing there yet, `Edit` offers to
                change something that doesn't exist. */}
                <div className="absolute end-4 top-4 z-20">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBannerOpen(true)}
                  >
                    <LuImage className="size-4" aria-hidden />
                    {process.banner ? t('Edit banner') : t('Add banner')}
                  </Button>
                </div>

                {/* No `gap` here on purpose. The CTA row is the only other
                    child, and a flex gap is all-or-nothing — it appeared at full
                    size the moment the row mounted, so the hero stepped 32px and
                    only then animated. The row carries that space as its own
                    padding, inside the box whose height is animated, which makes
                    it grow rather than arrive. Resting geometry is unchanged. */}
                <div className="relative z-10 mx-auto flex w-full flex-col items-center px-4 pt-16 pb-8 text-center md:col-span-6 md:col-start-4 md:px-6 md:pb-16">
                  <div className="flex w-full flex-col items-center gap-3">
                    {/* Typed in place while it is a draft, the way a phase's name
                    is on its own page — naming the thing is the first act of
                    setting it up, and a modal for one field is a detour. Live,
                    it is read-only here and changed from `Edit`. */}
                    {showDraft ? (
                      <PrototypeTitleField
                        value={process.name}
                        onChange={(name) =>
                          onChange((current) => ({ ...current, name }))
                        }
                        ariaLabel={t('Process name')}
                        /* A long name wraps at display size, the way the live
                           heading does. A single-line field scrolls instead, so
                           the draft was cutting off names the live page shows in
                           full. */
                        multiline
                        centered
                        /* The colour is the component's to decide here: on a
                           banner the title is white at rest but has to go back to
                           normal inside the white editing box. */
                        onImage={Boolean(process.banner)}
                        className="font-serif text-display font-light"
                      />
                    ) : process.banner ? (
                      <Header1 className="text-white">{process.name}</Header1>
                    ) : (
                      <GradientHeader data-launch="title">
                        <Header1>{process.name}</Header1>
                      </GradientHeader>
                    )}

                    <div
                      className={cn(
                        'flex items-center gap-1.5',
                        process.banner && 'text-white',
                      )}
                    >
                      <ProfileAvatar
                        name={process.steward}
                        alt={process.steward}
                        size="sm"
                      />
                      {/* Changed in place while it is a draft, like the name above
                      it — a menu rather than a field, because the answer is one
                      of the organisations you belong to and not free text. */}
                      {isEditing ? (
                        <span className="flex items-center gap-1">
                          {t('Stewarded by')}
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="bare"
                                  className="h-auto gap-1 rounded-md px-1.5 py-0.5 text-base font-normal underline hover:bg-muted"
                                  aria-label={t(
                                    'Change who is stewarding this',
                                  )}
                                />
                              }
                            >
                              {process.steward}
                              <LuChevronDown className="size-4" aria-hidden />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center">
                              {PROTOTYPE_STEWARDS.map((option) => (
                                <DropdownMenuItem
                                  key={option.name}
                                  onClick={() =>
                                    onChange((current) => ({
                                      ...current,
                                      steward: option.name,
                                    }))
                                  }
                                >
                                  <ProfileAvatar
                                    name={option.name}
                                    alt={option.name}
                                    size="sm"
                                  />
                                  {option.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </span>
                      ) : (
                        <span>
                          {t('Stewarded by')}{' '}
                          <span className="underline">{process.steward}</span>
                        </span>
                      )}
                    </div>
                    {/* No summary here: the About section says this, and saying it twice
                    on one screen makes the hero a duplicate of the page. */}
                  </div>

                  {hasStarted ? (
                    /* The row grows to its own height before anything is in it,
                       so the hero settles once instead of jolting when the
                       buttons arrive. `--launch-space` is what it grows to. */
                    <div
                      data-launch="hero-cta"
                      style={
                        {
                          // The buttons' own height plus the `pt-8` below it.
                          '--launch-space': 'calc(2.75rem + 2rem)',
                        } as React.CSSProperties
                      }
                    >
                      <div
                        data-launch="hero-cta-buttons"
                        className="flex flex-wrap items-center justify-center gap-3 pt-8"
                      >
                        {/* Where the {items} are, which is the phase that is running
                      — the tab switch this replaced was the only way in, and it
                      asked you to know that. */}
                        <Button
                          variant="outline"
                          onClick={() => setTab('current')}
                        >
                          {t('View {items}', { items: nouns.many })}
                        </Button>
                        <Button
                          onClick={() =>
                            toast.info('Prototype: browsing is out of scope')
                          }
                        >
                          {t('Start {an} {item}', {
                            an: nouns.one.match(/^[aeiou]/i) ? 'an' : 'a',
                            item: nouns.one,
                          })}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              {/* The decisions screen's own body width, so a process sits in the
              product rather than beside it. Two explicit tracks rather than a
              12-column grid: the reading column is what it was, and the width
              the page gained goes to the rail, which was the cramped one. */}
              <div className="mx-auto grid w-full max-w-[68rem] shrink-0 grid-cols-1 gap-12 px-4 py-6 md:grid-cols-[minmax(0,1fr)_35rem] md:gap-x-24 md:px-6 md:py-12">
                {/* Left rail — the process itself, then what's pinned beside it. */}
                {/* `gap-6` and the column widths are `DecisionOverview`'s own — the
                page has to sit in the product, not beside it. */}
                {/* 40 between the rail's two sections, against the 16 inside each:
                they are separate things, and at the same gap as the cards within
                one of them the column read as a single long list. */}
                <aside className="flex flex-col gap-10">
                  <div ref={rail} className="group/rail flex flex-col gap-4">
                    {/* Top-aligned, and the same row `HoverEdit` draws beside it —
                    the two columns of this page start with the same thing in the
                    same place. */}
                    <div className="flex items-start justify-between gap-3">
                      {/* The same serif label the phase page's settings cards use —
                      `Header3` with `text-label` is that style exactly, and it
                      is the step `About the Process` uses across the gap: two
                      serif sizes in one row read as offset even with their boxes
                      level, because their half-leading differs. Prod has these
                      as small sans captions; this is a deliberate step away from
                      that, so the two columns read as one system. */}
                      <Header3 className="text-label">
                        {t('Process Overview')}
                      </Header3>
                      {/* Only a live process has a mode to leave: a draft is being
                      set up, so its rail is always the editable one and a button
                      saying so would be a switch with one position. */}
                      {showDraft ? null : (
                        <Button
                          data-launch="edit-a"
                          variant="link"
                          size="inline"
                          onClick={() =>
                            isRailEditing ? closeRail() : openRail()
                          }
                          // The label step, which is what `HoverEdit`'s own `Edit`
                          // uses — the two columns' ways in have to match each other,
                          // not the headings they sit beside.
                          className="text-label"
                        >
                          <LuPencil className="size-3.5" aria-hidden />
                          {isRailEditing ? t('Done') : t('Edit')}
                        </Button>
                      )}
                    </div>

                    <div
                      ref={railBox}
                      style={
                        railMorph
                          ? {
                              height: `${railMorph.height}px`,
                              overflow: 'hidden',
                              transition: railMorph.settling
                                ? `height ${LAUNCH.railHeight}ms ${LAUNCH.morphEasing}`
                                : undefined,
                            }
                          : undefined
                      }
                    >
                      <PrototypePhaseRail
                        process={process}
                        isEditing={showDraft || isRailEditing}
                        locale={locale}
                        onOpenPhase={onOpenPhase}
                        onOpenCurrent={() => setTab('current')}
                        onChange={onChange}
                      />
                    </div>

                    {/* The same question the About body asks, because it is the
                    same situation: you changed something and walked away
                    without saying whether you meant it. Dismissing it puts you
                    back in the rail with the changes intact. */}
                    <AlertDialog
                      open={isConfirmingRail}
                      onOpenChange={setIsConfirmingRail}
                    >
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Keep your changes?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            You have changed the phases without saving. Keeping
                            the changes puts them on the page participants read.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => {
                              const original = before.current;

                              setIsConfirmingRail(false);

                              if (original) {
                                onChange((current) => ({
                                  ...current,
                                  phases: original,
                                }));
                              }

                              closeRail();
                            }}
                          >
                            Discard
                          </AlertDialogAction>
                          <AlertDialogAction
                            onClick={() => {
                              setIsConfirmingRail(false);
                              closeRail();
                            }}
                          >
                            Save changes
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <PinnedResources
                    process={process}
                    isEditing={showDraft}
                    onChange={onChange}
                  />
                </aside>

                {/* Middle column — the page participants will read. */}
                <div className="flex min-w-0 flex-col gap-3">
                  {/* The About body, bare: no card and no heading, the way
                  `OverviewAbout` renders it in the product. Behind the same
                  affordance as the title, so the two things on this page you can
                  rewrite are confirmed and discarded the same way. */}
                  <HoverEdit
                    label={t('the about section')}
                    editSlot="edit-b"
                    /* Titled, like the rail beside it. The body used to run bare
                   under the hero, which read as more hero — a heading says
                   where the page's own writing starts, and gives the way in
                   somewhere to sit. */
                    heading={
                      <Header3 className="text-label">
                        {t('About the Process')}
                      </Header3>
                    }
                    /*
                     * Negative margins on both axes: the padding is there to give the
                     * hover tint and the editor's outline room to breathe, and without
                     * pulling it back out again that padding would push the first line
                     * of the body below `Process Overview` in the rail beside it. And
                     * the prose styles give a first heading a top margin of its own,
                     * which does the same thing again from the inside.
                     */
                    /* `ring-0`: the body's editor draws its own field box now,
                       and `HoverEdit`'s outline around it made two. Both
                       modifiers, because the always-editing case rings on
                       `focus-within` rather than outright. */
                    className="-mx-3 -my-2 px-3 py-2 ring-0 focus-within:ring-0 [&_.tiptap>*:first-child]:mt-0"
                    /* A draft is a setup surface — there is no reading view to protect,
                   so the body is a field you can just start typing into. */
                    alwaysEditing={showDraft}
                    value={process.about}
                    onCommit={(about) =>
                      onChange((current) => ({ ...current, about }))
                    }
                    read={
                      process.about ? (
                        <RichTextViewer content={process.about} />
                      ) : (
                        <p className="text-muted-foreground">
                          {ABOUT_PLACEHOLDER}
                        </p>
                      )
                    }
                    edit={(draft, setDraft) => (
                      <PrototypeRichTextField
                        content={draft}
                        placeholder={ABOUT_PLACEHOLDER}
                        onChange={setDraft}
                      />
                    )}
                  />
                </div>
              </div>
            </>
          )}

          <PrototypeSettingsModal
            isOpen={isSettingsOpen}
            onOpenChange={setIsSettingsOpen}
            process={process}
            onChange={onChange}
          />
        </SidebarInset>
      </div>

      <PrototypeBannerModal
        isOpen={isBannerOpen}
        onOpenChange={setIsBannerOpen}
        process={process}
        onChange={onChange}
      />

      {/* Between the button and the act: launching is the one edit that can't be
          taken back, and there are two things nobody has been asked yet that
          only have an answer while it is still a draft. */}
      <PrototypeLaunchModal
        isOpen={isLaunchOpen}
        onOpenChange={setIsLaunchOpen}
        process={process}
        link={`common.org/decisions/${process.id}`}
        onLaunch={({ targetParticipants, targetSubmissions, visibility }) => {
          /* The record changes here; the page keeps rendering the process as it
             was until the dialog is gone and the sequence can be watched. */
          draftBeforeLaunch.current = record;
          onChange((current) => ({
            ...current,
            targetParticipants: targetParticipants ?? undefined,
            targetSubmissions: targetSubmissions ?? undefined,
            visibility,
            status: 'published',
            currentPhaseIndex: 0,
          }));
          setLaunchStage('held');
        }}
        onDone={() => {
          setIsLaunchOpen(false);

          // The dialog gets out of the way, then the page turns over.
          window.setTimeout(() => {
            // The last chance to read the draft rail: the next render is live.
            railFrom.current = railBox.current?.offsetHeight ?? null;
            draftBeforeLaunch.current = null;
            setLaunchStage('playing');
          }, LAUNCH.pageFlipDelay);
          window.setTimeout(() => {
            setLaunchStage('none');
            toast.success(`${process.name} is live`);
          }, LAUNCH.pageFlipDelay + LAUNCH_SEQUENCE_MS);
        }}
      />
    </SidebarProvider>
  );
}

/** The live page's chrome: Back, title, the tab switch, and how changes go out. */
function LiveTopBar({
  process,
  tab,
  onBackToOverview,
  onOpenSettings,
  onEditPhase,
}: {
  process: PrototypeProcess;
  tab: OverviewTab;
  onBackToOverview: () => void;
  onOpenSettings: () => void;
  onEditPhase: () => void;
}) {
  const t = useTranslations();
  const isCurrent = tab === 'current';

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b bg-background">
      <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
        {/* The overview *is* the process — there is nothing above it to go back
            to but the app itself, so it wears the app's own start: the menu and
            the logo, exactly as the decisions list does. A phase is a screen
            inside it, and that gets a way back and the name of what you are
            inside. */}
        {isCurrent ? (
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="link"
              className="max-md:size-11"
              onClick={onBackToOverview}
            >
              <LuArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
              <span className="hidden md:flex">{t('Back')}</span>
            </Button>
            <span
              aria-hidden
              className="hidden h-6 w-px shrink-0 bg-border md:block"
            />
            <ProcessTitle title={process.name} />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <SidebarTrigger
              aria-label={t('Open menu')}
              className="size-8 rounded-lg md:size-11"
            >
              <LuAlignJustify className="size-4" />
            </SidebarTrigger>
            <CommonLogo />
          </div>
        )}

        <div className="flex items-center gap-2 md:gap-3">
          {/* On a phase, the one thing worth doing from the chrome is going to
              where it is configured. The process's own settings belong to the
              process, so they are offered where the process is. */}
          {isCurrent ? (
            <Button variant="outline" onClick={onEditPhase}>
              <LuPencil className="size-3.5" aria-hidden />
              {t('Edit phase')}
            </Button>
          ) : (
            <Button variant="outline" onClick={onOpenSettings}>
              <LuSettings className="size-4" aria-hidden />
              {t('Settings')}
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            aria-label={t('Toggle updates panel')}
            onClick={() => toast.info('Prototype: updates are out of scope')}
          >
            <MegaphoneIcon className="size-4 stroke-[1.5]" />
          </Button>
          <LocaleChooser />
          <ProfileAvatar
            name={PROTOTYPE_USER.name ?? ''}
            alt={PROTOTYPE_USER.name ?? ''}
          />
        </div>
      </div>
    </header>
  );
}

/**
 * Draft chrome: leaving, the draft marker, and the actions that matter before
 * launch. Launch is not offered at all until the submissions phase could run —
 * an unrunnable process shouldn't be launchable.
 */
function DraftTopBar({
  process,
  publishable,
  onExit,
  onChange,
  onRequestLaunch,
}: {
  process: PrototypeProcess;
  publishable: boolean;
  onExit: () => void;
  onChange: (patch: (process: PrototypeProcess) => PrototypeProcess) => void;
  /* The dialog belongs to the page, not to this bar: launching plays a sequence
     across the whole page, and the bar is one of the things it animates. */
  onRequestLaunch: () => void;
}) {
  const t = useTranslations();
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const admins = processAdmins(process);
  /* Always in the bar, so it says from the start what setting the process up
     leads to — a button that appears only once you are finished tells you
     nothing while you still have work to do. `aria-disabled`, not `disabled`: a
     disabled button takes no pointer or focus events, and the tooltip saying why
     it can't be pressed would be the one thing about it you couldn't reach. */
  const launchButton = (
    <Button
      aria-disabled={!publishable}
      className={cn(!publishable && 'cursor-not-allowed opacity-50')}
      onClick={() => {
        if (publishable) {
          onRequestLaunch();
        }
      }}
    >
      {t('Launch process')}
    </Button>
  );
  /* A running process is edited in place and its changes go out separately, so
     the two states ask for different things: a draft is launched, a live process
     is updated. */

  return (
    // Accent, not background: the whole point is that this bar is not the page
    // people see — you are behind the scenes while it is up.
    <header className="sticky top-0 z-30 shrink-0 border-b bg-accent">
      {/* Three tracks so the marker is centred on the bar rather than on
          whatever is left after the buttons. */}
      <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {/* Leaving a draft keeps it — nothing here is discarded — so the
              control says so rather than looking like an escape hatch. */}
          <Button variant="link" onClick={onExit}>
            {t('Save and exit')}
          </Button>
        </div>

        {/* What this screen is, not what the process is called: the name is in
            the hero right below, and repeating it here says nothing. */}
        <StatusBadge
          variant="inactive"
          icon={false}
          className="justify-self-center"
        >
          {t('Draft process')}
        </StatusBadge>

        <div className="flex items-center justify-end gap-2">
          {/* A link, not an outline: `Launch` is the one thing this bar is for,
              and a second bordered button beside it read as a pair of equals.
              The label answers what pressing it is for — with only you on the
              process there is nothing to manage, and once somebody else is on
              it, adding is no longer the only thing the dialog does. */}
          <Button variant="link" onClick={() => setIsAdminOpen(true)}>
            <LuUserPlus className="size-4" aria-hidden />
            {admins.length > 1 ? t('Manage admins') : t('Add admin')}
          </Button>
          {/* Always here, so the bar says from the start what setting the process
              up leads to — a button that appears once you are finished tells you
              nothing while you still have work to do. `aria-disabled`, not
              `disabled`: a disabled button takes no pointer or focus events, and
              the tooltip saying why it can't be pressed would be the one thing
              about it you couldn't reach. */}
          {publishable ? (
            launchButton
          ) : (
            /* A `span` around the button, not the button as the trigger: Base UI
               replaces the handlers on whatever it renders as the trigger, which
               swallowed `Launch`'s own click. The wrapper also catches the hover
               the button will stop passing on if this ever becomes a real
               `disabled`. */
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex" />}>
                {launchButton}
              </TooltipTrigger>
              <TooltipContent>
                {t('Set up the first phase before launching')}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <PrototypeAdminModal
        isOpen={isAdminOpen}
        onOpenChange={setIsAdminOpen}
        admins={admins}
        onChange={(next) =>
          onChange((current) => ({ ...current, admins: next }))
        }
      />
    </header>
  );
}

/** Mirrors `DecisionInstanceHeader`'s private `DecisionTitle`. */
function ProcessTitle({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  return (
    <Header2
      className={cn('truncate text-label leading-5 font-normal', className)}
    >
      <bdi>{title}</bdi>
    </Header2>
  );
}

function PinnedResources({
  process,
  isEditing,
  onChange,
}: {
  process: PrototypeProcess;
  isEditing: boolean;
  onChange: (patch: (process: PrototypeProcess) => PrototypeProcess) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  // Adding a resource is the product's own side panel, shown read-only: the
  // resource list is not this prototype's subject, but where you go to add one
  // is worth seeing in place.
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  return (
    <div className="group/resources flex flex-col gap-3">
      <Header3 className="text-label">{t('Pinned Resources')}</Header3>

      {process.resources.length === 0 ? (
        // The empty state is offered on a live page too — there is nowhere else
        // to add a resource now — but it stays faint until reached for.
        <div
          className={
            isEditing
              ? undefined
              : 'opacity-40 transition-opacity group-focus-within/resources:opacity-100 group-hover/resources:opacity-100'
          }
        >
          <PrototypeDashedEmptyState
            heading="No resources yet"
            message="Guides, documents and links participants can refer to."
            actionLabel="Add a resource"
            onAction={() => setIsPanelOpen(true)}
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {process.resources.map((resource) => (
            <li key={resource.id} className="group/resource relative">
              {/* `PinnedResourceCard`'s shape: a bordered row, a tinted icon
                  square that goes white on hover, the title, and when it was
                  pinned underneath. */}
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={resource.title}
                className="group block rounded-lg border p-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <div className="flex items-center gap-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-accent group-hover:bg-white">
                    <ResourceIcon url={resource.url} />
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5 pe-8">
                    <p dir="auto" className="truncate text-base">
                      {resource.title}
                    </p>
                    {resource.addedAt ? (
                      <p className="truncate text-sm text-muted-foreground">
                        {t('Added {date}', {
                          date: formatShortDate(
                            new Date(resource.addedAt)
                              .toISOString()
                              .slice(0, 10),
                            locale,
                          ),
                        })}
                      </p>
                    ) : null}
                  </div>
                </div>
              </a>

              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('Remove')}
                className={cn(
                  'absolute end-1 top-1/2 -translate-y-1/2',
                  !isEditing &&
                    'opacity-0 transition-opacity group-hover/resource:opacity-100 focus-visible:opacity-100',
                )}
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    resources: current.resources.filter(
                      (item) => item.id !== resource.id,
                    ),
                  }))
                }
              >
                <LuTrash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {process.resources.length > 0 ? (
        <Button
          variant="link"
          size="inline"
          className={cn(
            'w-fit',
            !isEditing &&
              'opacity-0 transition-opacity group-hover/resources:opacity-100 focus-visible:opacity-100',
          )}
          onClick={() => setIsPanelOpen(true)}
        >
          <LuPlus className="size-4" aria-hidden />
          {t('Add a resource')}
        </Button>
      ) : null}

      <PrototypeResourcePanel
        isOpen={isPanelOpen}
        onOpenChange={setIsPanelOpen}
      />
    </div>
  );
}

/**
 * The product picks a resource's icon from its kind: a play for a video, a page
 * for a document, a link for anything else. There is no mime type here, so the
 * URL is what we have to go on.
 */
function ResourceIcon({ url }: { url: string }) {
  const Icon = /youtu\.?be|vimeo|\.mp4$/i.test(url)
    ? LuPlay
    : /\.(pdf|docx?|xlsx?|pptx?|csv|txt)$/i.test(url)
      ? LuFileText
      : LuLink;

  return <Icon className="size-4 text-foreground" aria-hidden />;
}
