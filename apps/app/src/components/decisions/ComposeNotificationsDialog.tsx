'use client';

import {
  type Proposal,
  type ProposalAllocation,
  RESULT_NOTIFICATION_MESSAGE_MAX_LENGTH,
  type ResultNotificationMessages,
  resultNotificationToken,
} from '@op/common/client';
import { Alert, AlertDescription } from '@op/sense/Alert';
import { BadgeNumber } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import { Field, FieldError, FieldLabel } from '@op/sense/Field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { Textarea } from '@op/sense/Textarea';
import { cn } from '@op/sense/lib/utils';
import { type ReactNode, useId, useState } from 'react';
import { LuCircleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { AwardSummaryStep } from './AwardSummaryStep';
import type { ProposalAwards } from './useProposalAwards';

interface ComposeNotificationsDialogProps {
  selectedProposals: Proposal[];
  selectedCount: number;
  notSelectedCount: number;
  /**
   * The awards typed in the selection table. When present the dialog opens on
   * a read-only summary of them and publishes their allocations; absent, the
   * process awards no amounts and the dialog opens on the notifications.
   */
  awards?: ProposalAwards;
  phaseName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: ConfirmResultsHandler;
  isSubmitting: boolean;
  triggerLabel: ReactNode;
}

export type ConfirmResultsHandler = (
  messages?: ResultNotificationMessages,
  allocations?: ProposalAllocation[],
) => void;

type OutcomeTab = 'selected' | 'notSelected';

type Step = 'amounts' | 'notifications';

const STEP_WIDTH = {
  amounts: 'sm:max-w-2xl',
  notifications: 'sm:max-w-lg',
} as const;

const isOutcomeTab = (value: string): value is OutcomeTab =>
  value === 'selected' || value === 'notSelected';

// Passed as ICU arguments so a literal `{{` never reaches a dictionary value,
// where it would break the parser.
const TOKENS = {
  name: resultNotificationToken('name'),
  proposal: resultNotificationToken('proposal'),
  amount: resultNotificationToken('amount'),
  phase: resultNotificationToken('phase'),
};

export const ComposeNotificationsDialog = ({
  selectedProposals,
  selectedCount,
  notSelectedCount,
  awards,
  phaseName,
  isOpen,
  onOpenChange,
  onConfirm,
  isSubmitting,
  triggerLabel,
}: ComposeNotificationsDialogProps) => {
  const t = useTranslations();

  const [messages, setMessages] = useState<ResultNotificationMessages>(() => ({
    selected: t('decisions.proposals.advancedNotificationTemplate', TOKENS),
    notSelected: t(
      'decisions.proposals.notAdvancedNotificationTemplate',
      TOKENS,
    ),
  }));
  const [activeTab, setActiveTab] = useState<OutcomeTab>('selected');
  // Frozen on open: the candidate query refetches on channel events, so the
  // live counts can move while the admin composes.
  const [counts, setCounts] = useState({
    selected: selectedCount,
    notSelected: notSelectedCount,
  });
  const fieldIdPrefix = useId();
  const hintId = `${fieldIdPrefix}-hint`;

  const awardsAmounts = awards !== undefined;
  const initialStep = getInitialStep(awardsAmounts);
  const [step, setStep] = useState<Step>(initialStep);
  // The table owns the awards, so the dialog reads them live; the trigger and
  // the publish buttons both wait until every advanced award can be published.
  const canConfirm = awards?.canConfirm ?? true;
  // The allocations the summary showed when the admin continued, so a draft
  // or selection that moves afterwards (another tab, a refetch) can't publish
  // an amount nobody saw: the publish returns to the summary instead.
  const [shownAllocations, setShownAllocations] = useState<
    ProposalAllocation[] | undefined
  >();

  const handleOpenChange = (open: boolean) => {
    // Closing mid-submit would discard copy the pending mutation may reject.
    if (!open && isSubmitting) {
      return;
    }
    if (open) {
      setCounts({ selected: selectedCount, notSelected: notSelectedCount });
      setActiveTab('selected');
      setStep(initialStep);
    }
    onOpenChange(open);
  };

  const invalid = {
    selected: messages.selected.trim().length === 0,
    notSelected: messages.notSelected.trim().length === 0,
  };
  const hasError = invalid.selected || invalid.notSelected;

  const confirm = (composed?: ResultNotificationMessages) => {
    const allocations = awards?.allocations();
    if (awards && !sameAllocations(allocations, shownAllocations)) {
      setStep('amounts');
      return;
    }
    onConfirm(composed, allocations);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button disabled={selectedCount === 0 || !canConfirm}>
            {triggerLabel}
          </Button>
        }
      />

      <DialogContent className={STEP_WIDTH[step]}>
        <DialogHeader>
          <StepTitle step={step} phaseName={phaseName} />
        </DialogHeader>

        {step === 'amounts' && awards ? (
          <AwardSummaryStep
            proposals={selectedProposals}
            awards={awards}
            onContinue={() => {
              // Re-frozen here too: the summary may show a changed set.
              setCounts({
                selected: selectedCount,
                notSelected: notSelectedCount,
              });
              setShownAllocations(awards.allocations());
              setStep('notifications');
            }}
          />
        ) : (
          <>
            <Tabs
              className="gap-4 px-6 py-4"
              value={activeTab}
              onValueChange={(value) => {
                if (typeof value === 'string' && isOutcomeTab(value)) {
                  setActiveTab(value);
                }
              }}
            >
              <div className="w-full border-b">
                <TabsList
                  variant="line"
                  className="flex gap-6"
                  aria-label={t(
                    'decisions.proposals.notificationAudiencesLabel',
                  )}
                >
                  <OutcomeTabTrigger
                    value="selected"
                    label={t('decisions.proposals.advancedAudienceLabel')}
                    count={counts.selected}
                    isInvalid={invalid.selected}
                  />
                  <OutcomeTabTrigger
                    value="notSelected"
                    label={t('decisions.proposals.notAdvancedAudienceLabel')}
                    count={counts.notSelected}
                    isInvalid={invalid.notSelected}
                  />
                </TabsList>
              </div>

              {/* `role="note"`: identical for both tabs, so the default assertive
              role would re-announce it on every switch. */}
              <Alert variant="info" role="note" id={hintId}>
                <LuCircleAlert aria-hidden />
                <AlertDescription>
                  {t(getPlaceholderHintKey(awardsAmounts), TOKENS)}
                </AlertDescription>
              </Alert>

              {/* `keepMounted` keeps caret and undo history across a tab switch. */}
              <TabsContent value="selected" keepMounted>
                <MessageField
                  id={`${fieldIdPrefix}-selected`}
                  hintId={hintId}
                  value={messages.selected}
                  onChange={(selected) =>
                    setMessages((prev) => ({ ...prev, selected }))
                  }
                  isInvalid={invalid.selected}
                />
              </TabsContent>

              <TabsContent value="notSelected" keepMounted>
                <MessageField
                  id={`${fieldIdPrefix}-not-selected`}
                  hintId={hintId}
                  value={messages.notSelected}
                  onChange={(notSelected) =>
                    setMessages((prev) => ({ ...prev, notSelected }))
                  }
                  isInvalid={invalid.notSelected}
                />
              </TabsContent>

              <p className="text-sm text-muted-foreground">
                {t('decisions.proposals.advanceNotificationsWarning', {
                  selectedCount: counts.selected,
                  notSelectedCount: counts.notSelected,
                })}
              </p>
            </Tabs>

            <DialogFooter>
              <BackButton
                isShown={awardsAmounts}
                onBack={() => setStep('amounts')}
                disabled={isSubmitting}
              />
              <ConfirmButtons
                onSend={() => confirm(messages)}
                onSkip={() => confirm()}
                canSend={!hasError}
                hasSelection={selectedCount > 0 && canConfirm}
                isSubmitting={isSubmitting}
              />
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

const ConfirmButtons = ({
  onSend,
  onSkip,
  canSend,
  hasSelection,
  isSubmitting,
}: {
  onSend: () => void;
  onSkip: () => void;
  canSend: boolean;
  hasSelection: boolean;
  isSubmitting: boolean;
}) => {
  const t = useTranslations();
  const [pendingAction, setPendingAction] = useState<'send' | 'skip'>('send');
  const isDisabled = !hasSelection || isSubmitting;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setPendingAction('skip');
          onSkip();
        }}
        disabled={isDisabled}
        loading={isSubmitting && pendingAction === 'skip'}
      >
        {t('decisions.proposals.skipNotificationsAction')}
      </Button>
      <Button
        onClick={() => {
          setPendingAction('send');
          onSend();
        }}
        disabled={isDisabled || !canSend}
        loading={isSubmitting && pendingAction === 'send'}
      >
        {t('decisions.proposals.sendAndAdvanceAction')}
      </Button>
    </>
  );
};

const StepTitle = ({ step, phaseName }: { step: Step; phaseName: string }) => {
  const t = useTranslations();

  return (
    <DialogTitle>
      {step === 'amounts'
        ? t('decisions.review.confirmWinningProposalsTitle')
        : t.rich('decisions.proposals.advanceToPhaseTitle', {
            phaseName,
            bdi: (chunks) => <bdi>{chunks}</bdi>,
          })}
    </DialogTitle>
  );
};

const getPlaceholderHintKey = (awardsAmounts: boolean) =>
  awardsAmounts
    ? 'decisions.proposals.notificationPlaceholderHint'
    : 'decisions.proposals.advanceNotificationPlaceholderHint';

const getInitialStep = (awardsAmounts: boolean): Step =>
  awardsAmounts ? 'amounts' : 'notifications';

const sameAllocations = (
  current: ProposalAllocation[] | undefined,
  shown: ProposalAllocation[] | undefined,
): boolean =>
  current !== undefined &&
  shown !== undefined &&
  current.length === shown.length &&
  current.every(
    (allocation, index) =>
      allocation.proposalId === shown[index]?.proposalId &&
      allocation.amount === shown[index]?.amount,
  );

const BackButton = ({
  isShown,
  onBack,
  disabled,
}: {
  isShown: boolean;
  onBack: () => void;
  disabled: boolean;
}) => {
  const t = useTranslations();

  if (!isShown) {
    return null;
  }

  return (
    <Button variant="outline" onClick={onBack} disabled={disabled}>
      {t('Back')}
    </Button>
  );
};

const OutcomeTabTrigger = ({
  value,
  label,
  count,
  isInvalid,
}: {
  value: OutcomeTab;
  label: string;
  count: number;
  isInvalid: boolean;
}) => {
  const t = useTranslations();

  return (
    <TabsTrigger value={value} className={cn(isInvalid && 'text-destructive')}>
      {label}
      <BadgeNumber variant="secondary" aria-hidden>
        {count}
      </BadgeNumber>
      <span className="sr-only">
        {t('decisions.proposals.proposalCountPlain', { count })}
        {isInvalid
          ? ` ${t('decisions.proposals.notificationMessageRequired')}`
          : ''}
      </span>
    </TabsTrigger>
  );
};

const MessageField = ({
  id,
  hintId,
  value,
  onChange,
  isInvalid,
}: {
  id: string;
  hintId: string;
  value: string;
  onChange: (value: string) => void;
  isInvalid: boolean;
}) => {
  const t = useTranslations();
  const errorId = `${id}-error`;

  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {t('decisions.proposals.notificationMessageLabel')}
      </FieldLabel>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={isInvalid}
        aria-describedby={isInvalid ? `${hintId} ${errorId}` : hintId}
        maxLength={RESULT_NOTIFICATION_MESSAGE_MAX_LENGTH}
        className="max-h-64 min-h-32"
      />
      {isInvalid ? (
        <FieldError id={errorId}>
          {t('decisions.proposals.advanceMessageRequired')}
        </FieldError>
      ) : null}
    </Field>
  );
};
