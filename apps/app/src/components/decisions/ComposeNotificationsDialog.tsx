'use client';

import {
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

interface ComposeNotificationsDialogProps {
  fundedCount: number;
  notFundedCount: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (messages: ResultNotificationMessages) => void;
  isSubmitting: boolean;
  triggerLabel: ReactNode;
}

type OutcomeTab = 'funded' | 'notFunded';

const isOutcomeTab = (value: string): value is OutcomeTab =>
  value === 'funded' || value === 'notFunded';

// Placeholder syntax, not prose: passed as ICU arguments so the tokens never
// reach a dictionary value, where a literal `{{` would break the parser and a
// translator could not reorder them around a sentence.
const TOKENS = {
  name: resultNotificationToken('name'),
  proposal: resultNotificationToken('proposal'),
};

/**
 * The final-phase publish gate (Figma 18037-40825): one editable message per
 * outcome, sent to the authors on that side of the result. Composes `Dialog`
 * directly rather than reusing `SelectionConfirmShell` — the shell's single
 * string label and one-button footer can't carry per-tab validation without
 * bloating it for the mid-process variant it still serves.
 */
export const ComposeNotificationsDialog = ({
  fundedCount,
  notFundedCount,
  isOpen,
  onOpenChange,
  onConfirm,
  isSubmitting,
  triggerLabel,
}: ComposeNotificationsDialogProps) => {
  const t = useTranslations();

  // Lazy: the component re-renders on every keystroke in a 4000-char textarea,
  // and these two ICU formats are only ever read once.
  const [messages, setMessages] = useState<ResultNotificationMessages>(() => ({
    // No amount anywhere in this copy, and no `{{amount}}` token offered:
    // nothing writes `decision_process_result_selections.allocated`, so any
    // figure here would either be invented or blank.
    funded: t(
      'Hi {name},\n\nGreat news — your proposal "{proposal}" has been selected for funding based on community voting results!\n\nWe will follow up with next steps and the final amount shortly.',
      TOKENS,
    ),
    notFunded: t(
      'Hi {name},\n\nThank you for submitting "{proposal}". After community voting, it was not selected for funding in this round.\n\nThe results are published on the decision page, and we hope you will take part again.',
      TOKENS,
    ),
  }));
  const [activeTab, setActiveTab] = useState<OutcomeTab>('funded');
  // The candidate query refetches on channel events, so the live counts can
  // move while the admin composes. Freeze what they were told on open. Only
  // the dialog body reads this — the trigger has to track the live count, or
  // it can never enable once the admin makes their first pick.
  const [counts, setCounts] = useState({
    funded: fundedCount,
    notFunded: notFundedCount,
  });
  const fieldIdPrefix = useId();
  const hintId = `${fieldIdPrefix}-hint`;

  const handleOpenChange = (open: boolean) => {
    // A close mid-submit would discard the composed copy the pending mutation
    // may still reject; hold the dialog until it settles.
    if (!open && isSubmitting) {
      return;
    }
    if (open) {
      setCounts({ funded: fundedCount, notFunded: notFundedCount });
      setActiveTab('funded');
    }
    onOpenChange(open);
  };

  // Both messages are always required, matching `resultNotificationMessages
  // Schema` exactly. Gating `notFunded` on its audience instead would let a
  // blank message survive a close/reopen into a state the server rejects and
  // the dialog can't show — the counts are a snapshot, the copy is not.
  const invalid = {
    funded: messages.funded.trim().length === 0,
    notFunded: messages.notFunded.trim().length === 0,
  };
  const hasError = invalid.funded || invalid.notFunded;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button disabled={fundedCount === 0}>{triggerLabel}</Button>}
      />

      {/* 32rem — the sense default (sm:max-w-sm) is narrower than two message
          templates need. */}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Compose Notifications')}</DialogTitle>
        </DialogHeader>

        <Tabs
          className="gap-4 px-6 py-4"
          value={activeTab}
          onValueChange={(value) => {
            if (typeof value === 'string' && isOutcomeTab(value)) {
              setActiveTab(value);
            }
          }}
        >
          {/* The rail lives on a wrapper, not the list — sense's `line` variant
              draws the active indicator only. Mirrors DecisionResultsTabs. */}
          <div className="w-full border-b">
            <TabsList
              variant="line"
              className="flex gap-6"
              aria-label={t('Notification audiences')}
            >
              <OutcomeTabTrigger
                value="funded"
                label={t('Funded')}
                count={counts.funded}
                isInvalid={invalid.funded}
              />
              <OutcomeTabTrigger
                value="notFunded"
                label={t('Not funded')}
                count={counts.notFunded}
                isInvalid={invalid.notFunded}
              />
            </TabsList>
          </div>

          {/* Mounted once, above the panels: identical for both audiences, and
              `Alert`'s default assertive role would re-announce this reference
              text on every tab switch. */}
          <Alert variant="info" role="note" id={hintId}>
            <LuCircleAlert aria-hidden />
            <AlertDescription>
              {t(
                'Use {name} for the submitter’s name and {proposal} for proposal title.',
                TOKENS,
              )}
            </AlertDescription>
          </Alert>

          {/* `keepMounted` so caret position, scroll, and undo history survive a
              tab switch (base-ui's equivalent of react-aria's shouldForceMount). */}
          <TabsContent value="funded" keepMounted>
            <MessageField
              id={`${fieldIdPrefix}-funded`}
              hintId={hintId}
              value={messages.funded}
              onChange={(funded) =>
                setMessages((prev) => ({ ...prev, funded }))
              }
              isInvalid={invalid.funded}
            />
          </TabsContent>

          <TabsContent value="notFunded" keepMounted>
            <MessageField
              id={`${fieldIdPrefix}-not-funded`}
              hintId={hintId}
              value={messages.notFunded}
              onChange={(notFunded) =>
                setMessages((prev) => ({ ...prev, notFunded }))
              }
              isInvalid={invalid.notFunded}
            />
          </TabsContent>

          {/* Proposal counts, not head counts: a co-authored proposal mails
              every collaborator, so the number of emails is at least this. */}
          <p className="text-sm text-muted-foreground">
            {t(
              'Publishing emails the authors of {fundedCount, plural, one {# funded proposal} other {# funded proposals}} and {notFundedCount, plural, one {# not funded proposal} other {# not funded proposals}}. This cannot be undone.',
              {
                fundedCount: counts.funded,
                notFundedCount: counts.notFunded,
              },
            )}
          </p>
        </Tabs>

        <DialogFooter>
          {/* Figma shows a single primary button, but an explicit Cancel stays:
              it's the only keyboard-reachable dismiss control in the footer of
              an irreversible flow. */}
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            {t('Cancel')}
          </Button>
          <Button
            onClick={() => onConfirm(messages)}
            disabled={hasError}
            loading={isSubmitting}
          >
            {t('Send & publish results')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    // No `aria-invalid`: ARIA 1.2 dropped it from the global set and `tab`
    // doesn't support it, so the state rides the sr-only text instead — which
    // also keeps the cue off colour alone.
    <TabsTrigger value={value} className={cn(isInvalid && 'text-destructive')}>
      {label}
      {/* The pill is decorative duplication; the count reaches the accessible
          name through the sr-only text, with its unit. */}
      <BadgeNumber variant="secondary" aria-hidden>
        {count}
      </BadgeNumber>
      <span className="sr-only">
        {t('{count} proposals', { count })}
        {isInvalid ? ` ${t('Needs a message')}` : ''}
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
  /** The placeholder-token help text, shared by both fields. */
  hintId: string;
  value: string;
  onChange: (value: string) => void;
  isInvalid: boolean;
}) => {
  const t = useTranslations();
  const errorId = `${id}-error`;

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t('Notification Message')}</FieldLabel>
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
          {t('Write a message before publishing results.')}
        </FieldError>
      ) : null}
    </Field>
  );
};
