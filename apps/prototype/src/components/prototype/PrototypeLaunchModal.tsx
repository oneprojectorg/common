'use client';

import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { FieldDescription, FieldLabel } from '@op/sense/Field';
import { Header3 } from '@op/sense/Header';
import { NumberField } from '@op/sense/NumberField';
import { OptionBox } from '@op/sense/OptionBox';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { Separator } from '@op/sense/Separator';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LuCheck, LuCopy, LuLink } from 'react-icons/lu';

import { LAUNCH } from './launchChoreography';
import {
  type PrototypeProcess,
  type Visibility,
  VISIBILITY_OPTIONS,
  vocabulary,
} from './store';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * The last thing between a draft and a live process. Two questions, both of
 * which only have an honest answer at this moment: what the admins expect to
 * happen — a prediction, which stops being one as soon as the process runs — and
 * who can find the page, which is a decision about a page nobody could reach
 * until now.
 *
 * Buffered, unlike `Settings`: this dialog ends in an irreversible act, so
 * everything in it waits on the same button.
 */
export function PrototypeLaunchModal({
  isOpen,
  onOpenChange,
  process,
  onLaunch,
  onDone,
  link,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  process: PrototypeProcess;
  /** Commits the launch. Fires when the morph starts, not when the modal closes. */
  onLaunch: (answers: {
    targetParticipants: number | null;
    targetSubmissions: number | null;
    visibility: Visibility;
  }) => void;
  /** Dismissed from the confirmation: close, and hand off to the page. */
  onDone: () => void;
  /** Where the live process will be, for the copyable link. */
  link: string;
}) {
  const nouns = vocabulary(process);
  const [participants, setParticipants] = useState<number | null>(
    process.targetParticipants ?? null,
  );
  const [submissions, setSubmissions] = useState<number | null>(
    process.targetSubmissions ?? null,
  );
  const [visibility, setVisibility] = useState<Visibility>(
    process.visibility ?? 'listed',
  );
  /* `form` asks, `committing` holds while the launch goes out, `live` confirms.
     One container throughout: the confirmation is this dialog changing shape,
     not a second dialog replacing it. */
  const [stage, setStage] = useState<Stage>('form');
  const [copied, setCopied] = useState(false);
  /* The container's height is measured from whichever state is mounted, so the
     morph has something to animate to. Width is deliberately left alone —
     animating it rewraps the text mid-crossfade. */
  const [height, setHeight] = useState<number>();
  const body = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = body.current;

    if (!el) {
      return;
    }

    const measure = () => setHeight(el.offsetHeight);

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(el);

    return () => observer.disconnect();
  }, [stage]);

  const launch = () => {
    setStage('committing');

    window.setTimeout(() => {
      // The launch is real from here: the confirmation has no cancel, and every
      // way out of it is `Done`.
      onLaunch({
        targetParticipants: participants,
        targetSubmissions: submissions,
        visibility,
      });
      setStage('live');
    }, LAUNCH.commitHold);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://${link}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), LAUNCH.copiedFor);
    } catch {
      toast.error('Copying is blocked here — select the link instead.');
    }
  };

  /* Seeded on the way in only. It used to depend on the process fields it
     reads, which the launch itself writes — committing re-ran this and threw the
     dialog back to the form it had just left. `latest` keeps the values current
     without making them a trigger. */
  const latest = useRef({ process });

  latest.current = { process };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const current = latest.current.process;

    setParticipants(current.targetParticipants ?? null);
    setSubmissions(current.targetSubmissions ?? null);
    setVisibility(current.visibility ?? 'listed');
    setStage('form');
    setCopied(false);
  }, [isOpen]);

  return (
    <Dialog
      open={isOpen}
      /* Nothing dismisses it while the launch is going out, and after the morph
         every dismissal is `Done` — the process is already live, so there is
         nothing left to cancel. */
      onOpenChange={(next) => {
        if (next || stage === 'committing') {
          return;
        }

        if (stage === 'live') {
          onDone();

          return;
        }

        onOpenChange(false);
      }}
    >
      <DialogContent
        showCloseButton={stage === 'form'}
        className="sm:max-w-[34rem]"
      >
        {/* The wash sits here rather than inside the confirmation because the
            confirmation is inset from the dialog — it began 38px down and clipped
            itself square, so the light stopped short of the top and showed its
            own straight edges against the panel. At this level the dialog's own
            rounded clip is the only edge it has. A mask rather than a gradient to
            `transparent`: fading a colour to transparent interpolates towards
            transparent black, which greys the falloff.

            No `relative` on the dialog to hang this off: it is already
            positioned, so it is already the containing block — and adding one
            costs it its own `fixed`, which `cn` merges away as the same
            property. That put the panel most of a page down the screen. */}
        {stage === 'live' ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-teal-100"
            style={{
              maskImage:
                'radial-gradient(75% 100% at 50% 0%, black, transparent 72%)',
              WebkitMaskImage:
                'radial-gradient(75% 100% at 50% 0%, black, transparent 72%)',
            }}
          />
        ) : null}

        <DialogHeader className={stage === 'live' ? 'sr-only' : undefined}>
          <DialogTitle>
            {stage === 'live' ? 'Your process is live' : 'Launch process'}
          </DialogTitle>
        </DialogHeader>

        {/* The morph: one box whose height eases between the two states while
            the contents cross over inside it. Height only — animating the width
            rewraps every line of text mid-crossfade. */}
        <div
          className="relative overflow-hidden transition-[height] motion-reduce:transition-none"
          style={{
            height,
            transitionDuration: `${LAUNCH.morph}ms`,
            transitionTimingFunction: LAUNCH.morphEasing,
          }}
        >
          <div ref={body}>
            {stage === 'live' ? (
              <LaunchConfirmation
                nouns={nouns}
                visibility={visibility}
                participants={participants}
                submissions={submissions}
                link={link}
                copied={copied}
                onCopy={copyLink}
                onDone={onDone}
              />
            ) : (
              <LaunchForm
                nouns={nouns}
                isCommitting={stage === 'committing'}
                participants={participants}
                onParticipantsChange={setParticipants}
                submissions={submissions}
                onSubmissionsChange={setSubmissions}
                visibility={visibility}
                onVisibilityChange={setVisibility}
                onCancel={() => onOpenChange(false)}
                onLaunch={launch}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Stage = 'form' | 'committing' | 'live';

/** The question this dialog opens with, unchanged from what shipped. */
function LaunchForm({
  nouns,
  isCommitting,
  participants,
  onParticipantsChange,
  submissions,
  onSubmissionsChange,
  visibility,
  onVisibilityChange,
  onCancel,
  onLaunch,
}: {
  nouns: { one: string; many: string };
  isCommitting: boolean;
  participants: number | null;
  onParticipantsChange: (next: number | null) => void;
  submissions: number | null;
  onSubmissionsChange: (next: number | null) => void;
  visibility: Visibility;
  onVisibilityChange: (next: Visibility) => void;
  onCancel: () => void;
  onLaunch: () => void;
}) {
  return (
    <div
      /* Leaves before the box finishes resizing, and drifts as it goes, so the
         two states pass through each other rather than swapping. */
      className={cn(
        'transition-[opacity,transform] motion-reduce:transition-none',
        isCommitting && 'pointer-events-none -translate-y-2.5 opacity-0',
      )}
      style={{
        transitionDuration: `${LAUNCH.formFadeOut}ms, ${LAUNCH.formDriftOut}ms`,
      }}
    >
      <div className="flex flex-col gap-6 overflow-y-auto p-6">
        <section className="flex flex-col gap-4">
          <Header3 className="text-label">Target</Header3>

          {/* The number beside what it counts rather than under it: these are
                two of the same question, and stacked they read as a form to fill
                in rather than as a pair to weigh against each other. */}
          <TargetRow
            id="launch-participants"
            label="Expected number of participants"
            description="Anyone taking part: submitting, voting, commenting"
            value={participants}
            onChange={onParticipantsChange}
          />
          <TargetRow
            id="launch-submissions"
            label={`Expected number of ${nouns.many}`}
            description={`All ${nouns.many} received, whether or not they move forward`}
            value={submissions}
            onChange={onSubmissionsChange}
          />
        </section>

        <Separator />

        {/* The same field `Settings` carries, asked here because until now
              there was no page to find: a draft is unreachable either way, so
              this is the first moment the answer does anything. */}
        <section className="flex flex-col gap-4">
          <Header3 className="text-label">Visibility</Header3>
          <RadioGroup
            value={visibility}
            onValueChange={(next) =>
              onVisibilityChange(next === 'unlisted' ? 'unlisted' : 'listed')
            }
            className="gap-3 sm:grid-cols-2"
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <OptionBox
                key={option.value}
                htmlFor={`launch-visibility-${option.value}`}
                control={
                  <RadioGroupItem
                    id={`launch-visibility-${option.value}`}
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
        </section>
      </div>

      <DialogFooter>
        <Button variant="outline" disabled={isCommitting} onClick={onCancel}>
          Cancel
        </Button>
        <Button loading={isCommitting} onClick={onLaunch}>
          {isCommitting ? 'Launching' : 'Launch'}
        </Button>
      </DialogFooter>
    </div>
  );
}

/**
 * What the dialog becomes. Everything here assembles in order rather than
 * appearing at once: launching is the one irreversible act in the whole flow,
 * and a confirmation that snaps into place reads like a page that was already
 * there. The stagger is what makes it read as a result.
 */
function LaunchConfirmation({
  nouns,
  visibility,
  participants,
  submissions,
  link,
  copied,
  onCopy,
  onDone,
}: {
  nouns: { one: string; many: string };
  visibility: Visibility;
  participants: number | null;
  submissions: number | null;
  link: string;
  copied: boolean;
  onCopy: () => void;
  onDone: () => void;
}) {
  const baseline = [
    participants === null ? null : `${participants} participants`,
    submissions === null ? null : `${submissions} ${nouns.many}`,
  ].filter(Boolean);

  const rise = (index: number) => ({
    animation: `launch-rise-in ${LAUNCH.riseIn}ms ease-out ${LAUNCH.stagger[index]}ms backwards`,
  });

  return (
    <div className="relative flex flex-col items-center gap-4 overflow-hidden px-6 pt-10 pb-6 text-center">
      <span
        className="relative grid size-14 place-items-center rounded-full bg-primary text-primary-foreground"
        style={{
          animation: `launch-pop-in ${LAUNCH.checkPop}ms ease-out ${LAUNCH.checkPopDelay}ms backwards`,
        }}
      >
        {/* One ring, once. A repeating pulse would read as a status rather than
            as the moment it happened. */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-primary"
          style={{
            animation: `launch-ring ${LAUNCH.ringPulse}ms ease-out ${LAUNCH.ringPulseDelay}ms backwards`,
          }}
        />
        <LuCheck className="relative size-7" aria-hidden />
      </span>

      <Header3 className="relative text-title" style={rise(0)}>
        Your process is live
      </Header3>

      <p className="relative max-w-sm text-muted-foreground" style={rise(1)}>
        {visibility === 'unlisted'
          ? "It's unlisted. Only people you share the link with can find it."
          : "It's public. Anyone with the link can view it and take part."}
      </p>

      <div
        className="relative flex h-11 w-full items-center gap-2 rounded-lg border border-input bg-muted/50 ps-3 pe-1"
        style={rise(2)}
      >
        <LuLink className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-start" dir="ltr">
          {link}
        </span>
        <Button variant="outline" size="sm" onClick={onCopy}>
          {copied ? (
            <LuCheck className="size-4" aria-hidden />
          ) : (
            <LuCopy className="size-4" aria-hidden />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      {baseline.length > 0 ? (
        <p className="relative text-sm text-muted-foreground" style={rise(3)}>
          Baseline saved: {baseline.join(', ')}
        </p>
      ) : null}

      <Button className="relative mt-2 w-full" onClick={onDone} style={rise(4)}>
        Go to your live process
      </Button>
    </div>
  );
}

/** What is being counted, and the box to count it in. */
function TargetRow({
  id,
  label,
  description,
  value,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      {/* `gap-1` is `NumberField`'s own label-to-description step — the field is
          laid out differently here, not spaced differently. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </div>
      <NumberField
        id={id}
        className="w-28 shrink-0"
        value={value}
        onChange={onChange}
        minValue={0}
      />
    </div>
  );
}
