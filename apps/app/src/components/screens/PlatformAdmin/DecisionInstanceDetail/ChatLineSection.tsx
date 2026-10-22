'use client';

import { trpc } from '@op/api/client';
import { isValidTypedPhoneNumber } from '@op/common/client';
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { toast } from '@op/sense/Toast';
import { type ReactNode, useState } from 'react';
import { LuPhone, LuPhoneOff } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { AdminActionConfirmation } from './AdminActionConfirmation';

export const ChatLineSection = ({
  instanceId,
  chatLine,
}: {
  instanceId: string;
  chatLine: string | null;
}) => {
  const t = useTranslations('admin');

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs tracking-wide text-muted-foreground uppercase">
        {t('chatLineTitle')}
      </h3>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {chatLine === null
          ? t('chatLineUnboundHint')
          : t.rich('chatLineBoundHint', {
              phoneNumber: chatLine,
              bdi: isolateNumber,
            })}
      </p>
      <div className="flex flex-wrap gap-2">
        <SetChatLineButton instanceId={instanceId} chatLine={chatLine} />
        {chatLine === null ? null : (
          <ClearChatLineButton instanceId={instanceId} chatLine={chatLine} />
        )}
      </div>
    </section>
  );
};

const SetChatLineButton = ({
  instanceId,
  chatLine,
}: {
  instanceId: string;
  chatLine: string | null;
}) => {
  const t = useTranslations('admin');
  const utils = trpc.useUtils();
  const [isOpen, setIsOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setPhoneNumber('');
    }
  };

  const setLine = trpc.platform.admin.setDecisionChatLine.useMutation({
    onSuccess: () => {
      toast.success(t('setChatLineSuccess'));
      utils.platform.admin.getDecisionInstance.invalidate({ instanceId });
      handleOpenChange(false);
    },
    onError: (error) => {
      const status = httpStatusOf(error);
      toast.error(
        status === 409
          ? t('chatLineTakenError')
          : status === 400
            ? t('chatLineInvalidError')
            : t('setChatLineError'),
      );
    },
  });

  return (
    <AdminActionConfirmation
      trigger={{
        label:
          chatLine === null
            ? t('setChatLineAction')
            : t('changeChatLineAction'),
        icon: <LuPhone data-icon="inline-start" />,
        variant: 'outline',
      }}
      title={t('setChatLineConfirmTitle')}
      description={t('setChatLineConfirmHint')}
      confirm={{
        label: t('setChatLineConfirmAction'),
        pendingLabel: t('bindingProgress'),
        variant: 'default',
      }}
      isPending={setLine.isPending}
      confirmDisabled={!isValidTypedPhoneNumber(phoneNumber)}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      onConfirm={() => setLine.mutate({ instanceId, phoneNumber })}
    >
      <Field>
        <FieldLabel htmlFor="chat-line-number">
          {t('chatLineNumberLabel')}
        </FieldLabel>
        <Input
          id="chat-line-number"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          spellCheck={false}
          placeholder={t('chatLineNumberPlaceholder')}
          disabled={setLine.isPending}
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
        />
        <FieldDescription>{t('chatLineNumberHint')}</FieldDescription>
      </Field>
    </AdminActionConfirmation>
  );
};

const ClearChatLineButton = ({
  instanceId,
  chatLine,
}: {
  instanceId: string;
  chatLine: string;
}) => {
  const t = useTranslations('admin');
  const utils = trpc.useUtils();
  const [isOpen, setIsOpen] = useState(false);

  const clearLine = trpc.platform.admin.clearDecisionChatLine.useMutation({
    onSuccess: () => {
      toast.success(t('clearChatLineSuccess'));
      utils.platform.admin.getDecisionInstance.invalidate({ instanceId });
      setIsOpen(false);
    },
    onError: () => {
      toast.error(t('clearChatLineError'));
    },
  });

  return (
    <AdminActionConfirmation
      trigger={{
        label: t('clearChatLineAction'),
        icon: <LuPhoneOff data-icon="inline-start" />,
        variant: 'destructive',
      }}
      title={t.rich('clearChatLineConfirmTitle', {
        phoneNumber: chatLine,
        bdi: isolateNumber,
      })}
      description={t('clearChatLineConfirmHint')}
      confirm={{
        label: t('clearChatLineConfirmAction'),
        pendingLabel: t('unbindingProgress'),
        variant: 'destructive',
      }}
      isPending={clearLine.isPending}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      onConfirm={() => clearLine.mutate({ instanceId })}
    />
  );
};

const isolateNumber = (chunks: ReactNode) => <bdi dir="ltr">{chunks}</bdi>;

const httpStatusOf = (error: { data?: object | null }): number | undefined =>
  error.data &&
  'httpStatus' in error.data &&
  typeof error.data.httpStatus === 'number'
    ? error.data.httpStatus
    : undefined;
