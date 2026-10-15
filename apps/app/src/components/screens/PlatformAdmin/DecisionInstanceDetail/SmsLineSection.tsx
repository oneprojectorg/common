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

export const SmsLineSection = ({
  instanceId,
  smsLine,
}: {
  instanceId: string;
  smsLine: string | null;
}) => {
  const t = useTranslations('admin');

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs tracking-wide text-muted-foreground uppercase">
        {t('smsLineTitle')}
      </h3>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {smsLine === null
          ? t('smsLineUnboundHint')
          : t.rich('smsLineBoundHint', {
              phoneNumber: smsLine,
              bdi: isolateNumber,
            })}
      </p>
      <div className="flex flex-wrap gap-2">
        <SetSmsLineButton instanceId={instanceId} smsLine={smsLine} />
        {smsLine === null ? null : (
          <ClearSmsLineButton instanceId={instanceId} smsLine={smsLine} />
        )}
      </div>
    </section>
  );
};

const SetSmsLineButton = ({
  instanceId,
  smsLine,
}: {
  instanceId: string;
  smsLine: string | null;
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

  const setLine = trpc.platform.admin.setDecisionSmsLine.useMutation({
    onSuccess: () => {
      toast.success(t('setSmsLineSuccess'));
      utils.platform.admin.getDecisionInstance.invalidate({ instanceId });
      handleOpenChange(false);
    },
    onError: (error) => {
      const status = httpStatusOf(error);
      toast.error(
        status === 409
          ? t('smsLineTakenError')
          : status === 400
            ? t('smsLineInvalidError')
            : t('setSmsLineError'),
      );
    },
  });

  return (
    <AdminActionConfirmation
      trigger={{
        label:
          smsLine === null ? t('setSmsLineAction') : t('changeSmsLineAction'),
        icon: <LuPhone data-icon="inline-start" />,
        variant: 'outline',
      }}
      title={t('setSmsLineConfirmTitle')}
      description={t('setSmsLineConfirmHint')}
      confirm={{
        label: t('setSmsLineConfirmAction'),
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
        <FieldLabel htmlFor="sms-line-number">
          {t('smsLineNumberLabel')}
        </FieldLabel>
        <Input
          id="sms-line-number"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          spellCheck={false}
          placeholder={t('smsLineNumberPlaceholder')}
          disabled={setLine.isPending}
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
        />
        <FieldDescription>{t('smsLineNumberHint')}</FieldDescription>
      </Field>
    </AdminActionConfirmation>
  );
};

const ClearSmsLineButton = ({
  instanceId,
  smsLine,
}: {
  instanceId: string;
  smsLine: string;
}) => {
  const t = useTranslations('admin');
  const utils = trpc.useUtils();
  const [isOpen, setIsOpen] = useState(false);

  const clearLine = trpc.platform.admin.clearDecisionSmsLine.useMutation({
    onSuccess: () => {
      toast.success(t('clearSmsLineSuccess'));
      utils.platform.admin.getDecisionInstance.invalidate({ instanceId });
      setIsOpen(false);
    },
    onError: () => {
      toast.error(t('clearSmsLineError'));
    },
  });

  return (
    <AdminActionConfirmation
      trigger={{
        label: t('clearSmsLineAction'),
        icon: <LuPhoneOff data-icon="inline-start" />,
        variant: 'destructive',
      }}
      title={t.rich('clearSmsLineConfirmTitle', {
        phoneNumber: smsLine,
        bdi: isolateNumber,
      })}
      description={t('clearSmsLineConfirmHint')}
      confirm={{
        label: t('clearSmsLineConfirmAction'),
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
