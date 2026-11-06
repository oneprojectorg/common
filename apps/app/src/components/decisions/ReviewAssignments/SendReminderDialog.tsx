'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { formatDate } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import {
  REVIEW_REMINDER_MAX_RECIPIENTS,
  REVIEW_REMINDER_MESSAGE_MAX_LENGTH,
  type ReviewReminderToken,
  type ReviewerStatus,
  getReviewerFirstName,
} from '@op/common/client';
import { logger } from '@op/logging/client';
import { Avatar, AvatarFallback } from '@op/sense/Avatar';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { FacePile } from '@op/sense/FacePile';
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from '@op/sense/Field';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { ProfileItem } from '@op/sense/ProfileItem';
import { Skeleton } from '@op/sense/Skeleton';
import { Textarea } from '@op/sense/Textarea';
import { toast } from '@op/sense/Toast';
import { useFormatter, useLocale } from 'next-intl';
import { type ReactNode, Suspense, useId, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

export interface ReminderRecipientPreview {
  id: string;
  name: string;
  email: string | null;
  remainingCount: number;
}

export type SendReminderTarget =
  | { kind: 'one'; recipient: ReminderRecipientPreview }
  | { kind: 'batch'; search?: string; status?: ReviewerStatus };

interface SendReminderDialogProps {
  processInstanceId: string;
  phaseId: string;
  /** Kept while the dialog animates closed, so the content does not blank out. */
  target: SendReminderTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ReminderContext {
  processInstanceId: string;
  phaseId: string;
  onClose: () => void;
}

type ReminderAudience =
  | { kind: 'one'; recipient: ReminderRecipientPreview }
  | { kind: 'batch'; recipients: Array<ReminderRecipientPreview> };

const MAX_FACES = 3;

/** Writes a reminder email to one reviewer, or to every reviewer the filters show. */
export function SendReminderDialog({
  processInstanceId,
  phaseId,
  target,
  open,
  onOpenChange,
}: SendReminderDialogProps) {
  const t = useTranslations();
  const context: ReminderContext = {
    processInstanceId,
    phaseId,
    onClose: () => onOpenChange(false),
  };

  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogContent className="sm:max-w-xl">
        {target ? (
          <APIErrorBoundary
            fallbacks={{
              default: () => (
                <ReminderDialogShell onClose={context.onClose}>
                  <p className="px-6 py-4 text-muted-foreground">
                    {t('decisions.review.reminderRecipientsLoadError')}
                  </p>
                </ReminderDialogShell>
              ),
            }}
          >
            <Suspense
              fallback={
                <ReminderDialogShell onClose={context.onClose}>
                  <div className="flex flex-col gap-4 px-6 py-4" aria-hidden>
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-48 w-full" />
                  </div>
                </ReminderDialogShell>
              }
            >
              {target.kind === 'one' ? (
                <ReminderForm
                  {...context}
                  audience={{ kind: 'one', recipient: target.recipient }}
                />
              ) : (
                <BatchReminderForm
                  {...context}
                  search={target.search}
                  status={target.status}
                />
              )}
            </Suspense>
          </APIErrorBoundary>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function BatchReminderForm({
  search,
  status,
  ...context
}: ReminderContext & { search?: string; status?: ReviewerStatus }) {
  const [{ items }] =
    trpc.decision.listReviewReminderRecipients.useSuspenseQuery({
      processInstanceId: context.processInstanceId,
      phaseId: context.phaseId,
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
    });

  return (
    <ReminderForm
      {...context}
      audience={{
        kind: 'batch',
        recipients: items.map((item) => ({
          id: item.reviewer.id,
          name: item.reviewer.name,
          email: item.reviewer.email,
          remainingCount: item.remainingCount,
        })),
      }}
    />
  );
}

function ReminderForm({
  processInstanceId,
  phaseId,
  onClose,
  audience,
}: ReminderContext & { audience: ReminderAudience }) {
  const t = useTranslations();
  const locale = useLocale();
  const messageId = useId();
  const hintId = `${messageId}-hint`;
  const toId = `${messageId}-to`;

  const [instance] = trpc.decision.getInstance.useSuspenseQuery({
    instanceId: processInstanceId,
  });
  const steward = instance.steward?.name ?? null;

  const [message, setMessage] = useState(() => {
    const endDate = instance.instanceData.phases?.find(
      (phase) => phase.phaseId === phaseId,
    )?.endDate;
    const values = {
      process: instance.name,
      ...(audience.kind === 'one'
        ? {
            firstName: getReviewerFirstName(audience.recipient.name),
            proposalsLeft: t('decisions.review.reminderProposalsLeft', {
              count: audience.recipient.remainingCount,
            }),
          }
        : // The server fills these per reviewer; as argument values they stay
          // literal text, out of reach of the ICU parser.
          {
            firstName: tokenText('firstName'),
            proposalsLeft: tokenText('proposalsLeft'),
          }),
    };

    return endDate
      ? t('decisions.review.reminderMessageDefault', {
          ...values,
          endDate: formatDate(endDate, locale, {
            month: 'long',
            day: 'numeric',
          }),
        })
      : t('decisions.review.reminderMessageDefaultNoEndDate', values);
  });

  const recipientIds =
    audience.kind === 'one'
      ? [audience.recipient.id]
      : audience.recipients.map((recipient) => recipient.id);

  const sendReminder = trpc.decision.sendReviewReminder.useMutation();
  // `isPending` lands a render late; a double click must not send twice.
  const isSubmittingRef = useRef(false);

  const canSend =
    recipientIds.length > 0 &&
    message.trim().length > 0 &&
    !sendReminder.isPending;

  const send = () => {
    if (!canSend || isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;

    sendReminder.mutate(
      {
        processInstanceId,
        phaseId,
        reviewerProfileIds: recipientIds,
        message,
      },
      {
        onSuccess: () => {
          const description = steward
            ? t.rich('decisions.review.reminderSendingDescription', {
                organization: steward,
                bdi: (chunks) => <bdi>{chunks}</bdi>,
              })
            : undefined;

          if (audience.kind === 'one') {
            toast.success(
              t.rich('decisions.review.reminderSendingToast', {
                name: audience.recipient.name,
                bdi: (chunks) => <bdi>{chunks}</bdi>,
              }),
              { description },
            );
          } else {
            toast.success(
              t('decisions.review.remindersSendingToast', {
                count: recipientIds.length,
              }),
              { description },
            );
          }
          onClose();
        },
        onError: (error) => {
          logger.error('Failed to send review reminder', {
            error,
            processInstanceId,
            phaseId,
            reviewerCount: recipientIds.length,
          });
          toast.error(t("That didn't work"), {
            description: t('somethingWentWrong'),
          });
        },
        onSettled: () => {
          isSubmittingRef.current = false;
        },
      },
    );
  };

  return (
    <ReminderDialogShell
      onClose={onClose}
      steward={steward}
      sendButton={
        <Button
          loading={sendReminder.isPending}
          disabled={!canSend}
          onClick={send}
        >
          {audience.kind === 'one'
            ? t('decisions.review.sendReminderAction')
            : t('decisions.review.sendRemindersAction', {
                count: recipientIds.length,
              })}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 p-6">
        <Field aria-labelledby={toId}>
          <FieldTitle id={toId}>
            {t('decisions.review.reminderToLabel')}
          </FieldTitle>
          <div className="rounded-lg border p-4">
            {audience.kind === 'one' ? (
              <ProfileItem
                avatar={
                  <ProfileAvatar
                    size="lg"
                    name={audience.recipient.name}
                    alt={audience.recipient.name}
                  />
                }
                title={audience.recipient.name}
                titleClassName="font-normal"
                description={audience.recipient.email ?? undefined}
              />
            ) : (
              <BatchRecipients recipients={audience.recipients} />
            )}
          </div>
          {audience.kind === 'batch' &&
          audience.recipients.length >= REVIEW_REMINDER_MAX_RECIPIENTS ? (
            <FieldDescription>
              {t('decisions.review.reminderRecipientsCapped', {
                count: REVIEW_REMINDER_MAX_RECIPIENTS,
              })}
            </FieldDescription>
          ) : null}
        </Field>

        <Field>
          <FieldLabel htmlFor={messageId}>
            {t('decisions.review.reminderMessageLabel')}
          </FieldLabel>
          <Textarea
            id={messageId}
            aria-describedby={audience.kind === 'batch' ? hintId : undefined}
            rows={5}
            className="field-sizing-fixed resize-y"
            value={message}
            maxLength={REVIEW_REMINDER_MESSAGE_MAX_LENGTH}
            onChange={(event) => setMessage(event.target.value)}
          />
          {audience.kind === 'batch' ? (
            <FieldDescription id={hintId}>
              {t('decisions.review.reminderPersonalizationHint')}
            </FieldDescription>
          ) : null}
        </Field>
      </div>
    </ReminderDialogShell>
  );
}

function BatchRecipients({
  recipients,
}: {
  recipients: Array<ReminderRecipientPreview>;
}) {
  const t = useTranslations();
  const format = useFormatter();

  if (recipients.length === 0) {
    return (
      <p aria-live="polite" className="text-muted-foreground">
        {t('decisions.review.noReviewersToRemind')}
      </p>
    );
  }

  const overflowCount = recipients.length - MAX_FACES;
  const faces = recipients
    .slice(0, MAX_FACES)
    .map((recipient) => (
      <ProfileAvatar
        key={recipient.id}
        name={recipient.name}
        alt={recipient.name}
      />
    ));

  return (
    <div className="flex items-center gap-3">
      <FacePile
        className="shrink-0"
        items={
          overflowCount > 0
            ? [
                ...faces,
                <Avatar key="overflow" aria-hidden>
                  <AvatarFallback className="bg-foreground text-sm text-background">
                    {format.number(overflowCount, { signDisplay: 'always' })}
                  </AvatarFallback>
                </Avatar>,
              ]
            : faces
        }
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span aria-live="polite" className="text-base text-foreground">
          {t('decisions.review.reviewerCount', { count: recipients.length })}
        </span>
        <span className="text-sm text-muted-foreground">
          {t('decisions.review.reminderRecipientsHint')}
        </span>
      </div>
    </div>
  );
}

function ReminderDialogShell({
  onClose,
  steward,
  sendButton,
  children,
}: {
  onClose: () => void;
  steward?: string | null;
  sendButton?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations();

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('decisions.review.sendReminderTitle')}</DialogTitle>
        {steward ? (
          <DialogDescription>
            {t.rich('decisions.review.reminderSenderSubtitle', {
              organization: steward,
              bdi: (chunks) => <bdi>{chunks}</bdi>,
            })}
          </DialogDescription>
        ) : null}
      </DialogHeader>
      {children}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('Cancel')}
        </Button>
        {sendButton ?? (
          <Button disabled>{t('decisions.review.sendReminderAction')}</Button>
        )}
      </DialogFooter>
    </>
  );
}

function tokenText(token: ReviewReminderToken): string {
  return `{{${token}}}`;
}
