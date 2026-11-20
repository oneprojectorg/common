'use client';

import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import { trpc } from '@op/api/client';
import type { PhaseDefinition, PhaseRules } from '@op/api/encoders';
import {
  allowsComments,
  isReviewPhase,
  isVotingPhase,
} from '@op/common/client';
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
import { DatePicker } from '@op/sense/DatePicker';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@op/sense/Field';
import { Header1 } from '@op/sense/Header';
import { Input } from '@op/sense/Input';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import { RichTextViewer } from '@op/sense/RichTextEditor';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Switch } from '@op/sense/Switch';
import { Textarea } from '@op/sense/Textarea';
import { cn } from '@op/sense/lib/utils';
import { useQueryState } from 'nuqs';
import { usePostHog } from 'posthog-js/react';
import { useId, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { RichTextEditorWithToolbar } from '@/components/RichTextEditor/RichTextEditorWithToolbar';
import { ToggleRow } from '@/components/layout/split/form/ToggleRow';

import { useProcessBuilderAutosave } from '../../ProcessBuilderAutosaveContext';
import { LockNote } from '../../components/LockNote';
import { SaveStatusIndicator } from '../../components/SaveStatusIndicator';
import type { SectionProps } from '../../contentRegistry';
import { isPhaseSection, sectionIdToPhaseId } from '../../navigationConfig';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';
import { usePastPhaseLock } from '../../usePastPhaseLock';

export function PhaseDetailPage({
  instanceId,
  decisionProfileId,
}: SectionProps) {
  const [sectionParam] = useQueryState('section', {
    history: 'push',
  });
  const phaseId =
    sectionParam && isPhaseSection(sectionParam)
      ? sectionIdToPhaseId(sectionParam)
      : null;

  if (!phaseId) {
    return null;
  }

  return (
    <PhaseDetailForm
      key={phaseId}
      instanceId={instanceId}
      decisionProfileId={decisionProfileId}
      phaseId={phaseId}
    />
  );
}

const toPayload = (phases: PhaseDefinition[]) =>
  phases.map((p) => ({
    phaseId: p.id,
    name: p.name,
    description: p.description,
    headline: p.headline,
    additionalInfo: p.additionalInfo,
    startDate: p.startDate,
    endDate: p.endDate,
    rules: p.rules,
  }));

function PhaseDetailForm({
  instanceId,
  decisionProfileId,
  phaseId,
}: {
  instanceId: string;
  decisionProfileId: string;
  phaseId: string;
}) {
  const t = useTranslations();
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  const instancePhases = instance.instanceData?.phases;
  const templatePhases = instance.process?.processSchema?.phases;

  const storePhases = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId]?.phases,
  );
  const { saveChanges, autosaveStatus } = useProcessBuilderAutosave();
  const lockState = usePastPhaseLock(instanceId).getLock(phaseId);
  const isPast = lockState === 'past';
  const isCurrent = lockState === 'current';
  const lockNoteId = useId();
  const headingId = useId();
  const additionalInfoLabelId = useId();

  const posthog = usePostHog();
  // Open reviews opt-in is confirmed via a dialog (enabling it changes reviewer
  // behavior), so turning it ON opens this dialog first.
  const [showOpenReviewsModal, setShowOpenReviewsModal] = useState(false);
  const trackOpenReviewsToggled = (enabled: boolean) =>
    posthog.capture(
      'open_reviews_toggled',
      getDecisionCommonProperties({
        decisionInstanceId: instanceId,
        additionalProps: { phase_id: phaseId, enabled },
      }),
    );

  // Resolve the initial phase data (same priority as PhasesSectionContent)
  const allPhases: PhaseDefinition[] = (() => {
    const source = storePhases?.length ? storePhases : instancePhases;
    return (
      source?.map((p) => ({
        id: p.phaseId,
        name: p.name ?? '',
        description: p.description,
        headline: p.headline,
        additionalInfo: p.additionalInfo,
        rules: p.rules ?? {},
        startDate: p.startDate,
        endDate: p.endDate,
      })) ??
      templatePhases ??
      []
    );
  })();

  const phaseIndex = allPhases.findIndex((p) => p.id === phaseId) + 1;
  const phaseCount = allPhases.length;

  const initialPhase = allPhases.find((p) => p.id === phaseId);
  const [phase, setPhase] = useState<PhaseDefinition | undefined>(initialPhase);

  const allPhasesRef = useRef(allPhases);
  allPhasesRef.current = allPhases;

  // The next phase is computed here rather than inside a `setPhase` updater:
  // updaters must be pure, and React runs them during render, so saving from
  // one wrote to the autosave store mid-render and scheduled an update on
  // ProcessBuilderHeaderContent while this component was still rendering.
  // Safe to read `phase` from the closure because every caller updates once
  // per event — if that ever changes, this needs a ref, not an updater.
  const updatePhase = (updates: Partial<PhaseDefinition>) => {
    if (!phase || isPast || (isCurrent && 'startDate' in updates)) {
      return;
    }
    const updated = { ...phase, ...updates };
    setPhase(updated);
    saveChanges({
      phases: toPayload(
        allPhasesRef.current.map((p) => (p.id === phaseId ? updated : p)),
      ),
    });
  };

  const utils = trpc.useUtils();
  const updateRules = (updates: Partial<PhaseRules>) => {
    if (!phase || isPast) {
      return;
    }
    const newRules = { ...phase.rules, ...updates };
    updatePhase({ rules: newRules });

    // Optimistically update getInstance cache so useNavigationConfig
    // reacts immediately (e.g., showing/hiding the Reviews sidebar section).
    utils.decision.getInstance.setData({ instanceId }, (old) => {
      if (!old?.instanceData?.phases) {
        return old;
      }
      return {
        ...old,
        instanceData: {
          ...old.instanceData,
          phases: old.instanceData.phases.map((p) =>
            p.phaseId === phaseId ? { ...p, rules: newRules } : p,
          ),
        },
      };
    });
  };

  // Validation
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const markTouched = (field: string) => {
    if (isPast) {
      return;
    }
    setTouchedFields((prev) => new Set(prev).add(field));
  };

  const safeParseLocal = (dateStr: string | undefined) => {
    if (!dateStr) {
      return undefined;
    }
    const parsed = new Date(dateStr);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  };

  const getErrors = () => {
    if (!phase) {
      return {};
    }
    const errors: Record<string, string> = {};
    if (!phase.name?.trim()) {
      errors.name = t('decisions.processBuilder.phaseNameRequiredError');
    }
    if (!phase.headline?.trim()) {
      errors.headline = t(
        'decisions.processBuilder.phaseHeadlineRequiredError',
      );
    }
    if (!phase.description?.trim()) {
      errors.description = t(
        'decisions.processBuilder.phaseDescriptionRequiredError',
      );
    }
    if (!phase.endDate) {
      errors.endDate = t('decisions.processBuilder.phaseEndDateRequiredError');
    }
    if (phase.startDate && phase.endDate) {
      const start = safeParseLocal(phase.startDate);
      const end = safeParseLocal(phase.endDate);
      if (start && end && end.getTime() < start.getTime()) {
        errors.endDate = t('decisions.processBuilder.phaseEndDateOrderError');
      }
    }
    return errors;
  };

  const errors = getErrors();
  const getErrorMessage = (field: string) =>
    touchedFields.has(field) ? errors[field] : undefined;

  if (!phase) {
    return null;
  }

  return (
    <div className="mx-auto w-full space-y-10 p-4 [scrollbar-gutter:stable] md:max-w-160 md:p-8">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {t('decisions.processBuilder.phaseIndexOfTotal', {
              index: phaseIndex,
              total: phaseCount,
            })}
          </p>
          <Header1 id={headingId} className="text-headline">
            {phase.name?.trim() ? (
              <bdi>{phase.name}</bdi>
            ) : (
              t('decisions.processBuilder.addPhaseAction')
            )}
          </Header1>
        </div>
        <SaveStatusIndicator
          status={autosaveStatus.status}
          savedAt={autosaveStatus.savedAt}
        />
      </div>

      <div
        className="space-y-8"
        role={isPast ? 'group' : undefined}
        aria-labelledby={isPast ? headingId : undefined}
        aria-describedby={isPast ? lockNoteId : undefined}
      >
        {isPast && (
          <LockNote id={lockNoteId} data-testid="past-phase-lock-note">
            {t('decisions.processBuilder.pastPhaseLockedNote')}
          </LockNote>
        )}
        <PhaseField
          id="phase-name"
          label={t('decisions.processBuilder.phaseShortNameLabel')}
          isRequired
          value={phase.name ?? ''}
          onChange={(value) => updatePhase({ name: value })}
          onBlur={() => markTouched('name')}
          errorMessage={getErrorMessage('name')}
          description={t('decisions.processBuilder.phaseShortNameHint')}
          maxLength={50}
          readOnly={isPast}
        />
        <PhaseField
          id="phase-headline"
          label={t('Headline')}
          isRequired
          value={phase.headline ?? ''}
          onChange={(value) => updatePhase({ headline: value })}
          onBlur={() => markTouched('headline')}
          errorMessage={getErrorMessage('headline')}
          description={t('decisions.processBuilder.phaseHeadlineHint')}
          maxLength={50}
          readOnly={isPast}
        />
        <PhaseField
          id="phase-description"
          label={t('Description')}
          isRequired
          multiline
          rows={3}
          value={phase.description ?? ''}
          onChange={(value) => updatePhase({ description: value })}
          onBlur={() => markTouched('description')}
          errorMessage={getErrorMessage('description')}
          description={t('decisions.processBuilder.phaseDescriptionHint')}
          maxLength={250}
          readOnly={isPast}
        />
        <div className="space-y-2">
          <p id={additionalInfoLabelId} className="block font-strong">
            {t('decisions.processBuilder.phaseAdditionalInfoLabel')}
          </p>
          <div role="group" aria-labelledby={additionalInfoLabelId}>
            {isPast ? (
              <RichTextViewer
                content={phase.additionalInfo ?? ''}
                className="rounded-lg border border-input bg-muted"
                editorClassName="min-h-24 p-3"
              />
            ) : (
              <RichTextEditorWithToolbar
                content={phase.additionalInfo ?? ''}
                onChange={(content) => updatePhase({ additionalInfo: content })}
                toolbarPosition="bottom"
                className="rounded-lg border border-input"
                editorClassName="min-h-24 p-3"
              />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {t('decisions.processBuilder.phaseAdditionalInfoHint')}
          </p>
        </div>
        <div
          className="flex flex-wrap gap-4"
          role={isCurrent ? 'group' : undefined}
          aria-labelledby={
            isCurrent ? 'phase-start-date-description' : undefined
          }
        >
          <div className="flex-1">
            <DatePicker
              id="phase-start-date"
              label={t('decisions.processBuilder.startDateLabel')}
              value={safeParseLocal(phase.startDate)}
              maxDate={safeParseLocal(phase.endDate)}
              readOnly={isPast || isCurrent}
              description={
                isCurrent
                  ? t('decisions.processBuilder.currentPhaseStartLockedNote')
                  : undefined
              }
              onChange={(date) => {
                if (date) {
                  updatePhase({ startDate: date.toISOString() });
                }
              }}
            />
          </div>
          <div
            className="flex-1"
            onBlur={(e) => {
              const next = e.relatedTarget as HTMLElement | null;
              // Opening the calendar moves focus into the portaled popover
              // (and moving between the input and its icon stays in-field) —
              // neither is a real blur, so don't flag the field as touched yet.
              if (
                e.currentTarget.contains(next) ||
                next?.closest('[data-slot=popover-content]')
              ) {
                return;
              }
              markTouched('endDate');
            }}
          >
            <DatePicker
              label={t('decisions.processBuilder.endDateLabel')}
              required
              value={safeParseLocal(phase.endDate)}
              minDate={safeParseLocal(phase.startDate)}
              readOnly={isPast}
              onChange={(date) => {
                if (date) {
                  updatePhase({ endDate: date.toISOString() });
                }
                markTouched('endDate');
              }}
              errorMessage={getErrorMessage('endDate')}
            />
          </div>
        </div>

        <ToggleRow
          label={t('decisions.processBuilder.proposalSubmissionLabel')}
          description={t('decisions.processBuilder.proposalSubmissionHint')}
        >
          <Switch
            readOnly={isPast}
            checked={phase.rules?.proposals?.submit ?? false}
            onCheckedChange={(val) =>
              updateRules({
                proposals: { ...phase.rules?.proposals, submit: val },
              })
            }
          />
        </ToggleRow>
        {phase.rules?.proposals?.submit && (
          <ToggleRow
            label={t('decisions.processBuilder.hideProposalsLabel')}
            description={t('decisions.processBuilder.hideProposalsHint')}
          >
            <Switch
              readOnly={isPast}
              checked={phase.rules?.proposals?.defaults?.hidden ?? false}
              onCheckedChange={(val) =>
                updateRules({
                  proposals: {
                    ...phase.rules?.proposals,
                    defaults: {
                      ...phase.rules?.proposals?.defaults,
                      hidden: val,
                    },
                  },
                })
              }
            />
          </ToggleRow>
        )}
        <ToggleRow
          label={t('decisions.processBuilder.proposalEditingLabel')}
          description={t('decisions.processBuilder.proposalEditingHint')}
        >
          <Switch
            readOnly={isPast}
            checked={phase.rules?.proposals?.edit ?? false}
            onCheckedChange={(val) =>
              updateRules({
                proposals: { ...phase.rules?.proposals, edit: val },
              })
            }
          />
        </ToggleRow>
        <ToggleRow
          label={t('decisions.processBuilder.proposalReviewLabel')}
          description={t('decisions.processBuilder.proposalReviewHint')}
        >
          <Switch
            readOnly={isPast}
            checked={isReviewPhase(phase)}
            onCheckedChange={(val) => {
              const nextReviews: PhaseRules['reviews'] = {
                ...phase.rules?.reviews,
                submit: val,
              };
              // Clear any "open reviews" opt-in when review is disabled so a
              // hidden-but-true setting can't silently re-open reviews if
              // review is turned back on later.
              if (!val && phase.rules?.reviews?.openReviews) {
                nextReviews.openReviews = false;
              }
              updateRules({ reviews: nextReviews });
            }}
          />
        </ToggleRow>
        {isReviewPhase(phase) && (
          <ToggleRow
            label={t('decisions.processBuilder.openReviewsLabel')}
            description={t('decisions.processBuilder.openReviewsHint')}
          >
            <Switch
              readOnly={isPast}
              checked={phase.rules?.reviews?.openReviews ?? false}
              onCheckedChange={(val) => {
                // Turning ON is confirmed via a dialog; turning OFF is immediate.
                if (val) {
                  setShowOpenReviewsModal(true);
                } else {
                  trackOpenReviewsToggled(false);
                  updateRules({
                    reviews: { ...phase.rules?.reviews, openReviews: false },
                  });
                }
              }}
            />
          </ToggleRow>
        )}
        <ToggleRow
          label={t('decisions.processBuilder.votingLabel')}
          description={t('decisions.processBuilder.votingHint')}
        >
          <Switch
            readOnly={isPast}
            checked={isVotingPhase(phase)}
            onCheckedChange={(val) => {
              const nextVoting: PhaseRules['voting'] = {
                ...phase.rules?.voting,
                submit: val,
              };
              // "1 vote per member" is the standard default — unlimited voting
              // is the unusual choice and should be picked deliberately.
              if (val && nextVoting.maxVotesPerMember === undefined) {
                nextVoting.maxVotesPerMember = 1;
              }
              updateRules({ voting: nextVoting });
            }}
          />
        </ToggleRow>
        {isVotingPhase(phase) && (
          <ToggleRow
            label={t('decisions.processBuilder.votingLimitLabel')}
            description={t('decisions.processBuilder.votingLimitHint')}
          >
            <VoteLimitSelect
              readOnly={isPast}
              maxVotes={phase.rules?.voting?.maxVotesPerMember}
              onChange={(maxVotesPerMember) =>
                updateRules({
                  voting: { ...phase.rules?.voting, maxVotesPerMember },
                })
              }
            />
          </ToggleRow>
        )}
        <ToggleRow
          label={t('decisions.proposals.commentsHeading')}
          description={t('decisions.processBuilder.commentsHint')}
        >
          <Switch
            readOnly={isPast}
            checked={allowsComments(phase)}
            onCheckedChange={(val) =>
              updateRules({
                comments: { ...phase.rules?.comments, submit: val },
              })
            }
          />
        </ToggleRow>
      </div>

      <AlertDialog
        open={showOpenReviewsModal}
        onOpenChange={setShowOpenReviewsModal}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('decisions.processBuilder.openReviewsConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('decisions.processBuilder.openReviewsConfirmWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                trackOpenReviewsToggled(true);
                updateRules({
                  reviews: { ...phase.rules?.reviews, openReviews: true },
                });
                setShowOpenReviewsModal(false);
              }}
            >
              {t('decisions.processBuilder.enableAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// 'none' is a reserved option id representing "no limit"; must not collide with String(n).
const VOTE_LIMIT_OPTIONS = ['none', '1', '2', '3', '4', '5', '10'] as const;

function VoteLimitSelect({
  maxVotes,
  onChange,
  readOnly,
}: {
  maxVotes: number | undefined;
  onChange: (maxVotes: number | undefined) => void;
  readOnly?: boolean;
}) {
  const t = useTranslations();
  const selectedKey = maxVotes === undefined ? 'none' : String(maxVotes);

  // Preserve out-of-preset values (e.g. seeded via DB) by rendering them as an extra option.
  const options: readonly string[] = VOTE_LIMIT_OPTIONS.includes(
    selectedKey as (typeof VOTE_LIMIT_OPTIONS)[number],
  )
    ? VOTE_LIMIT_OPTIONS
    : [selectedKey, ...VOTE_LIMIT_OPTIONS];

  const labelFor = (key: string) =>
    key === 'none'
      ? t('decisions.processBuilder.noLimit')
      : t('decisions.processBuilder.voteCount', {
          count: Number(key),
        });

  return (
    <Select
      value={selectedKey}
      readOnly={readOnly}
      // Value→label map so SelectValue renders the label, not the raw id.
      items={Object.fromEntries(options.map((key) => [key, labelFor(key)]))}
      onValueChange={(key) => {
        onChange(key === 'none' ? undefined : Number(key));
      }}
    >
      <SelectTrigger
        aria-label={t('decisions.processBuilder.votingLimitLabel')}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((key) => (
            <SelectItem key={key} value={key}>
              {labelFor(key)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

// Labelled text/textarea field with error, description, and a live character
// counter — composes the sense Field + Input/Textarea primitives to reproduce
// one batteries-included labelled field.
function PhaseField({
  id,
  label,
  isRequired,
  value,
  onChange,
  onBlur,
  errorMessage,
  description,
  maxLength,
  multiline,
  rows,
  readOnly,
}: {
  id: string;
  label: string;
  isRequired?: boolean;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  errorMessage?: string;
  description?: string;
  maxLength?: number;
  multiline?: boolean;
  rows?: number;
  readOnly?: boolean;
}) {
  const isInvalid = !!errorMessage;
  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={id}>
        {label}
        {isRequired && <RequiredAsterisk />}
      </FieldLabel>
      {multiline ? (
        <Textarea
          id={id}
          rows={rows}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          readOnly={readOnly}
          className={cn(readOnly && 'bg-muted')}
          aria-invalid={isInvalid || undefined}
        />
      ) : (
        <Input
          id={id}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          readOnly={readOnly}
          className={cn(readOnly && 'bg-muted')}
          aria-invalid={isInvalid || undefined}
        />
      )}
      {(description || errorMessage || maxLength != null) && (
        <div className="flex items-baseline justify-between gap-4">
          <div>
            {errorMessage ? (
              <FieldError>{errorMessage}</FieldError>
            ) : description ? (
              <FieldDescription>{description}</FieldDescription>
            ) : null}
          </div>
          {maxLength != null && (
            <span
              className={cn(
                'text-sm text-muted-foreground',
                (value.length === maxLength || isInvalid) && 'text-destructive',
              )}
            >
              {value.length}/{maxLength}
            </span>
          )}
        </div>
      )}
    </Field>
  );
}
