'use client';

import { trpc } from '@op/api/client';
import type { PhaseDefinition, PhaseRules } from '@op/api/encoders';
import { isReviewPhase, isVotingPhase } from '@op/common/client';
import { DatePicker } from '@op/sense/DatePicker';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@op/sense/Field';
import { Header2 } from '@op/sense/Header';
import { Input } from '@op/sense/Input';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Switch } from '@op/sense/Switch';
import { Textarea } from '@op/sense/Textarea';
import { cn } from '@op/sense/lib/utils';
import { useQueryState } from 'nuqs';
import { useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { RichTextEditorWithToolbar } from '@/components/RichTextEditor/RichTextEditorWithToolbar';
import { ToggleRow } from '@/components/layout/split/form/ToggleRow';

import { useProcessBuilderAutosave } from '../../ProcessBuilderAutosaveContext';
import { SaveStatusIndicator } from '../../components/SaveStatusIndicator';
import type { SectionProps } from '../../contentRegistry';
import { isPhaseSection, sectionIdToPhaseId } from '../../navigationConfig';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';

export function PhaseDetailPage({
  instanceId,
  decisionProfileId,
}: SectionProps) {
  const [sectionParam, setSectionParam] = useQueryState('section', {
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
      onDelete={() => setSectionParam('phases')}
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
  onDelete,
}: {
  instanceId: string;
  decisionProfileId: string;
  phaseId: string;
  onDelete: () => void;
}) {
  const t = useTranslations();
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  const instancePhases = instance.instanceData?.phases;
  const templatePhases = instance.process?.processSchema?.phases;

  const storePhases = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId]?.phases,
  );
  const { saveChanges, autosaveStatus, flushPendingChanges } =
    useProcessBuilderAutosave();

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

  const updatePhase = (updates: Partial<PhaseDefinition>) => {
    setPhase((prev) => {
      if (!prev) {
        return prev;
      }
      const updated = { ...prev, ...updates };
      const phasesPayload = toPayload(
        allPhasesRef.current.map((p) => (p.id === phaseId ? updated : p)),
      );
      saveChanges({ phases: phasesPayload });
      return updated;
    });
  };

  const utils = trpc.useUtils();
  const updateRules = (updates: Partial<PhaseRules>) => {
    if (!phase) {
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
      errors.name = t('Phase name is required');
    }
    if (!phase.headline?.trim()) {
      errors.headline = t('Headline is required');
    }
    if (!phase.description?.trim()) {
      errors.description = t('Description is required');
    }
    if (!phase.endDate) {
      errors.endDate = t('End date is required');
    }
    if (phase.startDate && phase.endDate) {
      const start = safeParseLocal(phase.startDate);
      const end = safeParseLocal(phase.endDate);
      if (start && end && end.getTime() < start.getTime()) {
        errors.endDate = t('End date must be on or after the start date');
      }
    }
    return errors;
  };

  const errors = getErrors();
  const getErrorMessage = (field: string) =>
    touchedFields.has(field) ? errors[field] : undefined;

  const formatDateValue = (date: Date) => date.toISOString();

  if (!phase) {
    return null;
  }

  return (
    <div className="mx-auto w-full space-y-10 p-4 [scrollbar-gutter:stable] md:max-w-160 md:p-8">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-gray4">
            {t('Phase {index} of {total}', {
              index: phaseIndex,
              total: phaseCount,
            })}
          </p>
          <Header2 className="font-serif text-title-base">
            {phase.name?.trim() ? phase.name : t('Add phase')}
          </Header2>
        </div>
        <SaveStatusIndicator
          status={autosaveStatus.status}
          savedAt={autosaveStatus.savedAt}
        />
      </div>

      <div className="space-y-8">
        <PhaseField
          id="phase-name"
          label={t('Short name')}
          isRequired
          value={phase.name ?? ''}
          onChange={(value) => updatePhase({ name: value })}
          onBlur={() => markTouched('name')}
          errorMessage={getErrorMessage('name')}
          description={t(
            'A short name to easily recognize the purpose of the phase.',
          )}
          maxLength={50}
        />
        <PhaseField
          id="phase-headline"
          label={t('Headline')}
          isRequired
          value={phase.headline ?? ''}
          onChange={(value) => updatePhase({ headline: value })}
          onBlur={() => markTouched('headline')}
          errorMessage={getErrorMessage('headline')}
          description={t('This text appears as the header of the page.')}
          maxLength={50}
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
          description={t(
            'This text appears below the headline on the phase page.',
          )}
          maxLength={250}
        />
        <div className="space-y-2">
          <label className="block font-strong">
            {t('Additional information')}
          </label>
          <RichTextEditorWithToolbar
            content={phase.additionalInfo ?? ''}
            onChange={(content) => updatePhase({ additionalInfo: content })}
            toolbarPosition="bottom"
            className="rounded-lg border border-input"
            editorClassName="min-h-24 p-3"
          />
          <p className="text-sm text-neutral-gray4">
            {t(
              'Any additional information will appear in a modal titled "About the process"',
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1">
            <DatePicker
              label={t('Start date')}
              value={safeParseLocal(phase.startDate)}
              maxDate={safeParseLocal(phase.endDate)}
              onChange={(date) => {
                if (date) {
                  updatePhase({ startDate: formatDateValue(date) });
                }
              }}
            />
          </div>
          <div className="flex-1" onBlur={() => markTouched('endDate')}>
            <DatePicker
              label={t('End date')}
              required
              value={safeParseLocal(phase.endDate)}
              minDate={safeParseLocal(phase.startDate)}
              onChange={(date) => {
                if (date) {
                  updatePhase({ endDate: formatDateValue(date) });
                }
                markTouched('endDate');
              }}
              errorMessage={getErrorMessage('endDate')}
            />
          </div>
        </div>

        <ToggleRow
          label={t('Proposal submission')}
          description={t(
            'Participants can submit new proposals during this phase.',
          )}
        >
          <Switch
            checked={phase.rules?.proposals?.submit ?? false}
            onCheckedChange={(val) =>
              updateRules({
                proposals: { ...phase.rules?.proposals, submit: val },
              })
            }
            size="sm"
          />
        </ToggleRow>
        {phase.rules?.proposals?.submit && (
          <ToggleRow
            label={t('Hide proposals by default')}
            description={t(
              'New proposals are hidden from other participants until an admin makes them visible.',
            )}
          >
            <Switch
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
              size="sm"
            />
          </ToggleRow>
        )}
        <ToggleRow
          label={t('Proposal editing')}
          description={t('Authors can edit their proposals after submitting')}
        >
          <Switch
            checked={phase.rules?.proposals?.edit ?? false}
            onCheckedChange={(val) =>
              updateRules({
                proposals: { ...phase.rules?.proposals, edit: val },
              })
            }
            size="sm"
          />
        </ToggleRow>
        <ToggleRow
          label={t('Proposal review')}
          description={t(
            'Proposals can be assessed and scored during this phase.',
          )}
        >
          <Switch
            checked={isReviewPhase(phase)}
            onCheckedChange={(val) =>
              updateRules({
                reviews: { ...phase.rules?.reviews, submit: val },
              })
            }
            size="sm"
          />
        </ToggleRow>
        <ToggleRow
          label={t('Voting')}
          description={t(
            'Participants can vote on proposals during this phase.',
          )}
        >
          <Switch
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
            size="sm"
          />
        </ToggleRow>
        {isVotingPhase(phase) && (
          <ToggleRow
            label={t('Voting limit')}
            description={t('Number of proposals each participant can vote on')}
          >
            <VoteLimitSelect
              maxVotes={phase.rules?.voting?.maxVotesPerMember}
              onChange={(maxVotesPerMember) =>
                updateRules({
                  voting: { ...phase.rules?.voting, maxVotesPerMember },
                })
              }
            />
          </ToggleRow>
        )}
      </div>
    </div>
  );
}

// 'none' is a reserved option id representing "no limit"; must not collide with String(n).
const VOTE_LIMIT_OPTIONS = ['none', '1', '2', '3', '4', '5', '10'] as const;

function VoteLimitSelect({
  maxVotes,
  onChange,
}: {
  maxVotes: number | undefined;
  onChange: (maxVotes: number | undefined) => void;
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
      ? t('No limit')
      : t('{count, plural, one {# vote} other {# votes}}', {
          count: Number(key),
        });

  return (
    <Select
      value={selectedKey}
      // Value→label map so SelectValue renders the label, not the raw id.
      items={Object.fromEntries(options.map((key) => [key, labelFor(key)]))}
      onValueChange={(key) => {
        onChange(key === 'none' ? undefined : Number(key));
      }}
    >
      <SelectTrigger aria-label={t('Voting limit')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((key) => (
          <SelectItem key={key} value={key}>
            {labelFor(key)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Labelled text/textarea field with error, description, and a live character
// counter — composes the sense Field + Input/Textarea primitives to reproduce
// the batteries-included @op/ui TextField this form previously used.
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
          aria-invalid={isInvalid || undefined}
          className="[unicode-bidi:plaintext]"
        />
      ) : (
        <Input
          id={id}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={isInvalid || undefined}
          className="[unicode-bidi:plaintext]"
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
                'text-sm text-neutral-gray4',
                (value.length === maxLength || isInvalid) &&
                  'text-functional-red',
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
