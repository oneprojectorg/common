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

import { AwardAmountsStep } from './AwardAmountsStep';
import { useAwardAmounts } from './useAwardAmounts';

interface ComposeNotificationsDialogProps {
  selectedProposals: Proposal[];
  selectedCount: number;
  notSelectedCount: number;
  /**
   * The template collects a budget, so the dialog opens on a step where the
   * admin confirms the amount each winner is awarded.
   */
  awardsAmounts: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: ConfirmResultsHandler;
  isSubmitting: boolean;
  triggerLabel: ReactNode;
}

/** Publishes results; `allocations` is set when the template awards amounts. */
export type ConfirmResultsHandler = (
  messages: ResultNotificationMessages,
  allocations?: ProposalAllocation[],
) => void;

type OutcomeTab = 'selected' | 'notSelected';

type Step = 'amounts' | 'notifications';

const STEP_LAYOUT = {
  amounts: {
    title: 'decisions.review.confirmWinningProposalsTitle',
    width: 'sm:max-w-2xl',
  },
  notifications: {
    title: 'decisions.proposals.composeNotificationsTitle',
    width: 'sm:max-w-lg',
  },
} as const;

const isOutcomeTab = (value: string): value is OutcomeTab =>
  value === 'selected' || value === 'notSelected';

// Passed as ICU arguments so a literal `{{` never reaches a dictionary value,
// where it would break the parser.
const TOKENS = {
  name: resultNotificationToken('name'),
  proposal: resultNotificationToken('proposal'),
};

export const ComposeNotificationsDialog = ({
  selectedProposals,
  selectedCount,
  notSelectedCount,
  awardsAmounts,
  isOpen,
  onOpenChange,
  onConfirm,
  isSubmitting,
  triggerLabel,
}: ComposeNotificationsDialogProps) => {
  const t = useTranslations();

  const [messages, setMessages] = useState<ResultNotificationMessages>(() => ({
    selected: t('decisions.proposals.selectedNotificationTemplate', TOKENS),
    notSelected: t(
      'decisions.proposals.notSelectedNotificationTemplate',
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

  const initialStep = getInitialStep(awardsAmounts);
  const [step, setStep] = useState<Step>(initialStep);
  const awards = useAwardAmounts({
    proposals: selectedProposals,
    isEnabled: awardsAmounts,
  });

  const handleOpenChange = (open: boolean) => {
    // Closing mid-submit would discard copy the pending mutation may reject.
    if (!open && isSubmitting) {
      return;
    }
    if (open) {
      setCounts({ selected: selectedCount, notSelected: notSelectedCount });
      setActiveTab('selected');
      setStep(initialStep);
      awards.reset();
    }
    onOpenChange(open);
  };

  const invalid = {
    selected: messages.selected.trim().length === 0,
    notSelected: messages.notSelected.trim().length === 0,
  };
  const hasError = invalid.selected || invalid.notSelected;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button disabled={selectedCount === 0}>{triggerLabel}</Button>}
      />

      <DialogContent className={STEP_LAYOUT[step].width}>
        <DialogHeader>
          <DialogTitle>{t(STEP_LAYOUT[step].title)}</DialogTitle>
        </DialogHeader>

        {step === 'amounts' ? (
          <AwardAmountsStep
            proposals={selectedProposals}
            awards={awards}
            onCancel={() => handleOpenChange(false)}
            onContinue={() => awards.confirm(() => setStep('notifications'))}
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
                    label={t('decisions.proposals.fundedStatus')}
                    count={counts.selected}
                    isInvalid={invalid.selected}
                  />
                  <OutcomeTabTrigger
                    value="notSelected"
                    label={t('decisions.proposals.notFundedStatus')}
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
                  {t('decisions.proposals.notificationPlaceholderHint', TOKENS)}
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
                {t('decisions.proposals.publishResultsWarning', {
                  fundedCount: counts.selected,
                  notFundedCount: counts.notSelected,
                })}
              </p>
            </Tabs>

            <DialogFooter>
              <ComposerDismissButton
                canGoBack={awardsAmounts}
                onBack={() => setStep('amounts')}
                onCancel={() => handleOpenChange(false)}
                disabled={isSubmitting}
              />
              {/* `selectedCount` is live, not the frozen badge count: if the pool
              refetches the selection away while the admin composes, the
              mutation would be rejected for an empty `proposalIds`. */}
              <Button
                onClick={() =>
                  awards.publish({
                    onPublish: (allocations) =>
                      onConfirm(messages, allocations),
                    onReopen: () => setStep('amounts'),
                  })
                }
                disabled={hasError || selectedCount === 0}
                loading={isSubmitting}
              >
                {t('decisions.proposals.publishResultsAction')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

const getInitialStep = (awardsAmounts: boolean): Step =>
  awardsAmounts ? 'amounts' : 'notifications';

/** With an amounts step behind it, the composer steps back instead of closing. */
const ComposerDismissButton = ({
  canGoBack,
  onBack,
  onCancel,
  disabled,
}: {
  canGoBack: boolean;
  onBack: () => void;
  onCancel: () => void;
  disabled: boolean;
}) => {
  const t = useTranslations();

  return (
    <Button
      variant="outline"
      onClick={canGoBack ? onBack : onCancel}
      disabled={disabled}
    >
      {canGoBack ? t('Back') : t('Cancel')}
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
          {t('decisions.proposals.publishResultsMessageRequired')}
        </FieldError>
      ) : null}
    </Field>
  );
};
