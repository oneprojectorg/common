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
  selectedCount: number;
  notSelectedCount: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (messages: ResultNotificationMessages) => void;
  isSubmitting: boolean;
  triggerLabel: ReactNode;
}

type OutcomeTab = 'selected' | 'notSelected';

const isOutcomeTab = (value: string): value is OutcomeTab =>
  value === 'selected' || value === 'notSelected';

// Passed as ICU arguments so a literal `{{` never reaches a dictionary value,
// where it would break the parser.
const TOKENS = {
  name: resultNotificationToken('name'),
  proposal: resultNotificationToken('proposal'),
};

export const ComposeNotificationsDialog = ({
  selectedCount,
  notSelectedCount,
  isOpen,
  onOpenChange,
  onConfirm,
  isSubmitting,
  triggerLabel,
}: ComposeNotificationsDialogProps) => {
  const t = useTranslations();

  const [messages, setMessages] = useState<ResultNotificationMessages>(() => ({
    selected: t(
      'Hi {name},\n\nGreat news — your proposal "{proposal}" has been selected for funding based on community voting results!\n\nWe will follow up with next steps and the final amount shortly.',
      TOKENS,
    ),
    notSelected: t(
      'Hi {name},\n\nThank you for submitting "{proposal}". After community voting, it was not selected for funding in this round.\n\nThe results are published on the decision page, and we hope you will take part again.',
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

  const handleOpenChange = (open: boolean) => {
    // Closing mid-submit would discard copy the pending mutation may reject.
    if (!open && isSubmitting) {
      return;
    }
    if (open) {
      setCounts({ selected: selectedCount, notSelected: notSelectedCount });
      setActiveTab('selected');
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
          <div className="w-full border-b">
            <TabsList
              variant="line"
              className="flex gap-6"
              aria-label={t('Notification audiences')}
            >
              <OutcomeTabTrigger
                value="selected"
                label={t('Funded')}
                count={counts.selected}
                isInvalid={invalid.selected}
              />
              <OutcomeTabTrigger
                value="notSelected"
                label={t('Not funded')}
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
              {t(
                'Use {name} for the submitter’s name and {proposal} for proposal title.',
                TOKENS,
              )}
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
            {t(
              'Publishing emails the authors of {fundedCount, plural, one {# funded proposal} other {# funded proposals}} and {notFundedCount, plural, one {# not funded proposal} other {# not funded proposals}}. This cannot be undone.',
              {
                fundedCount: counts.selected,
                notFundedCount: counts.notSelected,
              },
            )}
          </p>
        </Tabs>

        <DialogFooter>
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
    <TabsTrigger value={value} className={cn(isInvalid && 'text-destructive')}>
      {label}
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
